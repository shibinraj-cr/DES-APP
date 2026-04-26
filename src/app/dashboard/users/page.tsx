import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { UserCog, Crown, Shield, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { inviteUser } from './actions'
import { Alert, AlertDescription } from '@/components/ui/alert'

const roleConfig: Record<string, { icon: any; color: string; label: string }> = {
  owner: { icon: Crown, color: 'text-primary', label: 'Owner' },
  admin: { icon: Shield, color: 'text-blue-400', label: 'Admin' },
  agent: { icon: User, color: 'text-muted-foreground', label: 'Agent' },
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myMembership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!myMembership?.workspace_id) redirect('/onboarding')

  const { data: members } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, created_at')
    .eq('workspace_id', myMembership.workspace_id)
    .order('created_at')

  const userIds = (members ?? []).map(m => m.user_id)
  let emailMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const adminClient = createClient()
    for (const uid of userIds) {
      const { data } = await adminClient.auth.admin.getUserById(uid).catch(() => ({ data: null }))
      if (data?.user?.email) emailMap[uid] = data.user.email
    }
  }

  const isOwnerOrAdmin = ['owner', 'admin'].includes(myMembership.role)

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">User Manager</h1>
          <p className="text-xs text-muted-foreground">{(members ?? []).length} team member{(members ?? []).length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-3xl">
        {searchParams.error && (
          <Alert variant="destructive">
            <AlertDescription>{decodeURIComponent(searchParams.error)}</AlertDescription>
          </Alert>
        )}
        {searchParams.success && (
          <Alert className="border-green-400/30 bg-green-400/5">
            <AlertDescription className="text-green-400">{decodeURIComponent(searchParams.success)}</AlertDescription>
          </Alert>
        )}

        {/* Members list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" />
              Team Members
            </h2>
          </div>
          <ul className="divide-y divide-border/50">
            {(members ?? []).map((m: any) => {
              const email = emailMap[m.user_id] || m.user_id
              const cfg = roleConfig[m.role] ?? roleConfig.agent
              const RoleIcon = cfg.icon
              const isMe = m.user_id === user.id
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-xs">{email[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {email}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary font-medium ${cfg.color}`}>
                    <RoleIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Invite form */}
        {isOwnerOrAdmin && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Invite Team Member</h2>
            <form action={inviteUser} className="flex gap-3">
              <input
                name="email"
                type="email"
                required
                placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                Send Invite
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              They'll receive a magic link to join your workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
