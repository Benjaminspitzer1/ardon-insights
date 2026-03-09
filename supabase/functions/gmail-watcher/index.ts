/**
 * gmail-watcher
 * Called by Gmail Pub/Sub push notifications when new emails arrive.
 * Fetches the new message and inserts into email_inbox.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  try {
    const body = await req.json() as { message?: { data?: string } }
    if (!body.message?.data) return new Response('ok', { status: 200 })

    // Decode Pub/Sub message
    const decoded = JSON.parse(atob(body.message.data)) as {
      emailAddress: string
      historyId: string
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find active connection for this email
    const { data: connection } = await supabase
      .from('email_connections')
      .select('*')
      .eq('email', decoded.emailAddress)
      .eq('provider', 'gmail')
      .eq('is_active', true)
      .single()

    if (!connection) return new Response('ok', { status: 200 })

    // Refresh token if expired
    let accessToken = connection.access_token
    if (connection.token_expiry && new Date(connection.token_expiry) < new Date()) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
          refresh_token: connection.refresh_token ?? '',
          grant_type: 'refresh_token',
        }),
      })
      const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number }
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabase.from('email_connections').update({
          access_token: refreshData.access_token,
          token_expiry: new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString(),
        }).eq('id', connection.id)
      }
    }

    // Fetch history to get new message IDs
    const histRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${decoded.historyId}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const histJson = await histRes.json() as {
      history?: { messagesAdded?: { message: { id: string } }[] }[]
    }

    const messageIds = histJson.history?.flatMap(h =>
      (h.messagesAdded ?? []).map(m => m.message.id)
    ) ?? []

    // Fetch each message
    for (const msgId of messageIds.slice(0, 10)) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const msg = await msgRes.json() as {
          id: string
          threadId: string
          payload: {
            headers: { name: string; value: string }[]
            body?: { data?: string }
            parts?: { mimeType: string; body?: { data?: string } }[]
          }
          internalDate: string
        }

        const headers = msg.payload.headers
        const fromHeader = headers.find(h => h.name === 'From')?.value ?? ''
        const subjectHeader = headers.find(h => h.name === 'Subject')?.value ?? ''

        // Parse from header: "Name <email>" or just "email"
        const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/)
        const fromName = fromMatch ? fromMatch[1].trim().replace(/^"|"$/g, '') : null
        const fromEmail = fromMatch ? fromMatch[2] : fromHeader

        // Extract body
        let bodyText = ''
        if (msg.payload.body?.data) {
          bodyText = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
        } else if (msg.payload.parts) {
          const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain')
          if (textPart?.body?.data) {
            bodyText = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))
          }
        }

        await supabase.from('email_inbox').upsert({
          user_id: connection.user_id,
          connection_id: connection.id,
          message_id: msg.id,
          thread_id: msg.threadId,
          from_email: fromEmail,
          from_name: fromName,
          subject: subjectHeader,
          body_text: bodyText.slice(0, 50000),
          received_at: new Date(Number(msg.internalDate)).toISOString(),
          processed: false,
        }, { onConflict: 'connection_id,message_id' })
      } catch {
        // Skip individual message errors
      }
    }

    return new Response('ok', { status: 200, headers: corsHeaders() })
  } catch (err) {
    console.error('gmail-watcher error:', err)
    return new Response('ok', { status: 200 }) // Always 200 to avoid Pub/Sub retries
  }
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
