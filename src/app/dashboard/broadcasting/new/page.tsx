import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import NewBroadcastForm from './NewBroadcastForm'

export default async function NewBroadcastPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const [{ data: labels }, { data: templates }, { count: totalContacts }] = await Promise.all([
    supabase.from('contact_tags').select('id, name, color').eq('workspace_id', workspaceId).order('name'),
    supabase.from('templates').select('id, name').eq('workspace_id', workspaceId).eq('status', 'approved').order('name'),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('opted_out', false),
  ])

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4 flex-shrink-0" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <Link href="/dashboard/broadcasting" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New Broadcast</h1>
          <p className="text-xs text-muted-foreground">Configure your campaign and audience</p>
        </div>
      </div>

      <div className="p-6 max-w-xl">
        {searchParams.error && (
          <div className="mb-5 bg-red-400/10 border border-red-400/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {decodeURIComponent(searchParams.error)}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-6">
          <NewBroadcastForm
            allLabels={labels ?? []}
            approvedTemplates={templates ?? []}
            initialTotal={totalContacts ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
