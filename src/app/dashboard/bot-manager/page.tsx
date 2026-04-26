import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Bot, Plus, Trash2, ToggleLeft, ToggleRight, Workflow, MessageSquare, ExternalLink, Webhook } from 'lucide-react'
import Link from 'next/link'
import { createBotRule, toggleBotRule, deleteBotRule } from './actions'
import SequenceRuleForm from './SequenceRuleForm'

const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

function formatDelay(minutes: number): string {
  if (!minutes) return ''
  if (minutes < 60) return `after ${minutes} min`
  const h = minutes / 60
  return `after ${h % 1 === 0 ? h : h.toFixed(1)} h`
}

export default async function BotManagerPage({
  searchParams,
}: {
  searchParams: { error?: string; tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const tab = searchParams.tab === 'sequences' ? 'sequences' : 'replies'

  const [{ data: replyRules }, { data: sequenceRules }, { data: allSequences }, { data: allWorkflows }] = await Promise.all([
    supabase.from('bot_rules').select('*')
      .eq('workspace_id', workspaceId).eq('action_type', 'reply').order('created_at', { ascending: false }),
    supabase.from('bot_rules').select('*, bot_sequences(id, name, description)')
      .eq('workspace_id', workspaceId).eq('action_type', 'sequence').order('created_at', { ascending: false }),
    supabase.from('bot_sequences').select('id, name, description')
      .eq('workspace_id', workspaceId).order('name'),
    supabase.from('webhook_workflows').select('id, name')
      .eq('workspace_id', workspaceId).order('name'),
  ])

  // Build a map for quick workflow name lookup in the rule list
  const workflowMap = new Map((allWorkflows ?? []).map((w: any) => [w.id, w.name]))

  const TRIGGER_LABELS: Record<string, string> = {
    keyword: 'Keyword',
    any_message: 'Any Message',
    opt_in: 'Opt-in',
    contact_added: 'Contact Added',
    after_webhook: 'After Webhook Send',
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Bot Manager</h1>
          <p className="text-xs text-muted-foreground">Automate replies and trigger sequences from inbound messages</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6">
        <a href="/dashboard/bot-manager"
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'replies' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <MessageSquare className="h-3.5 w-3.5" />
          Auto Replies
          {(replyRules?.length ?? 0) > 0 && (
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">{replyRules!.length}</span>
          )}
        </a>
        <a href="/dashboard/bot-manager?tab=sequences"
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'sequences' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <Workflow className="h-3.5 w-3.5" />
          Sequences
          {(sequenceRules?.length ?? 0) > 0 && (
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">{sequenceRules!.length}</span>
          )}
        </a>
      </div>

      <div className="p-6 space-y-6 max-w-3xl">
        {searchParams.error && (
          <div className="bg-red-400/10 border border-red-400/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {decodeURIComponent(searchParams.error)}
          </div>
        )}

        {/* ── AUTO REPLIES TAB ── */}
        {tab === 'replies' && (<>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Add Auto Reply Rule
            </h2>
            <form action={createBotRule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Trigger Type</label>
                  <select name="trigger_type" className={inputCls}>
                    <option value="keyword">Keyword Match</option>
                    <option value="any_message">Any Message</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Keyword <span className="text-muted-foreground">(leave blank for "any")</span></label>
                  <input name="trigger_value" placeholder="e.g. hello, price, help" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Reply Message</label>
                <textarea name="response_message" required rows={3}
                  placeholder="Thanks for reaching out! We'll get back to you shortly."
                  className={`${inputCls} resize-none`}
                />
              </div>
              <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                Add Rule
              </button>
            </form>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Reply Rules ({(replyRules ?? []).filter((r: any) => r.is_active).length} active / {(replyRules ?? []).length} total)
              </h2>
            </div>
            {!replyRules?.length ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                No reply rules yet. Add one above.
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {replyRules.map((rule: any) => (
                  <li key={rule.id} className="flex items-start gap-4 px-4 py-4 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          rule.trigger_type === 'any_message' ? 'bg-blue-400/15 text-blue-400' : 'bg-primary/15 text-primary'
                        }`}>
                          {rule.trigger_type === 'any_message' ? 'Any Message' : `"${rule.trigger_value}"`}
                        </span>
                        {!rule.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Paused</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80">{rule.response_message}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <form action={toggleBotRule}>
                        <input type="hidden" name="id" value={rule.id} />
                        <input type="hidden" name="is_active" value={String(rule.is_active)} />
                        <input type="hidden" name="tab" value="replies" />
                        <button type="submit" title={rule.is_active ? 'Pause' : 'Activate'}
                          className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-primary">
                          {rule.is_active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                      </form>
                      <form action={deleteBotRule}>
                        <input type="hidden" name="id" value={rule.id} />
                        <input type="hidden" name="tab" value="replies" />
                        <button type="submit" title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors text-muted-foreground hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>)}

        {/* ── SEQUENCES TAB ── */}
        {tab === 'sequences' && (<>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Activate a Sequence
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Choose a built sequence and set the trigger that will start it.
            </p>

            {!allSequences?.length ? (
              <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
                <Workflow className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-3">No sequences built yet</p>
                <Link href="/dashboard/sequences/new"
                  className="inline-flex items-center gap-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Build a Sequence
                </Link>
              </div>
            ) : (
              <SequenceRuleForm
                allSequences={(allSequences ?? []).map((s: any) => ({ id: s.id, name: s.name, description: s.description }))}
                allWorkflows={(allWorkflows ?? []).map((w: any) => ({ id: w.id, name: w.name }))}
              />
            )}
          </div>

          {/* Active sequence rules */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Workflow className="h-4 w-4 text-primary" />
                Active Sequences ({(sequenceRules ?? []).filter((r: any) => r.is_active).length} active / {(sequenceRules ?? []).length} total)
              </h2>
            </div>
            {!sequenceRules?.length ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Workflow className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                No sequences activated yet. Assign one above.
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {sequenceRules.map((rule: any) => {
                  const seq = rule.bot_sequences
                  return (
                    <li key={rule.id} className="flex items-start gap-4 px-4 py-4 group">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${rule.is_active ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground text-sm">{seq?.name ?? 'Unknown sequence'}</p>
                          {!rule.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Paused</span>
                          )}
                        </div>
                        {seq?.description && (
                          <p className="text-xs text-muted-foreground mb-1.5">{seq.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            rule.trigger_type === 'after_webhook'
                              ? 'bg-orange-400/15 text-orange-400'
                              : rule.trigger_type === 'any_message'
                                ? 'bg-blue-400/15 text-blue-400'
                                : 'bg-primary/15 text-primary'
                          }`}>
                            {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}
                            {rule.trigger_value ? `: "${rule.trigger_value}"` : ''}
                          </span>
                          {rule.trigger_type === 'after_webhook' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-1">
                              <Webhook className="h-3 w-3" />
                              {rule.webhook_workflow_id
                                ? (workflowMap.get(rule.webhook_workflow_id) ?? 'Unknown workflow')
                                : 'Any workflow'}
                            </span>
                          )}
                          {(rule.delay_minutes ?? 0) > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              {formatDelay(rule.delay_minutes)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/dashboard/sequences/${seq?.id}`} title="Edit flow"
                          className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <form action={toggleBotRule}>
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="is_active" value={String(rule.is_active)} />
                          <input type="hidden" name="tab" value="sequences" />
                          <button type="submit" title={rule.is_active ? 'Pause' : 'Activate'}
                            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-primary">
                            {rule.is_active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                          </button>
                        </form>
                        <form action={deleteBotRule}>
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="tab" value="sequences" />
                          <button type="submit" title="Remove activation"
                            className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors text-muted-foreground hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>)}
      </div>
    </div>
  )
}
