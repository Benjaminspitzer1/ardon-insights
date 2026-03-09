/**
 * send-followup
 * Uses Claude to draft a follow-up email, then sends via Gmail or Outlook.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.78.0'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  try {
    const { email_id, tone = 'professional', instruction } = await req.json() as {
      email_id: string
      tone?: string
      instruction?: string
    }

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
    if (!user) throw new Error('Unauthorized')

    const { data: email } = await supabase
      .from('email_inbox')
      .select('*, email_connections(*)')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single()
    if (!email) throw new Error('Email not found')

    // Draft follow-up with Claude
    const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const draftResponse = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are an investment principal at a CRE private equity firm responding to an inbound deal email.

Original email:
FROM: ${email.from_name ?? email.from_email}
SUBJECT: ${email.subject}
BODY: ${email.body_text?.slice(0, 2000) ?? ''}

${instruction ? `Additional instructions: ${instruction}` : ''}

Write a ${tone} follow-up reply. Be concise (3-4 sentences max). Express genuine interest if this seems like a real deal opportunity. Ask for the OM/financials if not already provided.

Return only the email body text, no subject line, no greeting, no signature.`,
      }],
    })

    const draft = draftResponse.content[0].type === 'text' ? draftResponse.content[0].text : ''

    const connection = email.email_connections as Record<string, unknown>
    const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`

    // Send via appropriate provider
    if (connection.provider === 'gmail') {
      const raw = btoa(`To: ${email.from_email}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${draft}`)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      })
    } else {
      // Outlook — Microsoft Graph
      await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'Text', content: draft },
            toRecipients: [{ emailAddress: { address: email.from_email } }],
          },
        }),
      })
    }

    return new Response(JSON.stringify({ draft, sent: true }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
