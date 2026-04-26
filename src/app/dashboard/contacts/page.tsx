import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Users } from 'lucide-react'

export default async function ContactsPage() {
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

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone_number, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-border flex items-center gap-3"
        style={{ background: 'oklch(0.13 0.010 255)' }}
      >
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Contacts</h2>
        {contacts?.length ? (
          <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {contacts.length} total
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!contacts?.length ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">No contacts yet</p>
            <p className="text-xs text-muted-foreground/60">Contacts appear automatically when messages arrive</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border sticky top-0" style={{ background: 'oklch(0.13 0.010 255)' }}>
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-secondary/40 transition-colors group">
                  <td className="px-6 py-3.5 text-foreground">
                    {contact.name ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-xs">{contact.name[0].toUpperCase()}</span>
                        </div>
                        {contact.name}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                          <span className="text-muted-foreground text-xs">{contact.phone_number[0]}</span>
                        </div>
                        <span className="text-muted-foreground">—</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-muted-foreground text-xs">{contact.phone_number}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{format(new Date(contact.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
