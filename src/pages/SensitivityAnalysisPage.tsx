import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { calcIRR } from '@/lib/calculators'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type SensParams = {
  baseNOI: number
  purchasePrice: number
  holdYears: number
  loanAmount: number
  annualDebtService: number
  equityInvested: number
  vacancyRate: number
}

type AxisKey = 'exitCap' | 'vacancyRate' | 'rentGrowth' | 'holdYears' | 'ltv'
type MetricKey = 'irr' | 'em' | 'coc'

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK: SensParams = {
  baseNOI: 500_000,
  purchasePrice: 8_000_000,
  holdYears: 5,
  loanAmount: 5_600_000,
  annualDebtService: 380_000,
  equityInvested: 2_400_000,
  vacancyRate: 5,
}

const AXIS_CONFIGS: Record<AxisKey, { label: string; values: number[]; format: (v: number) => string }> = {
  exitCap:     { label: 'Exit Cap Rate',   values: [5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00, 7.25, 7.50], format: v => `${v.toFixed(2)}%` },
  vacancyRate: { label: 'Vacancy Rate',    values: [2, 5, 8, 10, 15],                                        format: v => `${v}%` },
  rentGrowth:  { label: 'Rent Growth',     values: [1, 2, 3, 4, 5],                                          format: v => `${v}%` },
  holdYears:   { label: 'Hold Years',      values: [3, 5, 7, 10],                                            format: v => `${v}Y` },
  ltv:         { label: 'Loan-to-Value',   values: [50, 60, 65, 70, 75, 80],                                 format: v => `${v}%` },
}

const ROW_OPTIONS: AxisKey[] = ['exitCap', 'vacancyRate', 'rentGrowth', 'holdYears']
const COL_OPTIONS: AxisKey[] = ['exitCap', 'vacancyRate', 'rentGrowth', 'ltv']

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'irr', label: 'IRR %' },
  { key: 'em',  label: 'Equity Multiple' },
  { key: 'coc', label: 'Cash-on-Cash' },
]

const EXIT_CAPS_CHART  = [5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00, 7.25, 7.50]
const RENT_GROWTHS_CHART = [1, 2, 3, 4, 5]
const LINE_COLORS = ['#0D9488', '#7C3AED', '#2563EB', '#D97706', '#DC2626']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAnnualDebtService(loanAmount: number, rate: number, amortYears: number): number {
  const r = rate / 12
  const n = amortYears * 12
  if (r === 0 || n === 0) return 0
  return (loanAmount * r / (1 - Math.pow(1 + r, -n))) * 12
}

// Vacancy reduces effective starting NOI
function computeIRR(exitCap: number, rentGrowth: number, p: SensParams): number {
  const cashFlows: number[] = [-p.equityInvested]
  let noi = p.baseNOI * (1 - p.vacancyRate / 100)
  for (let yr = 1; yr <= p.holdYears; yr++) {
    noi = noi * (1 + rentGrowth / 100)
    const levered = noi - p.annualDebtService
    if (yr < p.holdYears) {
      cashFlows.push(levered)
    } else {
      const exitValue = noi / (exitCap / 100)
      const netSale = exitValue - p.loanAmount - exitValue * 0.02
      cashFlows.push(levered + netSale)
    }
  }
  try { return calcIRR(cashFlows) * 100 } catch { return 0 }
}

function computeEM(exitCap: number, rentGrowth: number, p: SensParams): number {
  const cashFlows: number[] = [-p.equityInvested]
  let noi = p.baseNOI * (1 - p.vacancyRate / 100)
  for (let yr = 1; yr <= p.holdYears; yr++) {
    noi = noi * (1 + rentGrowth / 100)
    const levered = noi - p.annualDebtService
    if (yr < p.holdYears) {
      cashFlows.push(levered)
    } else {
      const exitValue = noi / (exitCap / 100)
      const netSale = exitValue - p.loanAmount - exitValue * 0.02
      cashFlows.push(levered + netSale)
    }
  }
  const total = cashFlows.slice(1).reduce((a, b) => a + b, 0)
  return total / p.equityInvested
}

