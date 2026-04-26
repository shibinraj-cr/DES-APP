import { getAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'default_webhook_verify_token'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const adminClient = getAdminClient()

  for (const entry of (payload?.entry as unknown[]) || []) {
    const e = entry as Record<string, unknown>
    for (const change of (e?.changes as unknown[]) || []) {
      const c = change as Record<string, unknown>
      if (c.field !== 'messages') continue

      const value = c.value as Record<string, unknown>
      const metadata = value?.metadata as Record<string, string> | undefined
      const phoneNumberId = metadata?.phone_number_id

      const { data: waAccount } = await adminClient
        .from('whatsapp_accounts')
        .select('workspace_id')
        .eq('phone_number_id', phoneNumberId)
        .single()

      if (!waAccount) {
        await adminClient.from('webhooks_log').insert({
          payload: value,
          status: 'failed',
          error: `No workspace found for phone_number_id: ${phoneNumberId}`,
        })
        continue
      }

      const workspaceId = waAccount.workspace_id
      const waContacts = (value?.contacts as Record<string, unknown>[]) || []
      const inboundMsgs = (value?.messages as Record<string, unknown>[]) || []

      for (const msg of inboundMsgs) {
        const fromPhone = msg.from as string
        const waContact = waContacts.find(c => c.wa_id === fromPhone)
        const contactName = (waContact?.profile as Record<string, string> | undefined)?.name

        const { data: contact } = await adminClient
          .from('contacts')
          .upsert(
            { workspace_id: workspaceId, phone_number: fromPhone, name: contactName || null },
            { onConflict: 'workspace_id,phone_number', ignoreDuplicates: false }
          )
          .select('id')
          .single()

        if (!contact) continue

        let { data: conv } = await adminClient
          .from('conversations')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('contact_id', contact.id)
          .eq('status', 'open')
          .maybeSingle()

        if (!conv) {
          const { data: newConv } = await adminClient
            .from('conversations')
            .insert({ workspace_id: workspaceId, contact_id: contact.id, status: 'open' })
            .select('id')
            .single()
          conv = newConv
        }

        if (!conv) continue

        const msgType = msg.type as string
        const allowedTypes = ['text', 'image', 'document', 'template']
        const normalizedType = allowedTypes.includes(msgType) ? msgType : 'text'

        let content: Record<string, unknown> = {}
        if (msgType === 'text') {
          content = { body: (msg.text as Record<string, string>)?.body }
        } else if (msgType === 'image') {
          const img = msg.image as Record<string, string>
          content = { caption: img?.caption, id: img?.id }
        } else if (msgType === 'document') {
          const doc = msg.document as Record<string, string>
          content = { filename: doc?.filename, id: doc?.id }
        } else {
          content = { raw: msg[msgType] }
        }

        await adminClient.from('messages').insert({
          workspace_id: workspaceId,
          conversation_id: conv.id,
          direction: 'inbound',
          type: normalizedType,
          content,
          meta_message_id: msg.id as string,
        })

        await adminClient
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conv.id)

        // Opt-out / opt-in keyword handling
        const inboundText = (msgType === 'text' ? (msg.text as Record<string, string>)?.body : '') ?? ''
        const normalizedText = inboundText.trim().toUpperCase()
        const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END', 'OPTOUT']
        const OPT_IN_KEYWORDS = ['START', 'YES', 'SUBSCRIBE', 'OPTIN']

        if (OPT_OUT_KEYWORDS.includes(normalizedText)) {
          await adminClient.from('contacts')
            .update({ opted_out: true, opted_out_at: new Date().toISOString() })
            .eq('id', contact.id)

          const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
            p_workspace_id: workspaceId,
            p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
          })
          if (creds) {
            const reply = 'You have been unsubscribed and will no longer receive messages. Reply START to resubscribe.'
            try {
              await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access_token}` },
                body: JSON.stringify({ messaging_product: 'whatsapp', to: fromPhone, type: 'text', text: { body: reply } }),
              })
              await adminClient.from('messages').insert({
                workspace_id: workspaceId, conversation_id: conv.id,
                direction: 'outbound', type: 'text', content: { body: reply },
              })
            } catch {}
          }
          continue
        }

        if (OPT_IN_KEYWORDS.includes(normalizedText)) {
          await adminClient.from('contacts')
            .update({ opted_out: false, opted_out_at: null })
            .eq('id', contact.id)

          const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
            p_workspace_id: workspaceId,
            p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
          })
          if (creds) {
            const reply = 'You have been resubscribed and will receive messages again. Reply STOP to unsubscribe.'
            try {
              await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access_token}` },
                body: JSON.stringify({ messaging_product: 'whatsapp', to: fromPhone, type: 'text', text: { body: reply } }),
              })
              await adminClient.from('messages').insert({
                workspace_id: workspaceId, conversation_id: conv.id,
                direction: 'outbound', type: 'text', content: { body: reply },
              })
            } catch {}
          }
          continue
        }

        // Bot rules — auto reply and sequence activation
        const { data: botRules } = await adminClient
          .from('bot_rules')
          .select('trigger_type, trigger_value, response_message, action_type, sequence_id')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .order('created_at')

        if (botRules?.length) {
          const matched = botRules.find(rule => {
            if (rule.trigger_type === 'any_message') return true
            if (rule.trigger_type === 'keyword' && rule.trigger_value) {
              return inboundText.toLowerCase().includes(rule.trigger_value.toLowerCase())
            }
            return false
          })

          if (matched) {
            const { data: creds } = await adminClient.rpc('get_whatsapp_credentials', {
              p_workspace_id: workspaceId,
              p_encryption_key: process.env.WA_TOKEN_ENCRYPTION_KEY!,
            })

            // ── Auto reply ────────────────────────────────────────
            if (matched.action_type === 'reply' && matched.response_message && creds) {
              try {
                const sendRes = await fetch(
                  `https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access_token}` },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      to: fromPhone,
                      type: 'text',
                      text: { body: matched.response_message },
                    }),
                  }
                )
                if (sendRes.ok) {
                  const sendData = await sendRes.json()
                  await adminClient.from('messages').insert({
                    workspace_id: workspaceId,
                    conversation_id: conv.id,
                    direction: 'outbound',
                    type: 'text',
                    content: { body: matched.response_message },
                    meta_message_id: sendData?.messages?.[0]?.id ?? null,
                  })
                }
              } catch {}
            }

            // ── Sequence enrollment ───────────────────────────────
            if (matched.action_type === 'sequence' && matched.sequence_id) {
              try {
                const { data: seq } = await adminClient
                  .from('bot_sequences')
                  .select('flow_data')
                  .eq('id', matched.sequence_id)
                  .single()

                if (seq?.flow_data) {
                  const { nodes, edges } = seq.flow_data as { nodes: any[]; edges: any[] }

                  // Find first node after the start node
                  const startEdge = edges.find((e: any) => e.source === 'start')
                  const firstNodeId = startEdge?.target ?? null
                  const firstNode = firstNodeId ? nodes.find((n: any) => n.id === firstNodeId) : null

                  // Enroll contact — unique constraint prevents duplicate enrollment
                  await adminClient.from('sequence_contacts').upsert({
                    sequence_id: matched.sequence_id,
                    contact_id: contact.id,
                    current_node_id: firstNodeId,
                    status: 'active',
                  }, { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true })

                  // Send first node immediately if it's a text message
                  if (firstNode?.type === 'textMessage' && firstNode.data?.message && creds) {
                    const sendRes = await fetch(
                      `https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access_token}` },
                        body: JSON.stringify({
                          messaging_product: 'whatsapp',
                          to: fromPhone,
                          type: 'text',
                          text: { body: firstNode.data.message },
                        }),
                      }
                    )
                    if (sendRes.ok) {
                      const sendData = await sendRes.json()
                      await adminClient.from('messages').insert({
                        workspace_id: workspaceId,
                        conversation_id: conv.id,
                        direction: 'outbound',
                        type: 'text',
                        content: { body: firstNode.data.message },
                        meta_message_id: sendData?.messages?.[0]?.id ?? null,
                      })
                    }
                  }

                  // Send first node if it's a template message
                  if (firstNode?.type === 'templateMessage' && firstNode.data?.templateName && creds) {
                    await fetch(
                      `https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access_token}` },
                        body: JSON.stringify({
                          messaging_product: 'whatsapp',
                          to: fromPhone,
                          type: 'template',
                          template: { name: firstNode.data.templateName, language: { code: 'en' } },
                        }),
                      }
                    )
                  }
                }
              } catch {}
            }
          }
        }
      }

      await adminClient.from('webhooks_log').insert({
        workspace_id: workspaceId,
        payload: value,
        status: 'processed',
      })
    }
  }

  return NextResponse.json({ status: 'ok' })
}
