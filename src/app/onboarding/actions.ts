'use server'

import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'

export async function createOrganization(formData: FormData) {
  const supabase = createClient()
  const adminClient = getAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const orgName = formData.get('org_name') as string
  const workspaceName = formData.get('workspace_name') as string

  // Use Admin Client to bypass RLS when creating initial tenant scaffolding and linking the user
  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .insert([{ name: orgName }])
    .select('id')
    .single()

  if (orgError || !org) {
    redirect('/onboarding?error=' + encodeURIComponent(orgError?.message || 'Failed to create organization'))
  }

  const { data: workspace, error: workspaceError } = await adminClient
    .from('workspaces')
    .insert([{ organization_id: org.id, name: workspaceName }])
    .select('id')
    .single()

  if (workspaceError || !workspace) {
    redirect('/onboarding?error=' + encodeURIComponent(workspaceError?.message || 'Failed to create workspace'))
  }

  const { error: memberError } = await adminClient
    .from('workspace_members')
    .insert([{ workspace_id: workspace.id, user_id: user.id, role: 'owner' }])

  if (memberError) {
     redirect('/onboarding?error=' + encodeURIComponent(memberError.message))
  }

  redirect('/dashboard')
}
