'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getWorkspaceId() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: m } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  return { supabase, workspaceId: m?.[0]?.workspace_id }
}

export async function createSequence(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) redirect('/onboarding')

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  if (!name) redirect('/dashboard/sequences/new?error=Name+is+required')

  const { data: seq, error } = await supabase.from('bot_sequences').insert({
    workspace_id: workspaceId,
    name,
    description: description || null,
    flow_data: {
      nodes: [{
        id: 'start',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Sequence starts here' },
        deletable: false,
      }],
      edges: [],
    },
  }).select('id').single()

  if (error || !seq) redirect(`/dashboard/sequences/new?error=${encodeURIComponent(error?.message || 'Failed')}`)

  redirect(`/dashboard/sequences/${seq.id}`)
}

export async function saveSequenceFlow(sequenceId: string, flowData: unknown) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) return
  const { error } = await supabase.from('bot_sequences').update({
    flow_data: flowData,
  }).eq('id', sequenceId).eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/sequences/${sequenceId}`)
  revalidatePath('/dashboard/sequences')
}

export async function toggleSequence(formData: FormData) {
  const { supabase } = await getWorkspaceId()
  const id = formData.get('id') as string
  const current = formData.get('is_active') === 'true'
  await supabase.from('bot_sequences').update({ is_active: !current }).eq('id', id)
  revalidatePath('/dashboard/sequences')
}

export async function deleteSequence(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspaceId()
  if (!workspaceId) redirect('/onboarding')
  const id = formData.get('id') as string
  await supabase.from('bot_sequences').delete().eq('id', id).eq('workspace_id', workspaceId)
  revalidatePath('/dashboard/sequences')
  redirect('/dashboard/sequences')
}
