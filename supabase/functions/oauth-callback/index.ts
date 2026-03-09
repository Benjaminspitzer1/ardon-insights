/**
 * oauth-callback
 * Handles Gmail and Outlook OAuth2 flows.
 * GET ?provider=gmail  → returns OAuth authorization URL
 * POST with code=...   → exchanges code for tokens, stores in email_connections
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

const OUTLOOK_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'offline_access',
].join(' ')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') ?? 'gmail'
  const code = url.searchParams.get('code')
  const authHeader = req.headers.get('Authorization')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const userSupa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader! } } }
  )
  const { data: { user } } = await userSupa.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() })
  }

  // Return authorization URL
  if (req.method === 'GET') {
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`
    let authUrl: string

    if (provider === 'gmail') {
      const clientId = Deno.env.get('GMAIL_CLIENT_ID') ?? ''
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GMAIL_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: `${user.id}:gmail`,
      })
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    } else {
      const clientId = Deno.env.get('OUTLOOK_CLIENT_ID') ?? ''
      const tenantId = Deno.env.get('OUTLOOK_TENANT_ID') ?? 'common'
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: OUTLOOK_SCOPES,
        state: `${user.id}:outlook`,
      })
      authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`
    }

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  // Handle callback with code
  if (code) {
    const state = url.searchParams.get('state') ?? ''
    const [stateUserId, stateProvider] = state.split(':')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

    try {
      let tokenData: Record<string, unknown>
      let emailAddress: string

      if (stateProvider === 'gmail') {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        tokenData = await res.json() as Record<string, unknown>

        // Get email address
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const profile = await profileRes.json() as { email: string }
        emailAddress = profile.email
      } else {
        const res = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: Deno.env.get('OUTLOOK_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('OUTLOOK_CLIENT_SECRET') ?? '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        tokenData = await res.json() as Record<string, unknown>
        const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const me = await meRes.json() as { mail?: string; userPrincipalName?: string }
        emailAddress = me.mail ?? me.userPrincipalName ?? ''
      }

      await supabase.from('email_connections').upsert({
        user_id: stateUserId,
        provider: stateProvider,
        email: emailAddress,
        access_token: String(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? String(tokenData.refresh_token) : null,
        token_expiry: tokenData.expires_in
          ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
          : null,
        is_active: true,
      }, { onConflict: 'user_id,email' })

      // Redirect back to app
      const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
      return Response.redirect(`${appUrl}/deal-inbox?connected=true`, 302)
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: corsHeaders(),
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid request' }), {
    status: 400,
    headers: corsHeaders(),
  })
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}
