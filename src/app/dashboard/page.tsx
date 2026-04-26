import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { MessageSquare, Users, Send, TrendingUp, Clock, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', user.id)
    .limit(1)

  const workspaceId = members?.[0]?.workspace_id
  const workspaceName = (members?.[0]?.workspaces as { name: string } | null)?.name || 'Your Workspace'
  if (!workspaceId) redirect('/onboarding')

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalContacts },
    { count: newContactsMonth },
    { count: newContactsWeek },
    { count: openConversations },
    { count: totalMessages },
    { count: todayMessages },
    { data: recentConversations },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', monthStart),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', weekStart),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'open'),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', todayStart),
    supabase.from('conversations').select('id, status, updated_at, contacts(name, phone_number)').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(5),
  ])

  const stats = [
    {
      label: 'Total Subscribers',
      value: (totalContacts ?? 0).toLocaleString(),
      sub: `+${newContactsMonth ?? 0} this month`,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
    },
    {
      label: 'Open Conversations',
      value: (openConversations ?? 0).toLocaleString(),
      sub: 'Awaiting reply',
      icon: MessageSquare,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
    },
    {
      label: 'Messages Today',
      value: (todayMessages ?? 0).toLocaleString(),
      sub: `${(totalMessages ?? 0).toLocaleString()} total`,
      icon: Send,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      border: 'border-green-400/20',
    },
    {
      label: 'New This Week',
      value: (newContactsWeek ?? 0).toLocaleString(),
      sub: 'New contacts',
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Top bar */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome back, <span className="text-primary font-medium">{workspaceName}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1.5 text-xs text-muted-foreground border border-border">
            <Users className="h-3 w-3 text-primary" />
            <span className="text-primary font-medium">{(totalContacts ?? 0).toLocaleString()}</span>
            <span>Subscribers</span>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1.5 text-xs text-muted-foreground border border-border">
            <MessageSquare className="h-3 w-3 text-blue-400" />
            <span className="text-blue-400 font-medium">{(totalMessages ?? 0).toLocaleString()}</span>
            <span>Messages</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, sub, icon: Icon, color, bg, border }) => (
            <div key={label} className={`bg-card border ${border} rounded-xl p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs font-medium text-foreground/70 mt-0.5">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Recent conversations */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Conversations
            </h2>
            <Link href="/dashboard/conversations" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!recentConversations?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No conversations yet</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {recentConversations.map(conv => {
                const contact = conv.contacts as { name?: string; phone_number: string } | null
                const displayName = contact?.name || contact?.phone_number || 'Unknown'
                const statusColor = conv.status === 'open' ? 'text-primary bg-primary/15' : conv.status === 'pending' ? 'text-orange-400 bg-orange-400/15' : 'text-muted-foreground bg-secondary'
                return (
                  <li key={conv.id}>
                    <Link href={`/dashboard/conversations/${conv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-xs">{displayName[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{conv.status}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Send Broadcast', href: '/dashboard/broadcasting/new', icon: Send, desc: 'Message all subscribers' },
            { label: 'Add Bot Rule', href: '/dashboard/bot-manager', icon: CheckCheck, desc: 'Automate replies' },
            { label: 'View Subscribers', href: '/dashboard/subscribers', icon: Users, desc: 'Manage contacts' },
          ].map(({ label, href, icon: Icon, desc }) => (
            <Link key={href} href={href} className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group">
              <Icon className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium text-foreground group-hover:text-primary">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
