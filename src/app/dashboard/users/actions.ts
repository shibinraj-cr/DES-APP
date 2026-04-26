'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function inviteUser(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const email = formData.get('email') as string
  if (!email?.trim()) redirect('/dashboard/users?error=Email+is+required')

  const { data: myMembership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!myMembership?.workspace_id) redirect('/onboarding')
  if (!['owner', 'admin'].includes(myMembership.role)) {
    redirect('/dashboard/users?error=You+do+not+have+permission+to+invite+users')
  }

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { workspace_id: myMembership.workspace_id, role: 'agent' },
  })

  if (error) {
    redirect(`/dashboard/users?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/dashboard/users?success=${encodeURIComponent(`Invitation sent to ${email}`)}`)
}
