'use server'

import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getWorkspaceId() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: m } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  return { supabase, workspaceId: m?.[0]?.workspace_id, userId: user.id }
}

export async function saveTemplateDraft(data: {
  id?: string
  name: string
  category: string
  language: string
  headerType: string
  headerText: string
  headerMediaUrl: string
  headerFilename: string
  headerVarSample: string
  body: string
  bodyVarSamples: string[]
  footer: string
  buttons: unknown[]
}) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) redirect('/onboarding')

  const components: unknown[] = []

  if (data.headerType !== 'NONE') {
    if (data.headerType === 'TEXT') {
      const comp: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: data.headerText }
      if (data.headerVarSample) comp.example = { header_text: [data.headerVarSample] }
      components.push(comp)
    } else {
      components.push({ type: 'HEADER', format: data.headerType, example: { header_handle: [data.headerMediaUrl || ''] } })
    }
  }

  if (data.body) {
    const comp: Record<string, unknown> = { type: 'BODY', text: data.body }
    const samples = data.bodyVarSamples.filter(Boolean)
    if (samples.length) comp.example = { body_text: [samples] }
    components.push(comp)
  }

  if (data.footer) components.push({ type: 'FOOTER', text: data.footer })

  if ((data.buttons as unknown[]).length) {
    components.push({ type: 'BUTTONS', buttons: data.buttons })
  }

  const payload = {
    workspace_id: workspaceId,
    name: data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    category: data.category,
    language: data.language,
    components,
    header_type: data.headerType,
    footer: data.footer,
    buttons: data.buttons,
    status: 'draft',
  }

  if (data.id) {
    const { error } = await supabase.from('templates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', data.id)
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/templates')
    return { id: data.id }
  } else {
    const { data: row, error } = await supabase.from('templates').insert(payload).select('id').single()
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/templates')
    return { id: row.id }
  }
}

export async function submitTemplateToMeta(templateId: string) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) redirect('/onboarding')

  const { data: template } = await supabase
    .from('templates')
    .select('name, category, language, components')
    .eq('id', templateId)
    .single()

  if (!template) throw new Error('Template not found')

  const adminClient = getAdminClient()
  const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
    p_workspace_id: workspaceId,
    p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
  })

  if (!creds?.[0]) throw new Error('WhatsApp not configured')

  const { access_token } = creds[0]
  const { data: waAccount } = await adminClient
    .from('whatsapp_accounts')
    .select('waba_id')
    .eq('workspace_id', workspaceId)
    .single()

  if (!waAccount?.waba_id) throw new Error('WhatsApp Business Account ID not found')

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${waAccount.waba_id}/message_templates`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components,
      }),
    }
  )

  const result = await res.json()

  if (!res.ok) {
    await supabase.from('templates').update({
      status: 'rejected',
      rejection_reason: result.error?.message || 'Meta rejected the template',
      updated_at: new Date().toISOString(),
    }).eq('id', templateId)
    throw new Error(result.error?.message || 'Meta API error')
  }

  await supabase.from('templates').update({
    meta_template_id: result.id,
    status: 'pending',
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  }).eq('id', templateId)

  revalidatePath('/dashboard/templates')
}

export async function refreshTemplateStatus(templateId: string) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) return

  const { data: template } = await supabase
    .from('templates')
    .select('meta_template_id, name')
    .eq('id', templateId)
    .single()

  if (!template?.meta_template_id) return

  const adminClient = getAdminClient()
  const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
    p_workspace_id: workspaceId,
    p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
  })
  if (!creds?.[0]) return

  const { access_token } = creds[0]
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${template.meta_template_id}?fields=name,status,rejected_reason`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )

  if (!res.ok) return
  const result = await res.json()

  await supabase.from('templates').update({
    status: result.status?.toLowerCase() || 'pending',
    rejection_reason: result.rejected_reason || null,
    updated_at: new Date().toISOString(),
  }).eq('id', templateId)

  revalidatePath('/dashboard/templates')
}

export async function deleteTemplate(templateId: string) {
  const { supabase } = await getWorkspaceId()
  await supabase.from('templates').delete().eq('id', templateId)
  revalidatePath('/dashboard/templates')
  redirect('/dashboard/templates')
}
