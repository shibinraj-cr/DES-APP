import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Radio, Plus, CheckCircle, Clock, AlertCircle, CalendarClock, Zap } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:     { label: 'Draft',     icon: Clock,         color: 'text-muted-foreground', bg: 'bg-secondary' },
  scheduled: { label: 'Scheduled', icon: CalendarClock, color: 'text-blue-400',         bg: 'bg-blue-400/15' },
  sending:   { label: 'Sending',   icon: Clock,         color: 'text-orange-400',       bg: 'bg-orange-400/15' },
  sent:      { label: 'Sent',      icon: CheckCircle,   color: 'text-green-400',        bg: 'bg-green-400/15' },
  failed:    { label: 'Failed',    icon: AlertCircle,   color: 'text-red-400',          bg: 'bg-red-400/15' },
}

export default async function BroadcastingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Broadcasting</h1>
          <p className="text-xs text-muted-foreground">Send messages to multiple subscribers at once</p>
        </div>
        <Link href="/dashboard/broadcasting/new"
          className="ml-auto flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
          <Plus className="h-3.5 w-3.5" />
          New Broadcast
        </Link>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {!broadcasts?.length ? (
            <div className="py-16 text-center">
              <Radio className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-4">No broadcasts yet</p>
              <Link href="/dashboard/broadcasting/new"
                className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Create your first broadcast
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Results</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {broadcasts.map((b: any) => {
                  const cfg = statusConfig[b.status] ?? statusConfig.draft
                  const StatusIcon = cfg.icon
                  const sentRate = b.total_recipients > 0
                    ? Math.round((b.sent_count / b.total_recipients) * 100)
                    : 0
                  return (
                    <tr key={b.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 p-1 rounded ${b.mode === 'anytime' ? 'bg-primary/10' : 'bg-blue-400/10'}`}>
                            {b.mode === 'anytime'
                              ? <Zap className="h-3 w-3 text-primary" />
                              : <Clock className="h-3 w-3 text-blue-400" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{b.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {b.template_name ? `Template: ${b.template_name}` : b.message}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {b.scheduled_at && b.status === 'scheduled' && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(b.scheduled_at), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {b.status === 'sent' || b.status === 'failed' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">{b.total_recipients} targeted</span>
                              <span className="text-green-400 font-medium">{b.sent_count} sent</span>
                              {b.failed_count > 0 && <span className="text-red-400">{b.failed_count} failed</span>}
                            </div>
                            {b.total_recipients > 0 && (
                              <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full" style={{ width: `${sentRate}%` }} />
                              </div>
                            )}
                          </div>
                        ) : b.status === 'scheduled' ? (
                          <span className="text-xs text-muted-foreground">{b.total_recipients} targeted</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
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
