/**
 * deal-processor
 * Takes an email_inbox record, runs Claude AI to score/categorize/summarize,
 * optionally creates a deal record if score >= threshold.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.78.0'

const DEAL_SCORE_THRESHOLD = 6

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  try {
    const { email_id } = await req.json() as { email_id: string }
    if (!email_id) throw new Error('email_id required')

    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify caller owns the email
    const userSupa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader! } } }
    )
    const { data: { user } } = await userSupa.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Fetch email
    const { data: email, error: emailErr } = await supabase
      .from('email_inbox')
      .select('*')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single()
    if (emailErr || !email) throw new Error('Email not found')

    // Run Claude analysis
    const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const prompt = `You are a commercial real estate investment analyst at an institutional private equity firm.

Analyze this inbound email and determine if it represents a real estate investment opportunity.

FROM: ${email.from_name ?? email.from_email}
SUBJECT: ${email.subject}
BODY:
${email.body_text?.slice(0, 3000) ?? '(no body)'}

Respond with a JSON object (no markdown, no explanation, just valid JSON):
{
  "score": <integer 1-10, where 10 = definite deal opportunity, 1 = clearly not a deal>,
  "category": <one of: "deal", "lender", "broker", "investor", "spam", "unknown">,
  "summary": <2-3 sentence summary of the email and why it may or may not be a deal>,
  "property_name": <extracted property name or null>,
  "property_address": <extracted address or null>,
  "property_type": <one of: multifamily, office, retail, industrial, mixed_use, land, or null>,
  "asking_price": <number in dollars or null>,
  "units": <integer or null>,
  "broker_name": <extracted broker name or null>,
  "broker_email": <extracted broker email or null>
}`

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = { score: 1, category: 'unknown', summary: 'Failed to parse AI response.' }
    }

    const score = Number(parsed.score ?? 1)
    const category = String(parsed.category ?? 'unknown')
    const summary = String(parsed.summary ?? '')

    // Update email with AI analysis
    await supabase
      .from('email_inbox')
      .update({ ai_score: score, ai_category: category, ai_summary: summary, processed: true })
      .eq('id', email_id)

    // Auto-create deal if score is high enough
    let deal_id: string | null = null
    if (score >= DEAL_SCORE_THRESHOLD && parsed.property_name) {
      // Create property
      const { data: prop } = await supabase
        .from('properties')
        .insert({
          user_id: user.id,
          name: String(parsed.property_name),
          address: String(parsed.property_address ?? ''),
          city: '', state: '', zip: '',
          property_type: String(parsed.property_type ?? 'multifamily'),
          units: parsed.units ? Number(parsed.units) : null,
          status: 'pipeline',
        })
        .select()
        .single()

      if (prop) {
        const { data: deal } = await supabase
          .from('deals')
          .insert({
            property_id: prop.id,
            user_id: user.id,
            stage: 'sourced',
            priority: score >= 8 ? 'high' : 'medium',
            source: 'email',
            broker_name: parsed.broker_name ? String(parsed.broker_name) : null,
            broker_email: parsed.broker_email ? String(parsed.broker_email) : null,
            asking_price: parsed.asking_price ? Number(parsed.asking_price) : null,
            notes: summary,
          })
          .select()
          .single()

        if (deal) {
          deal_id = deal.id
          // Link email to deal
          await supabase.from('email_inbox').update({ deal_id: deal.id }).eq('id', email_id)
        }
      }
    }

    return new Response(JSON.stringify({ score, category, summary, deal_id }), {
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
