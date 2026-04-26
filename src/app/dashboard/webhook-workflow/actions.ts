'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getWorkspaceId() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
  return { supabase, workspaceId: members?.[0]?.workspace_id }
}

export async function createWorkflow(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) redirect('/onboarding')

  const name = (formData.get('name') as string)?.trim()
  const templateName = (formData.get('template_name') as string)?.trim()

  if (!name || !templateName) {
    redirect('/dashboard/webhook-workflow?error=Name+and+template+name+are+required')
  }

  const { data: created, error } = await supabase.from('webhook_workflows').insert({
    workspace_id: workspaceId,
    name,
    template_name: templateName,
  }).select('id').single()

  if (error || !created) {
    redirect(`/dashboard/webhook-workflow?error=${encodeURIComponent(error?.message || 'Failed')}`)
  }

  revalidatePath('/dashboard/webhook-workflow')
  redirect(`/dashboard/webhook-workflow/${created.id}`)
}

export async function toggleWorkflow(formData: FormData) {
  const { supabase } = await getWorkspaceId()
  const id = formData.get('id') as string
  const current = formData.get('is_active') === 'true'
  await supabase.from('webhook_workflows').update({ is_active: !current }).eq('id', id)
  revalidatePath('/dashboard/webhook-workflow')
}

export async function deleteWorkflow(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) return
  const id = formData.get('id') as string
  await supabase.from('webhook_workflows').delete().eq('id', id).eq('workspace_id', workspaceId)
  revalidatePath('/dashboard/webhook-workflow')
}

export async function updateWorkflow(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) return

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const templateName = (formData.get('template_name') as string)?.trim()

  if (!id || !name || !templateName) return

  await supabase.from('webhook_workflows')
    .update({ name, template_name: templateName })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  revalidatePath('/dashboard/webhook-workflow')
}

export async function saveWorkflowConfig(
  id: string,
  config: {
    fieldMapping: { phone: string; name: string; vars: Record<string, string>; formatters?: Record<string, string> }
    delayMinutes: number
    conditions: Array<{ field: string; op: string; value: string }>
    conditionMode: string
    postSendActions: { tag_id?: string; sequence_id?: string }
  }
) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) return

  await supabase.from('webhook_workflows')
    .update({
      field_mapping: config.fieldMapping,
      delay_minutes: config.delayMinutes,
      conditions: config.conditions,
      condition_mode: config.conditionMode,
      post_send_actions: config.postSendActions,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  revalidatePath(`/dashboard/webhook-workflow/${id}`)
  revalidatePath('/dashboard/webhook-workflow')
}

export async function getLastPayload(workflowId: string): Promise<Record<string, unknown> | null> {
  const { supabase } = await getWorkspaceId()
  const { data } = await supabase
    .from('webhook_workflows')
    .select('last_payload')
    .eq('id', workflowId)
    .single()
  return (data?.last_payload as Record<string, unknown>) ?? null
}
