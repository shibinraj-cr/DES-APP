import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { toggleWorkflow } from '../actions'
import WorkflowBuilder from './WorkflowBuilder'
import EditableWorkflowHeader from './EditableWorkflowHeader'

export default async function WorkflowBuildPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const [{ data: workflow }, { data: allLabels }, { data: allSequences }] = await Promise.all([
    supabase
      .from('webhook_workflows')
      .select('id, name, template_name, is_active, secret_token, field_mapping, delay_minutes, conditions, condition_mode, last_payload, post_send_actions, total_targeted, total_sent, total_failed, total_skipped')
      .eq('id', params.id)
      .eq('workspace_id', workspaceId)
      .single(),
    supabase
      .from('contact_tags')
      .select('id, name, color')
      .eq('workspace_id', workspaceId)
      .order('name'),
    supabase
      .from('bot_sequences')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .order('name'),
  ])

  if (!workflow) notFound()

  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const webhookUrl = `${protocol}://${host}/api/workflow/${workflow.id}?token=${workflow.secret_token}`

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <Link href="/dashboard/webhook-workflow" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <EditableWorkflowHeader
          id={workflow.id}
          initialName={workflow.name}
          initialTemplate={workflow.template_name}
        />
        {/* Active toggle */}
        <form action={toggleWorkflow}>
          <input type="hidden" name="id" value={workflow.id} />
          <input type="hidden" name="is_active" value={String(workflow.is_active)} />
          <button type="submit" title={workflow.is_active ? 'Pause workflow' : 'Activate workflow'} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            {workflow.is_active
              ? <><ToggleRight className="h-6 w-6 text-primary" /> Active</>
              : <><ToggleLeft className="h-6 w-6" /> Paused</>}
          </button>
        </form>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-border bg-secondary/20 text-xs text-muted-foreground">
        <span>Targeted: <strong className="text-teal-400">{(workflow.total_targeted ?? 0).toLocaleString()}</strong></span>
        <span>Sent: <strong className="text-blue-400">{(workflow.total_sent ?? 0).toLocaleString()}</strong></span>
        <span>Failed: <strong className="text-red-400">{(workflow.total_failed ?? 0).toLocaleString()}</strong></span>
        <span>Skipped: <strong className="text-slate-400">{(workflow.total_skipped ?? 0).toLocaleString()}</strong></span>
      </div>

      <div className="p-6 max-w-2xl">
        <WorkflowBuilder
          workflow={{
            id: workflow.id,
            name: workflow.name,
            template_name: workflow.template_name,
            field_mapping: (workflow.field_mapping ?? {}) as any,
            delay_minutes: workflow.delay_minutes ?? 0,
            conditions: (workflow.conditions ?? []) as any,
            condition_mode: workflow.condition_mode ?? 'all',
            last_payload: (workflow.last_payload ?? null) as any,
            post_send_actions: (workflow.post_send_actions ?? {}) as any,
          }}
          webhookUrl={webhookUrl}
          allLabels={allLabels ?? []}
          allSequences={allSequences ?? []}
        />
      </div>
    </div>
  )
}
