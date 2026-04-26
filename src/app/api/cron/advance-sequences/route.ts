import { getAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('Authorization') || ''
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = getAdminClient()
  const now = new Date().toISOString()
  let processed = 0

  // ── 1. Advance scheduled sequence enrollments ─────────────────────
  const { data: dueEnrollments } = await adminClient
    .from('sequence_contacts')
    .select(`
      id,
      sequence_id,
      contact_id,
      contacts!inner(phone_number, workspace_id),
      bot_sequences!inner(flow_data)
    `)
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)

  for (const enrollment of dueEnrollments ?? []) {
    try {
      const contact = enrollment.contacts as any
      const sequence = enrollment.bot_sequences as any
      const workspaceId = contact?.workspace_id
      const phone = contact?.phone_number

      if (!workspaceId || !phone || !sequence?.flow_data) continue

      const { nodes, edges } = sequence.flow_data as { nodes: any[]; edges: any[] }
      const startEdge = edges.find((e: any) => e.source === 'start')
      const firstNodeId = startEdge?.target ?? null
      const firstNode = firstNodeId ? nodes.find((n: any) => n.id === firstNodeId) : null

      await adminClient.from('sequence_contacts')
        .update({ status: 'active', scheduled_at: null })
        .eq('id', enrollment.id)

      const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
        p_workspace_id: workspaceId,
        p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
      })

      if (!creds?.[0] || !firstNode) continue
      const { phone_number_id, access_token } = creds[0]

      if (firstNode.type === 'textMessage' && firstNode.data?.message) {
        await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: firstNode.data.message } }),
        })
      } else if (firstNode.type === 'templateMessage' && firstNode.data?.templateName) {
        await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: firstNode.data.templateName, language: { code: 'en' } } }),
        })
      }

      processed++
    } catch {}
  }

  // ── 2. Process webhook send queue (delayed workflow sends) ─────────
  const { data: dueWebhooks } = await adminClient
    .from('webhook_send_queue')
    .select('*, webhook_workflows!inner(template_name, workspace_id, total_targeted, total_sent, total_failed)')
    .lte('scheduled_at', now)

  for (const item of dueWebhooks ?? []) {
    try {
      const wf = item.webhook_workflows as any
      if (!wf) continue

      const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
        p_workspace_id: item.workspace_id,
        p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
      })

      if (!creds?.[0]) {
        await adminClient.from('webhook_send_queue').delete().eq('id', item.id)
        await adminClient.from('webhook_workflows').update({
          total_targeted: (wf.total_targeted ?? 0) + 1,
          total_failed: (wf.total_failed ?? 0) + 1,
        }).eq('id', item.workflow_id)
        continue
      }

      const { phone_number_id, access_token } = creds[0]
      const templateParams = (item.template_params ?? {}) as Record<string, string>
      const paramValues = Object.keys(templateParams)
        .sort()
        .map(k => ({ type: 'text', text: templateParams[k] }))

      let success = false
      try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: item.phone,
            type: 'template',
            template: {
              name: wf.template_name,
              language: { code: 'en' },
              ...(paramValues.length > 0 && { components: [{ type: 'body', parameters: paramValues }] }),
            },
          }),
        })
        success = res.ok
      } catch {}

      await adminClient.from('webhook_send_queue').delete().eq('id', item.id)
      await adminClient.from('webhook_workflows').update({
        total_targeted: (wf.total_targeted ?? 0) + 1,
        total_sent: success ? (wf.total_sent ?? 0) + 1 : (wf.total_sent ?? 0),
        total_failed: success ? (wf.total_failed ?? 0) : (wf.total_failed ?? 0) + 1,
        last_called_at: now,
      }).eq('id', item.workflow_id)

      if (success) processed++
    } catch {}
  }

  return NextResponse.json({ processed })
}
