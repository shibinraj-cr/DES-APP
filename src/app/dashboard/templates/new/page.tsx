import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TemplateWizard from '../TemplateWizard'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewTemplatePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const { data: sequences } = await supabase
    .from('bot_sequences').select('id, name').eq('workspace_id', workspaceId).eq('is_active', true)

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <Link href="/dashboard/templates" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New Template</h1>
          <p className="text-xs text-muted-foreground">Create a WhatsApp Business message template</p>
        </div>
      </div>
      <div className="p-6">
        <TemplateWizard sequences={sequences ?? []} />
      </div>
    </div>
  )
}
