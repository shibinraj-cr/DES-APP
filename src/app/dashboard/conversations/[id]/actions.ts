'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function sendMessage(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const conversationId = formData.get('conversation_id') as string
  const messageBody = (formData.get('message') as string)?.trim()
  if (!conversationId || !messageBody) return

  const { data: conv } = await supabase
    .from('conversations')
    .select('workspace_id, contacts(phone_number)')
    .eq('id', conversationId)
    .single()

  if (!conv) throw new Error('Conversation not found')

  const workspaceId = conv.workspace_id
  const phoneNumber = (conv.contacts as { phone_number: string } | null)?.phone_number
  if (!phoneNumber) throw new Error('Contact phone number missing')

  const encryptionKey = process.env.WA_TOKEN_ENCRYPTION_KEY || 'default_dev_secret_key_change_me_in_prod!'

  const { data: creds, error: credsError } = await supabase.rpc('get_whatsapp_credentials', {
    p_workspace_id: workspaceId,
    p_encryption_key: encryptionKey,
  })

  if (credsError || !creds?.length) {
    throw new Error('WhatsApp credentials not configured. Go to Settings to add them.')
  }

  const { phone_number_id, access_token } = creds[0]

  const waRes = await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { preview_url: false, body: messageBody },
    }),
  })

  const waData = await waRes.json()
  if (!waRes.ok) {
    throw new Error(waData.error?.message || 'WhatsApp API request failed')
  }

  const metaMessageId = waData.messages?.[0]?.id

  const { error: insertError } = await supabase.from('messages').insert({
    workspace_id: workspaceId,
    conversation_id: conversationId,
    direction: 'outbound',
    type: 'text',
    content: { body: messageBody },
    status: 'sent',
    meta_message_id: metaMessageId,
  })

  if (insertError) throw new Error(insertError.message)

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  revalidatePath(`/dashboard/conversations/${conversationId}`)
  revalidatePath('/dashboard/conversations')
}
