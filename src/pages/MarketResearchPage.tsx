import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, ArrowUp, ArrowDown, Plus, Maximize2, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'

// ─── Series metadata ──────────────────────────────────────────────────────────

const SERIES_INFO: Record<string, { label: string; color: string; description: string; source: string }> = {
  SOFR:        { label: 'SOFR',         color: '#0D9488', description: 'Secured Overnight Financing Rate',    source: 'FRED / NY Federal Reserve' },
  DGS10:       { label: '10Y Treasury', color: '#7C3AED', description: '10-Year US Treasury Yield',           source: 'FRED / US Treasury' },
  DGS5:        { label: '5Y Treasury',  color: '#2563EB', description: '5-Year US Treasury Yield',            source: 'FRED / US Treasury' },
  DGS2:        { label: '2Y Treasury',  color: '#D97706', description: '2-Year US Treasury Yield',            source: 'FRED / US Treasury' },
  DGS30:       { label: '30Y Treasury', color: '#0EA5E9', description: '30-Year US Treasury Yield',           source: 'FRED / US Treasury' },
  MORTGAGE30US:{ label: '30Y Mortgage', color: '#DC2626', description: '30-Year Fixed Mortgage Rate',         source: 'FRED / Freddie Mac' },
  DPCREDIT:    { label: 'Prime Rate',   color: '#059669', description: 'Bank Prime Loan Rate',                source: 'FRED / Federal Reserve' },
  CPILFESL:    { label: 'Core CPI',     color: '#A855F7', description: 'Core Consumer Price Index YoY',       source: 'FRED / BLS' },
  UNRATE:      { label: 'Unemployment', color: '#F59E0B', description: 'US Unemployment Rate',                source: 'FRED / BLS' },
  GDP:         { label: 'GDP Growth',   color: '#10B981', description: 'Real GDP Growth Rate',                source: 'FRED / BEA' },
}

const TREASURY_ROWS = [
  { term: '2-Year',  seriesId: 'DGS2',  change: +0.02 },
  { term: '5-Year',  seriesId: 'DGS5',  change: -0.05 },
  { term: '10-Year', seriesId: 'DGS10', change: +0.03 },
  { term: '30-Year', seriesId: 'DGS30', change: -0.01 },
]

const MORTGAGE_RATES = [
  { type: '30-Year Fixed', seriesId: 'MORTGAGE30US', rate: 6.78, change: -0.05 },
  { type: '15-Year Fixed', seriesId: null,            rate: 6.21, change: -0.03 },
  { type: '5/1 ARM',       seriesId: null,            rate: 6.05, change: +0.02 },
  { type: '7/1 ARM',       seriesId: null,            rate: 6.31, change: -0.01 },
]

const MOCK_COMPS = [
  { date: '2026-02-15', property: 'Sunset Apartments',    location: 'Austin, TX',    price: 12500000, size: 85000,  capRate: 5.2 },
  { date: '2026-01-28', property: 'Greenway Office Park', location: 'Dallas, TX',    price: 8750000,  size: 62000,  capRate: 6.8 },
  { date: '2026-01-10', property: 'Harbor Industrial',    location: 'Houston, TX',   price: 5200000,  size: 110000, capRate: 5.9 },
  { date: '2025-12-20', property: 'Midtown Retail Center',location: 'Nashville, TN', price: 3800000,  size: 28000,  capRate: 6.5 },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function ChangeCell({ value }: { value: number }) {
  const pos = value >= 0
  return (
    <span className={cn('flex items-center gap-0.5', pos ? 'text-emerald-400' : 'text-red-400')}>
      {pos ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(2)}
    </span>
  )
}

function SourceNote({ text }: { text: string }) {
  return <p className="mt-2 text-[10px] text-muted-foreground/60">Source: {text}</p>
}

const CHART_TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 11,
}

// ─── Drill-down modal ─────────────────────────────────────────────────────────

