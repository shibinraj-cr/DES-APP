'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: m } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = m?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')
  return { supabase, workspaceId }
}

// ─── Labels ───────────────────────────────────────────────────────
export async function createLabel(
  name: string,
  color: string
): Promise<{ id: string; name: string; color: string } | null> {
  const { supabase, workspaceId } = await getCtx()
  const trimmed = name.trim()
  if (!trimmed) return null

  const { data: existing } = await supabase
    .from('contact_tags').select('id, name, color')
    .eq('workspace_id', workspaceId).ilike('name', trimmed).maybeSingle()
  if (existing) return existing

  const { data } = await supabase
    .from('contact_tags').insert({ workspace_id: workspaceId, name: trimmed, color })
    .select('id, name, color').single()

  revalidatePath('/dashboard/subscribers')
  return data
}

export async function deleteLabel(labelId: string) {
  const { supabase } = await getCtx()
  await supabase.from('contact_tags').delete().eq('id', labelId)
  revalidatePath('/dashboard/subscribers')
}

export async function renameLabel(labelId: string, name: string, color: string) {
  const { supabase } = await getCtx()
  await supabase.from('contact_tags').update({ name: name.trim(), color }).eq('id', labelId)
  revalidatePath('/dashboard/subscribers')
}

// ─── Single subscriber ────────────────────────────────────────────
export async function createSubscriber(data: {
  name: string; phone: string; labelIds: string[]
}): Promise<{ type: 'created' | 'duplicate' | 'error'; labelsAdded?: number; message?: string }> {
  const { supabase, workspaceId } = await getCtx()
  const phone = data.phone.trim().replace(/\s+/g, '')
  if (!phone) return { type: 'error', message: 'Phone number is required' }

  const { data: existing } = await supabase
    .from('contacts').select('id')
    .eq('workspace_id', workspaceId).eq('phone_number', phone).maybeSingle()

  let contactId: string

  if (existing) {
    contactId = existing.id
    if (data.name.trim()) {
      await supabase.from('contacts').update({ name: data.name.trim() }).eq('id', contactId)
    }
  } else {
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({ workspace_id: workspaceId, phone_number: phone, name: data.name.trim() || null })
      .select('id').single()
    if (error || !created) return { type: 'error', message: error?.message }
    contactId = created.id
  }

  const labelsAdded = await mergeLabels(supabase, contactId, data.labelIds)
  revalidatePath('/dashboard/subscribers')
  return { type: existing ? 'duplicate' : 'created', labelsAdded }
}

export async function updateContactLabels(contactId: string, labelIds: string[]) {
  const { supabase } = await getCtx()
  await supabase.from('contact_tag_mapping').delete().eq('contact_id', contactId)
  if (labelIds.length) {
    await supabase.from('contact_tag_mapping').insert(
      labelIds.map(tag_id => ({ contact_id: contactId, tag_id }))
    )
  }
  revalidatePath('/dashboard/subscribers')
}

export async function deleteSubscriber(formData: FormData) {
  const { supabase } = await getCtx()
  const id = formData.get('id') as string
  await supabase.from('contacts').delete().eq('id', id)
  revalidatePath('/dashboard/subscribers')
}

export async function optOutSubscriber(formData: FormData) {
  const { supabase } = await getCtx()
  const id = formData.get('id') as string
  await supabase.from('contacts').update({ opted_out: true, opted_out_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/subscribers')
}

export async function optInSubscriber(formData: FormData) {
  const { supabase } = await getCtx()
  const id = formData.get('id') as string
  await supabase.from('contacts').update({ opted_out: false, opted_out_at: null }).eq('id', id)
  revalidatePath('/dashboard/subscribers')
}

// ─── Bulk import ──────────────────────────────────────────────────
export async function bulkImportSubscribers(
  rows: { name: string; phone: string }[],
  labelIds: string[] = []
): Promise<{ created: number; updated: number; skipped: number; errors: number }> {
  const { supabase, workspaceId } = await getCtx()
  let created = 0, updated = 0, skipped = 0, errors = 0

  for (const row of rows) {
    const phone = row.phone.trim().replace(/\s+/g, '')
    if (!phone) { skipped++; continue }

    try {
      const { data: existing } = await supabase
        .from('contacts').select('id')
        .eq('workspace_id', workspaceId).eq('phone_number', phone).maybeSingle()

      let contactId: string

      if (existing) {
        contactId = existing.id
        if (row.name.trim()) {
          await supabase.from('contacts').update({ name: row.name.trim() }).eq('id', contactId)
        }
        updated++
      } else {
        const { data: newContact, error } = await supabase
          .from('contacts')
          .insert({ workspace_id: workspaceId, phone_number: phone, name: row.name.trim() || null })
          .select('id').single()
        if (error || !newContact) { errors++; continue }
        contactId = newContact.id
        created++
      }

      if (labelIds.length) {
        await mergeLabels(supabase, contactId, labelIds)
      }
    } catch {
      errors++
    }
  }

  revalidatePath('/dashboard/subscribers')
  return { created, updated, skipped, errors }
}

// ─── Helpers ──────────────────────────────────────────────────────
async function mergeLabels(supabase: ReturnType<typeof createClient>, contactId: string, labelIds: string[]): Promise<number> {
  if (!labelIds.length) return 0
  const { data: existing } = await supabase
    .from('contact_tag_mapping').select('tag_id').eq('contact_id', contactId)
  const existingSet = new Set((existing ?? []).map((e: any) => e.tag_id))
  const newIds = labelIds.filter(id => !existingSet.has(id))
  if (newIds.length) {
    await supabase.from('contact_tag_mapping').insert(
      newIds.map(tag_id => ({ contact_id: contactId, tag_id }))
    )
  }
  return newIds.length
}
