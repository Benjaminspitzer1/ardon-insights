/**
 * fetch-market-rates
 * Fetches 9 FRED series + SOFR forward curve and upserts into market_rates / sofr_forward_curve
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const SERIES = [
  { id: 'SOFR', name: 'Secured Overnight Financing Rate' },
  { id: 'DGS10', name: '10-Year Treasury Constant Maturity Rate' },
  { id: 'DGS5', name: '5-Year Treasury Constant Maturity Rate' },
  { id: 'DGS2', name: '2-Year Treasury Constant Maturity Rate' },
  { id: 'MORTGAGE30US', name: '30-Year Fixed Rate Mortgage Average' },
  { id: 'DPCREDIT', name: 'Bank Prime Loan Rate' },
  { id: 'CPILFESL', name: 'Consumer Price Index: All Items Less Food & Energy' },
  { id: 'UNRATE', name: 'Unemployment Rate' },
  { id: 'GDP', name: 'Gross Domestic Product' },
]

// Approximate SOFR forward curve tenors (months) — real data comes from CME
const SOFR_TENORS = [1, 3, 6, 12, 18, 24, 36, 48, 60]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const fredKey = Deno.env.get('FRED_API_KEY')
    if (!fredKey) throw new Error('FRED_API_KEY not set')

    const results: { fetched: string[]; errors: string[] } = { fetched: [], errors: [] }

    // Fetch each FRED series
    for (const series of SERIES) {
      try {
        const url = `${FRED_BASE}?series_id=${series.id}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=90`
        const res = await fetch(url)
        const json = await res.json() as { observations: { date: string; value: string }[] }

        const rows = json.observations
          .filter(o => o.value !== '.' && o.value !== '')
          .map(o => ({
            series_id: series.id,
            series_name: series.name,
            value: parseFloat(o.value),
            observation_date: o.date,
            fetched_at: new Date().toISOString(),
          }))

        if (rows.length > 0) {
          const { error } = await supabase
            .from('market_rates')
            .upsert(rows, { onConflict: 'series_id,observation_date' })
          if (error) results.errors.push(`${series.id}: ${error.message}`)
          else results.fetched.push(series.id)
        }
      } catch (err) {
        results.errors.push(`${series.id}: ${err}`)
      }
    }

    // Build approximate SOFR forward curve from latest SOFR rate
    const { data: latestSOFR } = await supabase
      .from('market_rates')
      .select('value')
      .eq('series_id', 'SOFR')
      .order('observation_date', { ascending: false })
      .limit(1)
      .single()

    if (latestSOFR) {
      const baseRate = latestSOFR.value / 100
      const sofrRows = SOFR_TENORS.map(tenor => ({
        tenor_months: tenor,
        // Simple upward slope approximation: +2bps per month
        rate: parseFloat(((baseRate + tenor * 0.0002) * 100).toFixed(4)),
        fetched_at: new Date().toISOString(),
      }))
      await supabase
        .from('sofr_forward_curve')
        .upsert(sofrRows, { onConflict: 'tenor_months' })
    }

    return new Response(JSON.stringify(results), {
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
