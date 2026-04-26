import { getAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

// Resolve a dot-notation field path from an arbitrary JSON payload
function getField(payload: Record<string, unknown>, path: string): string | undefined {
  const val = path.split('.').reduce((obj: any, key) => obj?.[key], payload)
  return val != null ? String(val) : undefined
}

// Apply a named formatter to a resolved string value
function applyFormatter(value: string, fmt: string | undefined): string {
  switch (fmt) {
    case 'e164':       return '+' + value.replace(/\D/g, '')
    case 'prefix_91':  return '+91' + value.replace(/\D/g, '')
    case 'prefix_1':   return '+1' + value.replace(/\D/g, '')
    case 'capitalize': return value.replace(/\b\w/g, c => c.toUpperCase())
    case 'uppercase':  return value.toUpperCase()
    case 'lowercase':  return value.toLowerCase()
    case 'trim':       return value.trim()
    default:           return value
  }
}

// Evaluate all conditions against the payload
function checkConditions(
  payload: Record<string, unknown>,
  conditions: any[],
  mode: string
): boolean {
  if (!conditions?.length) return true
  const results = conditions.map(c => {
    const actual = getField(payload, c.field) ?? ''
    switch (c.op) {
      case 'eq':          return actual === c.value
      case 'neq':         return actual !== c.value
      case 'contains':    return actual.toLowerCase().includes(c.value.toLowerCase())
      case 'starts_with': return actual.toLowerCase().startsWith(c.value.toLowerCase())
      case 'gt':          return parseFloat(actual) > parseFloat(c.value)
      case 'lt':          return parseFloat(actual) < parseFloat(c.value)
      default:            return true
    }
  })
  return mode === 'any' ? results.some(Boolean) : results.every(Boolean)
}

export async function POST(
  request: Request,
  { params }: { params: { workflowId: string } }
) {
  const adminClient = getAdminClient()

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const authHeader = request.headers.get('Authorization') || ''
  const urlToken = new URL(request.url).searchParams.get('token') || ''
  const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : urlToken

  const { data: workflow } = await adminClient
    .from('webhook_workflows')
    .select('id, workspace_id, template_name, is_active, secret_token, total_targeted, total_sent, total_failed, total_opened, total_skipped, field_mapping, delay_minutes, conditions, condition_mode, post_send_actions')
    .eq('id', params.workflowId)
    .single()

  if (!workflow) {
    return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 })
  }
  if (!workflow.is_active) {
    return NextResponse.json({ success: false, error: 'Workflow is inactive' }, { status: 403 })
  }
  if (callerToken !== workflow.secret_token) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
  }

  // Always store the raw payload for re-capture
  await adminClient.from('webhook_workflows')
    .update({ last_payload: body })
    .eq('id', workflow.id)

  // Resolve phone and name from field mapping or fallback to direct fields
  const mapping = (workflow.field_mapping ?? {}) as {
    phone?: string; name?: string
    vars?: Record<string, string>
    formatters?: Record<string, string>
  }
  const fmts = mapping.formatters ?? {}

  const rawPhone = mapping.phone
    ? getField(body, mapping.phone)
    : (body.phone as string | undefined)
  const phone = rawPhone ? applyFormatter(rawPhone, fmts.phone) : undefined

  if (!phone) {
    return NextResponse.json({
      success: false,
      error: mapping.phone
        ? `Field "${mapping.phone}" not found in payload — check your field mapping`
        : 'Missing required field: phone',
    }, { status: 400 })
  }

  const rawName    = mapping.name ? getField(body, mapping.name) : undefined
  const contactName = rawName ? applyFormatter(rawName, fmts.name) : undefined

  // Build template params from mapping or fallback to body.params
  let templateParams: Record<string, string> = {}
  if (mapping.vars && Object.keys(mapping.vars).length > 0) {
    for (const [varNum, fieldPath] of Object.entries(mapping.vars)) {
      const val = getField(body, fieldPath)
      if (val !== undefined) templateParams[varNum] = applyFormatter(val, fmts[varNum])
    }
  } else if (body.params && typeof body.params === 'object') {
    templateParams = body.params as Record<string, string>
  }

  const now = new Date().toISOString()

  // Check opt-out
  const { data: optedOutContact } = await adminClient
    .from('contacts')
    .select('opted_out')
    .eq('workspace_id', workflow.workspace_id)
    .eq('phone_number', phone)
    .maybeSingle()

  if (optedOutContact?.opted_out === true) {
    await adminClient.from('webhook_workflows').update({
      total_skipped: (workflow.total_skipped ?? 0) + 1,
      last_called_at: now,
    }).eq('id', workflow.id)
    return NextResponse.json({ success: false, reason: 'opted_out' })
  }

  // Evaluate conditions
  const conditions = (workflow.conditions ?? []) as any[]
  const conditionMode = (workflow.condition_mode as string) || 'all'
  if (!checkConditions(body, conditions, conditionMode)) {
    await adminClient.from('webhook_workflows').update({
      total_skipped: (workflow.total_skipped ?? 0) + 1,
      last_called_at: now,
    }).eq('id', workflow.id)
    return NextResponse.json({ success: false, reason: 'condition_not_met' })
  }

  // If delay configured, queue for later and return immediately
  const delayMinutes = workflow.delay_minutes ?? 0
  if (delayMinutes > 0) {
    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
    await adminClient.from('webhook_send_queue').insert({
      workflow_id: workflow.id,
      workspace_id: workflow.workspace_id,
      phone,
      contact_name: contactName ?? null,
      template_params: templateParams,
      scheduled_at: scheduledAt,
    })
    await adminClient.from('webhook_workflows').update({ last_called_at: now }).eq('id', workflow.id)
    return NextResponse.json({ success: true, queued: true, sends_at: scheduledAt })
  }

  // Send immediately
  const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
    p_workspace_id: workflow.workspace_id,
    p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
  })

  if (!creds?.[0]) {
    await adminClient.from('webhook_workflows').update({
      total_targeted: (workflow.total_targeted ?? 0) + 1,
      total_failed: (workflow.total_failed ?? 0) + 1,
      last_called_at: now,
    }).eq('id', workflow.id)
    return NextResponse.json({ success: false, error: 'WhatsApp not configured' }, { status: 500 })
  }

  const { phone_number_id, access_token } = creds[0]

  const paramValues = Object.keys(templateParams)
    .sort()
    .map(k => ({ type: 'text', text: templateParams[k] }))

  const templatePayload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: workflow.template_name,
      language: { code: 'en' },
      ...(paramValues.length > 0 && {
        components: [{ type: 'body', parameters: paramValues }],
      }),
    },
  }

  let success = false
  let metaMessageId: string | null = null

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify(templatePayload),
      }
    )
    if (res.ok) {
      const data = await res.json()
      metaMessageId = data?.messages?.[0]?.id ?? null
      success = true
    }
  } catch {}

  await adminClient.from('webhook_workflows').update({
    total_targeted: (workflow.total_targeted ?? 0) + 1,
    total_sent: success ? (workflow.total_sent ?? 0) + 1 : (workflow.total_sent ?? 0),
    total_failed: success ? (workflow.total_failed ?? 0) : (workflow.total_failed ?? 0) + 1,
    last_called_at: now,
  }).eq('id', workflow.id)

  // After successful send: detect new contacts and schedule sequences
  if (success) {
    const { data: existingContact } = await adminClient
      .from('contacts')
      .select('id')
      .eq('workspace_id', workflow.workspace_id)
      .eq('phone_number', phone)
      .maybeSingle()

    let contactId: string | null = existingContact?.id ?? null
    const isNew = !contactId

    if (!contactId) {
      const { data: created } = await adminClient
        .from('contacts')
        .insert({ workspace_id: workflow.workspace_id, phone_number: phone, name: contactName ?? null })
        .select('id')
        .single()
      contactId = created?.id ?? null
    }

    if (isNew && contactId) {
      const { data: afterWebhookRules } = await adminClient
        .from('bot_rules')
        .select('sequence_id, delay_minutes, webhook_workflow_id, bot_sequences(flow_data)')
        .eq('workspace_id', workflow.workspace_id)
        .eq('action_type', 'sequence')
        .eq('trigger_type', 'after_webhook')
        .eq('is_active', true)

      for (const rule of afterWebhookRules ?? []) {
        if (rule.webhook_workflow_id && rule.webhook_workflow_id !== workflow.id) continue
        const seq = rule.bot_sequences as any
        if (!seq?.flow_data || !rule.sequence_id) continue
        const delayMin = rule.delay_minutes ?? 0

        if (delayMin === 0) {
          await adminClient.from('sequence_contacts').upsert({
            sequence_id: rule.sequence_id, contact_id: contactId, status: 'active',
          }, { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true })

          const { nodes, edges } = seq.flow_data as { nodes: any[]; edges: any[] }
          const firstNode = nodes.find((n: any) => n.id === edges.find((e: any) => e.source === 'start')?.target)
          if (firstNode?.type === 'textMessage' && firstNode.data?.message) {
            await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
              body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: firstNode.data.message } }),
            })
          }
        } else {
          const scheduledAt = new Date(Date.now() + delayMin * 60 * 1000).toISOString()
          await adminClient.from('sequence_contacts').upsert({
            sequence_id: rule.sequence_id, contact_id: contactId, status: 'scheduled', scheduled_at: scheduledAt,
          }, { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true })
        }
      }
    }

    // Execute post-send actions (label assignment + sequence enrollment) for all successful sends
    const psa = (workflow.post_send_actions ?? {}) as { tag_id?: string; sequence_id?: string }
    if (contactId && (psa.tag_id || psa.sequence_id)) {
      if (psa.tag_id) {
        await adminClient.from('contact_tag_mapping').upsert(
          { contact_id: contactId, tag_id: psa.tag_id },
          { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
        )
      }
      if (psa.sequence_id) {
        await adminClient.from('sequence_contacts').upsert(
          { sequence_id: psa.sequence_id, contact_id: contactId, status: 'active' },
          { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true }
        )
      }
    }

    return NextResponse.json({ success: true, message_id: metaMessageId })
  }
  return NextResponse.json({ success: false, error: 'WhatsApp API call failed' }, { status: 502 })
}
