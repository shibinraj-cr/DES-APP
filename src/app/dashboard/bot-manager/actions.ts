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

// ─── Auto Reply Rules ─────────────────────────────────────────────
export async function createBotRule(formData: FormData) {
  const { supabase, workspaceId } = await getCtx()

  const triggerType = formData.get('trigger_type') as string
  const triggerValue = (formData.get('trigger_value') as string)?.trim()
  const responseMessage = (formData.get('response_message') as string)?.trim()

  if (!responseMessage) redirect('/dashboard/bot-manager?error=Response+message+is+required')

  await supabase.from('bot_rules').insert({
    workspace_id: workspaceId,
    action_type: 'reply',
    trigger_type: triggerType || 'keyword',
    trigger_value: triggerValue || null,
    response_message: responseMessage,
  })

  revalidatePath('/dashboard/bot-manager')
  redirect('/dashboard/bot-manager')
}

// ─── Sequence Activation Rules ────────────────────────────────────
export async function createSequenceRule(formData: FormData) {
  const { supabase, workspaceId } = await getCtx()

  const sequenceId = (formData.get('sequence_id') as string)?.trim()
  const triggerType = (formData.get('trigger_type') as string) || 'keyword'
  const triggerValue = (formData.get('trigger_value') as string)?.trim()
  const webhookWorkflowId = (formData.get('webhook_workflow_id') as string)?.trim() || null
  const delayValue = parseInt((formData.get('delay_value') as string) || '0', 10) || 0
  const delayUnit = (formData.get('delay_unit') as string) === 'hours' ? 'hours' : 'minutes'
  const delayMinutes = delayUnit === 'hours' ? delayValue * 60 : delayValue

  if (!sequenceId) redirect('/dashboard/bot-manager?tab=sequences&error=Select+a+sequence')
  if (triggerType === 'keyword' && !triggerValue) {
    redirect('/dashboard/bot-manager?tab=sequences&error=Keyword+is+required+for+Keyword+trigger')
  }

  await supabase.from('bot_rules').insert({
    workspace_id: workspaceId,
    action_type: 'sequence',
    trigger_type: triggerType,
    trigger_value: triggerType === 'keyword' ? (triggerValue || null) : null,
    sequence_id: sequenceId,
    response_message: null,
    delay_minutes: delayMinutes,
    webhook_workflow_id: triggerType === 'after_webhook' ? (webhookWorkflowId || null) : null,
  })

  revalidatePath('/dashboard/bot-manager')
  redirect('/dashboard/bot-manager?tab=sequences')
}

// ─── Shared ───────────────────────────────────────────────────────
export async function toggleBotRule(formData: FormData) {
  const { supabase, workspaceId } = await getCtx()
  const id = formData.get('id') as string
  const current = formData.get('is_active') === 'true'
  const tab = formData.get('tab') as string
  await supabase.from('bot_rules').update({ is_active: !current }).eq('id', id).eq('workspace_id', workspaceId)
  revalidatePath('/dashboard/bot-manager')
  redirect(tab === 'sequences' ? '/dashboard/bot-manager?tab=sequences' : '/dashboard/bot-manager')
}

export async function deleteBotRule(formData: FormData) {
  const { supabase, workspaceId } = await getCtx()
  const id = formData.get('id') as string
  const tab = formData.get('tab') as string
  await supabase.from('bot_rules').delete().eq('id', id).eq('workspace_id', workspaceId)
  revalidatePath('/dashboard/bot-manager')
  redirect(tab === 'sequences' ? '/dashboard/bot-manager?tab=sequences' : '/dashboard/bot-manager')
}
