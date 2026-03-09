import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const SERIES = [
  { id: 'SOFR', label: 'SOFR' },
  { id: 'DGS10', label: '10Y UST' },
  { id: 'DGS5', label: '5Y UST' },
  { id: 'MORTGAGE30US', label: '30Y Mtg' },
]

export default function LiveRateBanner() {
  const { data: rates } = useQuery({
    queryKey: ['market-rates-banner'],
    queryFn: async () => {
      const { data } = await supabase
        .from('market_rates')
        .select('series_id, value, observation_date')
        .in('series_id', SERIES.map(s => s.id))
        .order('observation_date', { ascending: false })
      return data ?? []
    },
    staleTime: 1000 * 60 * 60,
  })

  const latestBySeriesId = rates?.reduce<Record<string, number>>((acc, row) => {
    if (!acc[row.series_id]) acc[row.series_id] = row.value
    return acc
  }, {})

  if (!latestBySeriesId || Object.keys(latestBySeriesId).length === 0) return null

  return (
    <div className="flex h-9 items-center gap-6 border-b border-border bg-card px-6 text-xs">
      <span className="font-semibold text-muted-foreground uppercase tracking-widest text-[10px]">Live Rates</span>
      {SERIES.map(({ id, label }) => {
        const val = latestBySeriesId[id]
        if (val === undefined) return null
        return (
          <div key={id} className="flex items-center gap-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono font-semibold text-brand-teal-light">{val.toFixed(2)}%</span>
          </div>
        )
      })}
    </div>
  )
}
