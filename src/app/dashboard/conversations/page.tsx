import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare } from 'lucide-react'

type ConvStatus = 'open' | 'pending' | 'resolved'

const STATUS_STYLES: Record<ConvStatus, string> = {
  open: 'bg-primary/20 text-primary border border-primary/30',
  pending: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  resolved: 'bg-muted text-muted-foreground border border-border',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status as ConvStatus] || STATUS_STYLES.open
  return (
    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {status}
    </span>
  )
}

export default async function ConversationsPage() {
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

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, status, updated_at, contacts(name, phone_number)')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(50)

  const convIds = (conversations || []).map(c => c.id)
  const lastMsgMap: Record<string, { content: Record<string, string>; direction: string }> = {}

  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, content, direction')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(200)

    for (const msg of msgs || []) {
      if (!lastMsgMap[msg.conversation_id]) {
        lastMsgMap[msg.conversation_id] = msg
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
        {conversations?.length ? (
          <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {conversations.length}
          </span>
        ) : null}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {!conversations?.length ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/60">Configure WhatsApp in Settings to get started</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {conversations.map(conv => {
              const contact = conv.contacts as { name?: string; phone_number: string } | null
              const displayName = contact?.name || contact?.phone_number || 'Unknown'
              const initial = displayName[0].toUpperCase()
              const lastMsg = lastMsgMap[conv.id]
              const preview = lastMsg
                ? (lastMsg.direction === 'outbound' ? 'You: ' : '') + (lastMsg.content?.body || 'Media message')
                : 'No messages yet'

              return (
                <li key={conv.id}>
                  <Link
                    href={`/dashboard/conversations/${conv.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/50 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <span className="text-primary font-bold text-sm">{initial}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{preview}</p>
                        <StatusBadge status={conv.status} />
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
