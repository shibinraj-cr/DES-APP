'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: m } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = m?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')
  return { supabase, workspaceId }
}

async function resolveAudience(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  includeLabelIds: string[],
  excludeLabelIds: string[]
) {
  let includeIds: string[] | null = null
  if (includeLabelIds.length) {
    const { data } = await supabase.from('contact_tag_mapping').select('contact_id').in('tag_id', includeLabelIds)
    includeIds = Array.from(new Set((data ?? []).map((r: any) => r.contact_id)))
    if (includeIds.length === 0) return []
  }

  let excludeIds: string[] = []
  if (excludeLabelIds.length) {
    const { data } = await supabase.from('contact_tag_mapping').select('contact_id').in('tag_id', excludeLabelIds)
    excludeIds = Array.from(new Set((data ?? []).map((r: any) => r.contact_id)))
  }

  let query = supabase.from('contacts').select('id, phone_number')
    .eq('workspace_id', workspaceId).eq('opted_out', false)

  if (includeIds) query = query.in('id', includeIds)
  if (excludeIds.length) query = query.not('id', 'in', `(${excludeIds.join(',')})`)

  const { data } = await query
  return data ?? []
}

export async function getTargetedCount(
  includeLabelIds: string[],
  excludeLabelIds: string[]
): Promise<number> {
  const { supabase, workspaceId } = await getCtx()

  let includeIds: string[] | null = null
  if (includeLabelIds.length) {
    const { data } = await supabase.from('contact_tag_mapping').select('contact_id').in('tag_id', includeLabelIds)
    includeIds = Array.from(new Set((data ?? []).map((r: any) => r.contact_id)))
    if (includeIds.length === 0) return 0
  }

  let excludeIds: string[] = []
  if (excludeLabelIds.length) {
    const { data } = await supabase.from('contact_tag_mapping').select('contact_id').in('tag_id', excludeLabelIds)
    excludeIds = Array.from(new Set((data ?? []).map((r: any) => r.contact_id)))
  }

  let query = supabase.from('contacts').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('opted_out', false)

  if (includeIds) query = query.in('id', includeIds)
  if (excludeIds.length) query = query.not('id', 'in', `(${excludeIds.join(',')})`)

  const { count } = await query
  return count ?? 0
}

export async function sendBroadcast(formData: FormData) {
  const { supabase, workspaceId } = await getCtx()

  const name = (formData.get('name') as string)?.trim()
  const mode = (formData.get('mode') as string) || '24h'
  const message = (formData.get('message') as string)?.trim()
  const templateName = (formData.get('template_name') as string)?.trim()
  const includeLabelIds = (formData.getAll('include_label_ids') as string[]).filter(Boolean)
  const excludeLabelIds = (formData.getAll('exclude_label_ids') as string[]).filter(Boolean)
  const assignLabelId = (formData.get('assign_label_id') as string) || null
  // scheduled_at is submitted as IST (UTC+5:30); convert to UTC for storage
  const scheduledAtRaw = (formData.get('scheduled_at') as string) || null
  const scheduledAt = scheduledAtRaw
    ? new Date(scheduledAtRaw + ':00+05:30').toISOString()
    : null

  if (!name) redirect('/dashboard/broadcasting/new?error=Campaign+name+is+required')
  if (mode === '24h' && !message) redirect('/dashboard/broadcasting/new?error=Message+text+is+required')
  if (mode === 'anytime' && !templateName) redirect('/dashboard/broadcasting/new?error=Select+a+template+for+Anytime+mode')

  const contacts = await resolveAudience(supabase, workspaceId, includeLabelIds, excludeLabelIds)
  if (!contacts.length) redirect('/dashboard/broadcasting/new?error=No+active+contacts+match+the+selected+audience')

  const broadcastRecord = {
    workspace_id: workspaceId,
    name,
    message: message || `[Template] ${templateName}`,
    mode,
    template_name: templateName || null,
    include_label_ids: includeLabelIds,
    exclude_label_ids: excludeLabelIds,
    assign_label_id: assignLabelId || null,
    total_recipients: contacts.length,
  }

  // Scheduled — save and return without sending
  if (scheduledAt) {
    await supabase.from('broadcasts').insert({
      ...broadcastRecord,
      scheduled_at: scheduledAt,
      status: 'scheduled',
    })
    revalidatePath('/dashboard/broadcasting')
    redirect('/dashboard/broadcasting')
  }

  const { data: broadcast } = await supabase.from('broadcasts').insert({
    ...broadcastRecord,
    status: 'sending',
  }).select('id').single()

  if (!broadcast) redirect('/dashboard/broadcasting/new?error=Failed+to+create+broadcast')

  const { data: creds } = await supabase.rpc('get_whatsapp_credentials', {
    p_workspace_id: workspaceId,
    p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
  })

  let sentCount = 0, failedCount = 0

  if (creds) {
    const { access_token, phone_number_id } = creds

    for (const contact of contacts) {
      try {
        const body = mode === 'anytime'
          ? {
              messaging_product: 'whatsapp',
              to: contact.phone_number,
              type: 'template',
              template: { name: templateName, language: { code: 'en' } },
            }
          : {
              messaging_product: 'whatsapp',
              to: contact.phone_number,
              type: 'text',
              text: { body: message },
            }

        const res = await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
          body: JSON.stringify(body),
        })
        if (res.ok) sentCount++
        else failedCount++
      } catch {
        failedCount++
      }
    }
  } else {
    failedCount = contacts.length
  }

  await supabase.from('broadcasts').update({
    status: failedCount === contacts.length ? 'failed' : 'sent',
    sent_count: sentCount,
    failed_count: failedCount,
    sent_at: new Date().toISOString(),
  }).eq('id', broadcast.id)

  // Assign label to all targeted contacts
  if (assignLabelId && sentCount > 0) {
    const existing = await supabase.from('contact_tag_mapping').select('contact_id')
      .eq('tag_id', assignLabelId).in('contact_id', contacts.map((c: any) => c.id))
    const existingSet = new Set((existing.data ?? []).map((r: any) => r.contact_id))
    const newMappings = contacts
      .filter((c: any) => !existingSet.has(c.id))
      .map((c: any) => ({ contact_id: c.id, tag_id: assignLabelId }))
    if (newMappings.length) await supabase.from('contact_tag_mapping').insert(newMappings)
  }

  revalidatePath('/dashboard/broadcasting')
  redirect('/dashboard/broadcasting')
}
