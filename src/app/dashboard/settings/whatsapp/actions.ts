'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function disconnectWhatsApp(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspaceId = formData.get('workspace_id') as string
  if (!workspaceId) return

  await supabase.from('whatsapp_accounts').delete().eq('workspace_id', workspaceId)
  revalidatePath('/dashboard/settings/whatsapp')
  redirect('/dashboard/settings/whatsapp?success=WhatsApp disconnected')
}

export async function saveWhatsAppSettings(formData: FormData) {
  const supabase = createClient()

  const workspaceId = formData.get('workspace_id') as string
  const phoneNumberId = formData.get('phone_number_id') as string
  const wabaId = formData.get('waba_id') as string
  const accessToken = formData.get('access_token') as string

  if (!workspaceId || !phoneNumberId || !wabaId || !accessToken) {
    redirect('/dashboard/settings/whatsapp?error=Missing required fields')
  }

  const encryptionKey = process.env.WA_TOKEN_ENCRYPTION_KEY || 'default_dev_secret_key_change_me_in_prod!'

  try {
    const { error } = await supabase.rpc('save_whatsapp_credentials', {
      p_workspace_id: workspaceId,
      p_phone_number_id: phoneNumberId,
      p_waba_id: wabaId,
      p_access_token: accessToken,
      p_encryption_key: encryptionKey,
    })

    if (error) {
      redirect('/dashboard/settings/whatsapp?error=' + encodeURIComponent(error.message))
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    redirect('/dashboard/settings/whatsapp?error=' + encodeURIComponent(err?.message ?? 'Unexpected error'))
  }

  revalidatePath('/dashboard/settings/whatsapp')
  redirect('/dashboard/settings/whatsapp?success=Settings saved successfully')
}
