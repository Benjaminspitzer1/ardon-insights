import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, context } = await req.json()
    // context: { type: 'deal' | 'property' | 'documents' | 'general', id?: string }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Build contextual data to ground the AI
    let contextText = ''

    if (context?.type === 'deal' && context?.id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('name, status, property_type, purchase_price, target_irr, target_em, notes')
        .eq('id', context.id)
        .single()
      const { data: rentRoll } = await supabase
        .from('rent_roll')
        .select('unit_number, unit_type, tenant_name, monthly_rent, sf, status, lease_end')
        .eq('deal_id', context.id)
        .limit(30)
      const { data: debt } = await supabase
        .from('debt_tranches')
        .select('tranche_name, loan_amount, interest_rate, amort_years, term_months, tranche_type')
        .eq('deal_id', context.id)
      if (deal) contextText += `\n\nCurrent deal: ${JSON.stringify(deal)}`
      if (rentRoll?.length) contextText += `\n\nRent roll (${rentRoll.length} units): ${JSON.stringify(rentRoll)}`
      if (debt?.length) contextText += `\n\nDebt structure: ${JSON.stringify(debt)}`
    } else if (context?.type === 'property' && context?.id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('name, address, city, state, property_type, purchase_price, sf, year_built, noi, cap_rate')
        .eq('id', context.id)
        .single()
      if (prop) contextText += `\n\nCurrent property: ${JSON.stringify(prop)}`
    }

    // Always include recently extracted docs (limited)
    const { data: docs } = await supabase
      .from('documents')
      .select('file_name, extracted_data')
      .eq('extraction_status', 'done')
      .order('created_at', { ascending: false })
      .limit(3)
    if (docs?.length) {
      const docSummary = docs.map(d => ({
        name: d.file_name,
        summary: (d.extracted_data as any)?.summary,
        property: (d.extracted_data as any)?.property?.name,
      }))
      contextText += `\n\nRecently extracted docs: ${JSON.stringify(docSummary)}`
    }

    const systemPrompt = `You are an AI investment analyst for Ardon Insights, the CRE investment platform for L3C Capital Partners.

You help users analyze commercial real estate deals, interpret financial metrics (NOI, cap rate, DSCR, LTV, IRR, equity multiple, cash-on-cash), review rent rolls, assess debt structures, evaluate waterfall distributions, and make data-driven investment decisions.

Be concise, direct, and specific. Format numbers with proper commas and symbols. Reference the context data when it is relevant. If you don't have enough data to answer precisely, say so and explain what data would help.${contextText}`

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of await stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