// Year-1 cash-on-cash return (as a decimal, multiply by 100 for %)
function computeCoC(rentGrowth: number, p: SensParams): number {
  if (p.equityInvested <= 0) return 0
  const noi = p.baseNOI * (1 - p.vacancyRate / 100) * (1 + rentGrowth / 100)
  return (noi - p.annualDebtService) / p.equityInvested
}

// Apply one axis variable override to params + base slider values
function applyAxisVar(
  p: SensParams, exitCap: number, rentGrowth: number,
  key: AxisKey, val: number
): { p: SensParams; exitCap: number; rentGrowth: number } {
  switch (key) {
    case 'exitCap':     return { p, exitCap: val, rentGrowth }
    case 'rentGrowth':  return { p, exitCap, rentGrowth: val }
    case 'vacancyRate': return { p: { ...p, vacancyRate: val }, exitCap, rentGrowth }
    case 'holdYears':   return { p: { ...p, holdYears: val }, exitCap, rentGrowth }
    case 'ltv': {
      const newLoan = p.purchasePrice * val / 100
      const ratio = p.loanAmount > 0 ? newLoan / p.loanAmount : 1
      return {
        p: {
          ...p,
          loanAmount: newLoan,
          annualDebtService: p.annualDebtService * ratio,
          equityInvested: p.purchasePrice - newLoan,
        },
        exitCap,
        rentGrowth,
      }
    }
  }
}

function computeCell(
  rowKey: AxisKey, rowVal: number,
  colKey: AxisKey, colVal: number,
  baseP: SensParams, baseExitCap: number, baseRentGrowth: number,
  metric: MetricKey
): number {
  const s1 = applyAxisVar(baseP, baseExitCap, baseRentGrowth, rowKey, rowVal)
  const s2 = applyAxisVar(s1.p, s1.exitCap, s1.rentGrowth, colKey, colVal)
  if (metric === 'irr') return computeIRR(s2.exitCap, s2.rentGrowth, s2.p)
  if (metric === 'em')  return computeEM(s2.exitCap, s2.rentGrowth, s2.p)
  return computeCoC(s2.rentGrowth, s2.p) * 100
}

function cellClass(val: number, metric: MetricKey): string {
  if (metric === 'irr') {
    if (val > 20) return 'bg-emerald-500/20 text-emerald-400'
    if (val > 15) return 'bg-emerald-500/10 text-emerald-400'
    if (val > 10) return 'bg-amber-500/10 text-amber-400'
    return 'bg-red-500/10 text-red-400'
  }
  if (metric === 'em') {
    if (val > 2.5) return 'bg-emerald-500/20 text-emerald-400'
    if (val > 1.8) return 'bg-emerald-500/10 text-emerald-400'
    if (val > 1.3) return 'bg-amber-500/10 text-amber-400'
    return 'bg-red-500/10 text-red-400'
  }
  // CoC
  if (val > 12) return 'bg-emerald-500/20 text-emerald-400'
  if (val > 8)  return 'bg-emerald-500/10 text-emerald-400'
  if (val > 4)  return 'bg-amber-500/10 text-amber-400'
  return 'bg-red-500/10 text-red-400'
}

function formatCell(val: number, metric: MetricKey): string {
  if (metric === 'em')  return `${val.toFixed(2)}x`
  return `${val.toFixed(1)}%`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(2)}%</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full cursor-pointer accent-teal-500"
      />
    </div>
  )
}

function ParamInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SensitivityAnalysisPage() {
  const { dealId, propertyId } = useParams<{ dealId?: string; propertyId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [exitCap, setExitCap] = useState(6.5)
  const [rentGrowth, setRentGrowth] = useState(3.0)
  const [vacancyRate, setVacancyRate] = useState(5.0)
  const [overrides, setOverrides] = useState<Partial<Omit<SensParams, 'vacancyRate'>>>({})

  // Matrix axis & metric controls
  const [rowVar, setRowVar] = useState<AxisKey>('exitCap')
  const [colVar, setColVar] = useState<AxisKey>('rentGrowth')
  const [metric, setMetric] = useState<MetricKey>('irr')

  const isScoped = !!(dealId || propertyId)

  const { data: deal } = useQuery({
    queryKey: ['deal-sensitivity', dealId],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('*').eq('id', dealId!).single()
      return data
    },
    enabled: !!dealId,
  })

  const resolvedPropertyId = propertyId ?? deal?.property_id

  const { data: property } = useQuery({
    queryKey: ['property-sensitivity', resolvedPropertyId],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('*').eq('id', resolvedPropertyId!).single()
      return data
    },
    enabled: !!resolvedPropertyId,
  })

  const { data: tranches } = useQuery({
    queryKey: ['debt-tranches-sensitivity', resolvedPropertyId],
    queryFn: async () => {
      const { data } = await supabase.from('debt_tranches').select('*').eq('property_id', resolvedPropertyId!)
      return data ?? []
    },
    enabled: !!resolvedPropertyId,
  })

  const { data: allDeals } = useQuery({
    queryKey: ['all-deals-sens', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, properties(name)')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !isScoped && !!user,
  })

  const { data: allProperties } = useQuery({
    queryKey: ['all-properties-sens', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name').order('name', { ascending: true })
      return data ?? []
    },
    enabled: !isScoped && !!user,
  })

  const fetchedParams = useMemo<Partial<Omit<SensParams, 'vacancyRate'>>>(() => {
    if (!property) return {}
    const totalLoan = (tranches ?? []).reduce((s: number, t: any) => s + (t.loan_amount ?? 0), 0)
    const totalDebtService = (tranches ?? []).reduce((s: number, t: any) =>
      s + computeAnnualDebtService(t.loan_amount ?? 0, (t.rate ?? 0) / 100, t.amortization ?? 30), 0)
    return {
      baseNOI: property.noi ?? undefined,
      purchasePrice: property.purchase_price ?? deal?.asking_price ?? undefined,
      loanAmount: totalLoan > 0 ? totalLoan : undefined,
      annualDebtService: totalDebtService > 0 ? totalDebtService : undefined,
    }
  }, [property, tranches, deal])

  const setParam = (k: keyof Omit<SensParams, 'vacancyRate'>) => (v: number) =>
    setOverrides(p => ({ ...p, [k]: v }))

  const params: SensParams = useMemo(() => {
    const purchasePrice = overrides.purchasePrice ?? fetchedParams.purchasePrice ?? FALLBACK.purchasePrice
    const loanAmount = overrides.loanAmount ?? fetchedParams.loanAmount ?? FALLBACK.loanAmount
    return {
      baseNOI: overrides.baseNOI ?? fetchedParams.baseNOI ?? FALLBACK.baseNOI,
      purchasePrice,
      holdYears: overrides.holdYears ?? FALLBACK.holdYears,
      loanAmount,
      annualDebtService: overrides.annualDebtService ?? fetchedParams.annualDebtService ?? FALLBACK.annualDebtService,
      equityInvested: overrides.equityInvested ?? (purchasePrice - loanAmount),
      vacancyRate,
    }
  }, [overrides, fetchedParams, vacancyRate])

  // IRR chart data (exit cap x-axis, rent growth lines)
  const irrChartData = useMemo(() =>
    EXIT_CAPS_CHART.map(cap => ({
      cap: `${cap.toFixed(2)}%`,
      ...Object.fromEntries(
        RENT_GROWTHS_CHART.map(rg => [`${rg}% Growth`, parseFloat(computeIRR(cap, rg, params).toFixed(2))])
      ),
    })),
    [params]
  )

  // Dynamic sensitivity matrix
  const matrixData = useMemo(() => {
    const rowCfg = AXIS_CONFIGS[rowVar]
    const colCfg = AXIS_CONFIGS[colVar]
    return rowCfg.values.map(rv =>
      colCfg.values.map(cv =>
        parseFloat(computeCell(rowVar, rv, colVar, cv, params, exitCap, rentGrowth, metric).toFixed(
          metric === 'em' ? 2 : 1
        ))
      )
    )
  }, [rowVar, colVar, params, exitCap, rentGrowth, metric])

  const customData = useMemo(() =>
    RENT_GROWTHS_CHART.map(rg => ({
      growth: `${rg}%`,
      IRR: parseFloat(computeIRR(exitCap, rg, params).toFixed(2)),
      'Equity Multiple': parseFloat(computeEM(exitCap, rg, params).toFixed(2)),
    })),
    [exitCap, params]
  )

  const contextName  = property?.name ?? null
  const contextBadge = dealId ? 'Deal-level' : propertyId ? 'Property-level' : null

  // ─── Landing (no context) ─────────────────────────────────────────────────
  if (!isScoped) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sensitivity Analysis</h1>
          <p className="text-sm text-muted-foreground">Select a deal or property to run a scoped analysis</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Analyze a Deal</Label>
                <Select onValueChange={v => navigate(`/deal-flow/${v}/sensitivity`)}>
                  <SelectTrigger><SelectValue placeholder="Select a deal…" /></SelectTrigger>
                  <SelectContent>
                    {(allDeals ?? []).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {(d.properties as any)?.name ?? d.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Analyze a Property</Label>
                <Select onValueChange={v => navigate(`/properties/${v}/sensitivity`)}>
                  <SelectTrigger><SelectValue placeholder="Select a property…" /></SelectTrigger>
                  <SelectContent>
                    {(allProperties ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="relative">
          <div className="pointer-events-none select-none opacity-25 blur-sm">
            <Card>
              <CardHeader><CardTitle className="text-base">Key Parameter Adjustments</CardTitle></CardHeader>
              <CardContent className="h-32" />
            </Card>
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Scenario Analysis</CardTitle></CardHeader>
              <CardContent className="h-48" />
            </Card>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-md bg-card/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow">
              Select a deal or property above to unlock
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Scoped view ──────────────────────────────────────────────────────────
  const rowCfg = AXIS_CONFIGS[rowVar]
  const colCfg = AXIS_CONFIGS[colVar]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">
            Sensitivity Analysis{contextName ? ` — ${contextName}` : ''}
          </h1>
          {contextBadge && <Badge variant="secondary">{contextBadge}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Model how changes in key assumptions affect returns</p>
      </div>

      {/* Base parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Parameters</CardTitle>
          <CardDescription className="text-xs">
            Pre-filled from your {dealId ? 'deal' : 'property'} record. Adjust any value to update the model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ParamInput label="Base NOI ($)"              value={params.baseNOI}           onChange={setParam('baseNOI')} />
            <ParamInput label="Purchase Price ($)"        value={params.purchasePrice}      onChange={setParam('purchasePrice')} />
            <ParamInput label="Loan Amount ($)"           value={params.loanAmount}         onChange={setParam('loanAmount')} />
            <ParamInput label="Annual Debt Service ($)"   value={params.annualDebtService}  onChange={setParam('annualDebtService')} />
            <ParamInput label="Equity Invested ($)"       value={params.equityInvested}     onChange={setParam('equityInvested')} />
            <ParamInput label="Hold Years"                value={params.holdYears}          onChange={setParam('holdYears')} />
          </div>
        </CardContent>
      </Card>

      {/* Sliders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Parameter Adjustments</CardTitle>
          <CardDescription className="text-xs">
            Base assumptions: NOI ${(params.baseNOI / 1000).toFixed(0)}K · Price ${(params.purchasePrice / 1_000_000).toFixed(1)}M · Hold {params.holdYears}Y · Equity ${(params.equityInvested / 1_000_000).toFixed(1)}M
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SliderRow label="Exit Cap Rate (%)"    value={exitCap}     min={3}  max={12} step={0.25} onChange={setExitCap} />
          <SliderRow label="Annual Rent Growth (%)" value={rentGrowth} min={0}  max={10} step={0.5}  onChange={setRentGrowth} />
          <SliderRow label="Vacancy Rate (%)"     value={vacancyRate} min={0}  max={25} step={0.5}  onChange={setVacancyRate} />
        </CardContent>
      </Card>

      {/* Scenario tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenario Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="irr">
            <TabsList>
              <TabsTrigger value="irr">IRR Analysis</TabsTrigger>
              <TabsTrigger value="matrix">Sensitivity Table</TabsTrigger>
              <TabsTrigger value="custom">Custom Scenario</TabsTrigger>
            </TabsList>

            {/* IRR Analysis chart */}
            <TabsContent value="irr" className="mt-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={irrChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cap" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend />
                  {RENT_GROWTHS_CHART.map((rg, i) => (
                    <Line key={rg} type="monotone" dataKey={`${rg}% Growth`} stroke={LINE_COLORS[i]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            {/* Dynamic sensitivity matrix */}
            <TabsContent value="matrix" className="mt-4 space-y-4">
              {/* Axis + metric controls */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1 min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">Row Variable</Label>
                  <Select value={rowVar} onValueChange={v => setRowVar(v as AxisKey)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROW_OPTIONS.map(k => (
                        <SelectItem key={k} value={k}>{AXIS_CONFIGS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">Column Variable</Label>
                  <Select value={colVar} onValueChange={v => setColVar(v as AxisKey)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COL_OPTIONS.map(k => (
                        <SelectItem key={k} value={k}>{AXIS_CONFIGS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Show</Label>
                  <div className="flex rounded-md border border-border overflow-hidden h-8">
                    {METRIC_OPTIONS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setMetric(m.key)}
                        className={cn(
                          'px-3 text-xs transition-colors',
                          metric === m.key
                            ? 'bg-brand-teal text-white'
                            : 'text-muted-foreground hover:bg-secondary'
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">
                        {rowCfg.label} \ {colCfg.label}
                      </th>
                      {colCfg.values.map(cv => (
                        <th key={cv} className="px-3 py-2 text-center text-xs text-muted-foreground font-medium">
                          {colCfg.format(cv)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowCfg.values.map((rv, i) => (
                      <tr key={rv} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs font-medium">{rowCfg.format(rv)}</td>
                        {matrixData[i].map((val, j) => (
                          <td key={j} className="px-3 py-2 text-center">
                            <span className={cn('rounded px-2 py-0.5 text-xs font-mono', cellClass(val, metric))}>
                              {formatCell(val, metric)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Custom scenario */}
            <TabsContent value="custom" className="mt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Based on current slider: Exit Cap {exitCap.toFixed(2)}% · Vacancy {vacancyRate.toFixed(1)}%
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={customData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="growth" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                  <YAxis
                    yAxisId="irr"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `${v}%`}
                    label={{ value: 'IRR %', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <YAxis
                    yAxisId="em"
                    orientation="right"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `${v}x`}
                    label={{ value: 'Equity Multiple', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [name === 'IRR' ? `${v.toFixed(1)}%` : `${v.toFixed(2)}x`, name]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line yAxisId="irr" type="monotone" dataKey="IRR" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4, fill: '#7C3AED' }} />
                  <Line yAxisId="em" type="monotone" dataKey="Equity Multiple" stroke="#0D9488" strokeWidth={2} dot={{ r: 4, fill: '#0D9488' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
