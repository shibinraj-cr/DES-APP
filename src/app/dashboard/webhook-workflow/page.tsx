import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight, Check, Search, Pencil } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { createWorkflow, toggleWorkflow, deleteWorkflow } from './actions'
import CopyUrlButton from './CopyUrlButton'
import TestSendButton from './TestSendButton'
import { headers } from 'next/headers'

const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

function StatCell({
  value,
  total,
  barColor,
  textColor,
}: {
  value: number
  total: number
  barColor: string
  textColor: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <td className="px-3 py-3 text-right">
      <div className="inline-block min-w-[52px] text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className={`text-sm font-semibold ${textColor}`}>{value.toLocaleString()}</span>
          {total > 0 && <span className="text-[10px] text-muted-foreground">{pct}%</span>}
        </div>
        <div className="w-full bg-secondary/60 rounded-full h-0.5 mt-1">
          <div className={`${barColor} h-0.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    </td>
  )
}

export default async function WebhookWorkflowPage({
  searchParams,
}: {
  searchParams: { error?: string; q?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)

  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const [{ data: workflows }, { data: approvedTemplates }] = await Promise.all([
    supabase
      .from('webhook_workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('templates')
      .select('name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved'),
  ])

  const approvedSet = new Set((approvedTemplates ?? []).map((t: any) => t.name as string))

  const q = searchParams.q?.toLowerCase().trim()
  const filteredWorkflows = q
    ? (workflows ?? []).filter((wf: any) =>
        wf.name.toLowerCase().includes(q) || wf.template_name.toLowerCase().includes(q)
      )
    : (workflows ?? [])

  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Webhook Workflow</h1>
          <p className="text-xs text-muted-foreground">Trigger WhatsApp template messages from any 3rd party system</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {searchParams.error && (
          <div className="bg-red-400/10 border border-red-400/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {decodeURIComponent(searchParams.error)}
          </div>
        )}

        {/* Workflows table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 whitespace-nowrap">
              <Webhook className="h-4 w-4 text-primary" />
              Your Workflows
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({(workflows ?? []).length})
              </span>
            </h2>

            {/* Search */}
            <form method="GET" className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                name="q"
                defaultValue={searchParams.q}
                placeholder="Search by name or template…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </form>
          </div>

          {!filteredWorkflows.length ? (
            <div className="py-14 text-center">
              <Webhook className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-1">
                {q ? 'No workflows match your search' : 'No workflows yet'}
              </p>
              {!q && <p className="text-xs text-muted-foreground/60">Create one below to get your webhook URL</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflow</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Template</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-teal-400/80 uppercase tracking-wider">Targeted</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-blue-400/80 uppercase tracking-wider">Sent</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-orange-400/80 uppercase tracking-wider">Opened</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-red-400/80 uppercase tracking-wider">Failed</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-400/80 uppercase tracking-wider">Skipped</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Last Call</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Config</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredWorkflows.map((wf: any, i: number) => {
                    const webhookUrl = `${baseUrl}/api/workflow/${wf.id}?token=${wf.secret_token}`
                    const targeted = wf.total_targeted ?? 0
                    const sent = wf.total_sent ?? 0
                    const opened = wf.total_opened ?? 0
                    const failed = wf.total_failed ?? 0
                    const skipped = wf.total_skipped ?? 0
                    return (
                      <tr key={wf.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-3 py-3 text-muted-foreground text-xs">{i + 1}</td>

                        {/* Workflow name */}
                        <td className="px-3 py-3">
                          <p className="font-medium text-foreground text-sm">{wf.name}</p>
                          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">…{wf.id.slice(-8)}</p>
                        </td>

                        {/* Template */}
                        <td className="px-3 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                            {wf.template_name}
                          </span>
                          {approvedSet.has(wf.template_name) && (
                            <div className="flex items-center gap-0.5 mt-1 text-[10px] text-green-400">
                              <Check className="h-3 w-3" /> Approved
                            </div>
                          )}
                        </td>

                        {/* Toggle */}
                        <td className="px-3 py-3">
                          <form action={toggleWorkflow}>
                            <input type="hidden" name="id" value={wf.id} />
                            <input type="hidden" name="is_active" value={String(wf.is_active)} />
                            <button type="submit" title={wf.is_active ? 'Pause' : 'Activate'}>
                              {wf.is_active
                                ? <ToggleRight className="h-6 w-6 text-primary" />
                                : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                            </button>
                          </form>
                        </td>

                        {/* Stats */}
                        <td className="px-3 py-3 text-right">
                          <div className="inline-block min-w-[52px] text-right">
                            <span className="text-sm font-semibold text-teal-400">{targeted.toLocaleString()}</span>
                            <div className="w-full bg-secondary/60 rounded-full h-0.5 mt-1">
                              <div className="bg-teal-400 h-0.5 rounded-full w-full" />
                            </div>
                          </div>
                        </td>

                        <StatCell value={sent} total={targeted} barColor="bg-blue-400" textColor="text-blue-400" />
                        <StatCell value={opened} total={sent} barColor="bg-orange-400" textColor="text-orange-400" />
                        <StatCell value={failed} total={targeted} barColor="bg-red-400" textColor="text-red-400" />
                        <StatCell value={skipped} total={targeted + skipped} barColor="bg-slate-400" textColor="text-slate-400" />

                        {/* Last called */}
                        <td className="px-3 py-3 text-xs text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                          {wf.last_called_at
                            ? formatDistanceToNow(new Date(wf.last_called_at), { addSuffix: true })
                            : '—'}
                        </td>

                        {/* Config badges */}
                        <td className="px-3 py-3 hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(wf.delay_minutes ?? 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-400/15 text-orange-400">
                                {wf.delay_minutes}m delay
                              </span>
                            )}
                            {((wf.conditions ?? []) as any[]).length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-400/15 text-blue-400">
                                {(wf.conditions as any[]).length} condition{(wf.conditions as any[]).length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {(wf.field_mapping as any)?.phone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/15 text-green-400">
                                mapped
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-0.5">
                            <CopyUrlButton url={webhookUrl} />
                            <TestSendButton workflowId={wf.id} secretToken={wf.secret_token} />
                            <Link href={`/dashboard/webhook-workflow/${wf.id}`} title="Edit mapping & settings"
                              className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-primary">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <form action={deleteWorkflow}>
                              <input type="hidden" name="id" value={wf.id} />
                              <button
                                type="submit"
                                title="Delete workflow"
                                className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create workflow form */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Create Workflow
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Each workflow gets a unique secret URL you can trigger from any external system.
          </p>
          <form action={createWorkflow} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-foreground/80">Workflow Name</label>
              <input
                name="name"
                required
                placeholder="e.g. Lead Follow-Up"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-foreground/80">Template Name</label>
              <input
                name="template_name"
                required
                placeholder="e.g. welcome_msg"
                className={`${inputCls} font-mono`}
              />
            </div>
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Create Workflow
            </button>
          </form>
        </div>

        {/* Usage guide */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">How to use your webhook URL</h2>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              After creating a workflow, click the <span className="text-primary">copy</span> icon to get your webhook URL, then call it from any system:
            </p>
            <div className="bg-secondary/50 rounded-lg p-3 font-mono text-xs text-foreground/80 space-y-1">
              <p className="text-muted-foreground">{'# Send a template message to a phone number'}</p>
              <p>{'curl -X POST \\'}</p>
              <p className="pl-4">{'  "https://your-domain.com/api/workflow/<id>?token=<secret>" \\'}</p>
              <p className="pl-4">{'  -H "Content-Type: application/json" \\'}</p>
              <p className="pl-4">{"  -d '{\"phone\": \"+919876543210\", \"params\": {\"1\": \"John\"}}'"}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground/70">params</span> — optional key-value pairs for template variables ({`{{1}}`}, {`{{2}}`}, etc.)
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground/70">Skipped</span> — contacts who have opted out are automatically skipped without sending.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