function DrillDownModal({
  seriesId,
  allRates,
  onClose,
}: {
  seriesId: string
  allRates: any[]
  onClose: () => void
}) {
  const info = SERIES_INFO[seriesId]
  const history = allRates
    .filter(r => r.series_id === seriesId)
    .slice(0, 365)
    .reverse()
    .map(r => ({ date: r.observation_date.slice(0, 10), value: r.value }))

  const values = history.map(h => h.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const current = values[values.length - 1] ?? null
  const prev = values[values.length - 2] ?? null
  const delta = current !== null && prev !== null ? current - prev : null

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg">{info?.label ?? seriesId}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{info?.description}</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Current', val: current !== null ? `${current.toFixed(3)}%` : '—' },
            { label: 'Change', val: delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}%` : '—', color: delta !== null ? (delta >= 0 ? 'text-emerald-400' : 'text-red-400') : '' },
            { label: '52W High', val: `${max.toFixed(3)}%` },
            { label: '52W Low',  val: `${min.toFixed(3)}%` },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className={cn('text-base font-bold font-mono mt-0.5', s.color)} style={{ color: !s.color ? info?.color : undefined }}>
                {s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Full chart */}
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history} margin={{ left: 10, right: 10, top: 10 }}>
              <defs>
                <linearGradient id="drillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={info?.color ?? '#0D9488'} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={info?.color ?? '#0D9488'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} interval={Math.floor(history.length / 8)} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(3)}%`, info?.label ?? seriesId]}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              {current !== null && (
                <ReferenceLine y={current} stroke={info?.color} strokeDasharray="4 2" strokeOpacity={0.5} />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={info?.color ?? '#0D9488'}
                fill="url(#drillGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No historical data in database yet — click Refresh Data to fetch from FRED.
          </div>
        )}

        <SourceNote text={info?.source ?? 'FRED / Federal Reserve Economic Data'} />
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketResearchPage() {
  const [compDialogOpen, setCompDialogOpen] = useState(false)
  const [userComps, setUserComps] = useState<typeof MOCK_COMPS>([])
  const [compForm, setCompForm] = useState({ date: '', property: '', location: '', price: '', size: '', capRate: '' })
  const [drillSeries, setDrillSeries] = useState<string | null>(null)

  const { data: rates = [], refetch } = useQuery({
    queryKey: ['market-rates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('market_rates')
        .select('*')
        .order('observation_date', { ascending: false })
        .limit(5000)
      return data ?? []
    },
  })

  const { data: sofr = [] } = useQuery({
    queryKey: ['sofr-curve'],
    queryFn: async () => {
      const { data } = await supabase.from('sofr_forward_curve').select('*').order('tenor_months')
      return data ?? []
    },
  })

  const fetchLatest = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-rates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    refetch()
  }

  // Latest value per series
  const latest = rates.reduce<Record<string, any>>((acc, row) => {
    if (!acc[row.series_id]) acc[row.series_id] = row
    return acc
  }, {})

  // Mortgage trend from real data, fallback to synthetic
  const mortgageTrend = (() => {
    const live = rates
      .filter(r => r.series_id === 'MORTGAGE30US')
      .slice(0, 52)
      .reverse()
      .map(r => ({
        date: r.observation_date.slice(0, 10),
        '30Y Fixed': r.value,
      }))
    return live.length > 0 ? live : []
  })()

  // Treasury yield curve (snapshot)
  const treasuryChartData = [
    { term: '2Y',  rate: latest['DGS2']?.value  ?? null },
    { term: '5Y',  rate: latest['DGS5']?.value  ?? null },
    { term: '10Y', rate: latest['DGS10']?.value ?? null },
    { term: '30Y', rate: latest['DGS30']?.value ?? null },
  ].filter(d => d.rate !== null)

  // SOFR 90-day history
  const sofrHistory = rates
    .filter(r => r.series_id === 'SOFR')
    .slice(0, 90)
    .reverse()
    .map(r => ({ date: r.observation_date.slice(0, 10), SOFR: r.value }))

  const allComps = [...userComps, ...MOCK_COMPS]

  const addComp = () => {
    if (!compForm.property) return
    setUserComps(prev => [{
      date:    compForm.date || new Date().toISOString().slice(0, 10),
      property: compForm.property,
      location: compForm.location,
      price:   parseFloat(compForm.price)   || 0,
      size:    parseFloat(compForm.size)    || 0,
      capRate: parseFloat(compForm.capRate) || 0,
    }, ...prev])
    setCompForm({ date: '', property: '', location: '', price: '', size: '', capRate: '' })
    setCompDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Data</h1>
          <p className="text-sm text-muted-foreground">Live rates and comparable transaction data — click any card to drill in</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchLatest}>
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="public">
        <TabsList>
          <TabsTrigger value="public">Public Markets</TabsTrigger>
          <TabsTrigger value="comps">Comparable Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="public" className="mt-4 space-y-6">

          {/* ── Treasury + Mortgage side by side ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Treasury yield curve */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Treasury Yield Curve</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDrillSeries('DGS10')} title="Drill into 10Y Treasury">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={treasuryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="term" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Yield']} contentStyle={CHART_TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2} dot={{ r: 4, fill: '#2563EB' }} />
                  </LineChart>
                </ResponsiveContainer>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-1 text-left text-muted-foreground font-medium">Term</th>
                      <th className="py-1 text-right text-muted-foreground font-medium">Rate</th>
                      <th className="py-1 text-right text-muted-foreground font-medium">Chg</th>
                      <th className="py-1 w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {TREASURY_ROWS.map(r => (
                      <tr
                        key={r.term}
                        className="border-b border-border last:border-0 cursor-pointer hover:bg-secondary/40"
                        onClick={() => setDrillSeries(r.seriesId)}
                      >
                        <td className="py-1.5">{r.term}</td>
                        <td className="py-1.5 text-right font-mono">{(latest[r.seriesId]?.value ?? '—') !== '—' ? `${(latest[r.seriesId].value).toFixed(2)}%` : '—'}</td>
                        <td className="py-1.5 text-right"><ChangeCell value={r.change} /></td>
                        <td className="py-1.5 text-right text-muted-foreground/40 text-[10px]">↗</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <SourceNote text="FRED / US Treasury" />
              </CardContent>
            </Card>

            {/* Mortgage rates */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Mortgage Rates</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDrillSeries('MORTGAGE30US')} title="Drill into 30Y Mortgage">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {mortgageTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={mortgageTrend}>
                      <defs>
                        <linearGradient id="mortGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#DC2626" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} interval={Math.floor(mortgageTrend.length / 5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '30Y Fixed']} contentStyle={CHART_TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="30Y Fixed" stroke="#DC2626" fill="url(#mortGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[140px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    No data yet — click Refresh Data
                  </div>
                )}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-1 text-left text-muted-foreground font-medium">Type</th>
                      <th className="py-1 text-right text-muted-foreground font-medium">Rate</th>
                      <th className="py-1 text-right text-muted-foreground font-medium">Chg</th>
                      <th className="py-1 w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {MORTGAGE_RATES.map(r => (
                      <tr
                        key={r.type}
                        className={cn('border-b border-border last:border-0', r.seriesId && 'cursor-pointer hover:bg-secondary/40')}
                        onClick={() => r.seriesId && setDrillSeries(r.seriesId)}
                      >
                        <td className="py-1.5">{r.type}</td>
                        <td className="py-1.5 text-right font-mono">
                          {r.seriesId && latest[r.seriesId]
                            ? `${latest[r.seriesId].value.toFixed(2)}%`
                            : `${r.rate.toFixed(2)}%`}
                        </td>
                        <td className="py-1.5 text-right"><ChangeCell value={r.change} /></td>
                        <td className="py-1.5 text-right text-muted-foreground/40 text-[10px]">{r.seriesId ? '↗' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <SourceNote text="FRED / Freddie Mac Primary Mortgage Market Survey" />
              </CardContent>
            </Card>
          </div>

          {/* ── Rate cards — click to drill ── */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Click any card to view full history</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(SERIES_INFO).map(([id, info]) => {
                const row = latest[id]
                return (
                  <button
                    key={id}
                    onClick={() => setDrillSeries(id)}
                    className="group text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-opacity-60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ '--hover-color': info.color } as any}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-xs text-muted-foreground">{info.label}</p>
                      <Maximize2 className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </div>
                    <p className="mt-1.5 text-2xl font-bold font-mono" style={{ color: info.color }}>
                      {row ? `${row.value.toFixed(2)}%` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{row?.observation_date?.slice(0, 10) ?? 'No data'}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60 leading-snug">{info.description}</p>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/50">Source: FRED / Federal Reserve Economic Data</p>
          </div>

          {/* ── SOFR 90-day trend ── */}
          {sofrHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">SOFR — 90 Day Trend</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDrillSeries('SOFR')} title="Drill into SOFR">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sofrHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} interval={14} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, 'SOFR']} contentStyle={CHART_TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="SOFR" stroke="#0D9488" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                <SourceNote text="FRED / NY Federal Reserve" />
              </CardContent>
            </Card>
          )}

          {/* ── SOFR Forward Curve ── */}
          {sofr.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">SOFR Forward Curve</CardTitle>
                <CardDescription className="text-xs">Implied forward rates by tenor — used for floating-rate debt modeling</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sofr.map((s: any) => ({ tenor: `${s.tenor_months}mo`, rate: s.rate }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="tenor" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, 'Forward Rate']} contentStyle={CHART_TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="rate" stroke="#7C3AED" dot={{ r: 4, fill: '#7C3AED' }} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                <SourceNote text="CME Group / SOFR futures implied curve" />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Comparable Transactions ── */}
        <TabsContent value="comps" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Comparable Transactions</CardTitle>
                  <CardDescription className="text-xs">Recent deal data for comparable properties</CardDescription>
                </div>
                <Button variant="brand" size="sm" className="gap-2" onClick={() => setCompDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Transaction
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Property', 'Location', 'Price', 'Size (sq ft)', 'Price/sq ft', 'Cap Rate'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allComps.map((c, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                        <td className="px-4 py-2 text-xs text-muted-foreground">{c.date}</td>
                        <td className="px-4 py-2 font-medium">{c.property}</td>
                        <td className="px-4 py-2 text-muted-foreground">{c.location}</td>
                        <td className="px-4 py-2 font-mono">{formatCurrency(c.price)}</td>
                        <td className="px-4 py-2 font-mono">{c.size.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono">${c.size ? (c.price / c.size).toFixed(0) : '—'}</td>
                        <td className="px-4 py-2 font-mono text-brand-teal-light">{c.capRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Drill-down modal ── */}
      {drillSeries && (
        <DrillDownModal
          seriesId={drillSeries}
          allRates={rates}
          onClose={() => setDrillSeries(null)}
        />
      )}

      {/* ── Add comp dialog ── */}
      <Dialog open={compDialogOpen} onOpenChange={setCompDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Comparable Transaction</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {[
              { label: 'Date',                    key: 'date',     type: 'date'   },
              { label: 'Property Name',           key: 'property', type: 'text'   },
              { label: 'Location (City, State)',  key: 'location', type: 'text'   },
              { label: 'Price ($)',               key: 'price',    type: 'number' },
              { label: 'Size (sq ft)',            key: 'size',     type: 'number' },
              { label: 'Cap Rate (%)',            key: 'capRate',  type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input
                  type={type}
                  value={(compForm as any)[key]}
                  onChange={e => setCompForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompDialogOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={addComp}>Add Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
