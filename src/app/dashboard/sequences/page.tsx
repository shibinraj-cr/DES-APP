import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Workflow, Plus, ToggleLeft, ToggleRight, Trash2, Edit } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { toggleSequence, deleteSequence } from './actions'

const TRIGGER_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  quick_reply: 'Quick Reply',
  contact_added: 'Contact Added',
  opt_in: 'Opt-in',
  broadcast: 'Broadcast Sent',
}

export default async function SequencesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const { data: sequences } = await supabase
    .from('bot_sequences')
    .select('id, name, description, trigger_type, trigger_value, is_active, flow_data, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Bot Sequences</h1>
          <p className="text-xs text-muted-foreground">Visual multi-step message flows triggered automatically</p>
        </div>
        <Link
          href="/dashboard/sequences/new"
          className="ml-auto flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Sequence
        </Link>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {!sequences?.length ? (
            <div className="py-16 text-center">
              <Workflow className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-4">No sequences yet</p>
              <Link href="/dashboard/sequences/new"
                className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Create your first sequence
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sequence</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Trigger</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Nodes</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Updated</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sequences.map((seq: any) => {
                  const nodes = seq.flow_data?.nodes ?? []
                  const nodeCount = nodes.filter((n: any) => n.type !== 'start').length
                  return (
                    <tr key={seq.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/sequences/${seq.id}`} className="group">
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">{seq.name}</p>
                          {seq.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{seq.description}</p>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {TRIGGER_LABELS[seq.trigger_type] || seq.trigger_type}
                          </span>
                          {seq.trigger_value && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono">"{seq.trigger_value}"</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-foreground font-medium">{nodeCount}</span>
                        <span className="text-muted-foreground text-xs ml-1">step{nodeCount !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        <form action={toggleSequence}>
                          <input type="hidden" name="id" value={seq.id} />
                          <input type="hidden" name="is_active" value={String(seq.is_active)} />
                          <button type="submit" className="flex items-center gap-1.5 text-xs">
                            {seq.is_active
                              ? <><ToggleRight className="h-5 w-5 text-primary" /><span className="text-primary font-medium">Active</span></>
                              : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground">Paused</span></>
                            }
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/sequences/${seq.id}`} title="Edit flow"
                            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-primary transition-colors">
                            <Edit className="h-3.5 w-3.5" />
                          </Link>
                          <form action={deleteSequence}>
                            <input type="hidden" name="id" value={seq.id} />
                            <button type="submit" title="Delete"
                              className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
