import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Send, ArrowLeft, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { sendMessage } from './actions'

export default async function ConversationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, status, workspace_id, contacts(name, phone_number)')
    .eq('id', params.id)
    .single()

  if (!conv) redirect('/dashboard/conversations')

  const { data: messages } = await supabase
    .from('messages')
    .select('id, direction, type, content, status, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  const contact = conv.contacts as { name?: string; phone_number: string } | null
  const displayName = contact?.name || contact?.phone_number || 'Unknown'
  const initial = displayName[0].toUpperCase()

  const statusColors: Record<string, string> = {
    open: 'bg-primary/20 text-primary border-primary/30',
    pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    resolved: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0"
        style={{ background: 'oklch(0.13 0.010 255)' }}
      >
        <Link
          href="/dashboard/conversations"
          className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">{initial}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground leading-tight">{displayName}</p>
          {contact?.name && (
            <p className="text-xs text-muted-foreground font-mono">{contact.phone_number}</p>
          )}
        </div>

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${statusColors[conv.status] || statusColors.open}`}>
          {conv.status}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'oklch(0.10 0.008 255)' }}>
        {!messages?.length ? (
          <div className="text-center text-muted-foreground text-sm py-12">No messages yet</div>
        ) : (
          messages.map(msg => {
            const isOut = msg.direction === 'outbound'
            return (
              <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-3.5 py-2.5 rounded-2xl shadow-sm ${
                  isOut
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content?.body || '[unsupported message type]'}
                  </p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    <span className="text-xs">{format(new Date(msg.created_at), 'HH:mm')}</span>
                    {isOut && <CheckCheck className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Reply form */}
      <div className="border-t border-border px-4 py-3 flex-shrink-0" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <form action={sendMessage} className="flex gap-2 items-end">
          <input type="hidden" name="conversation_id" value={conv.id} />
          <textarea
            name="message"
            placeholder="Type a message..."
            rows={1}
            required
            className="flex-1 rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors"
          />
          <Button
            type="submit"
            size="icon"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full flex-shrink-0 h-9 w-9 shadow-lg shadow-primary/20"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
