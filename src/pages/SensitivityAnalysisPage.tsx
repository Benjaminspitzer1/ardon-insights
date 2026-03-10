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

type SensParams = {
  baseNOI: number
  purchasePrice: number
  holdYears: number
  loanAmount: number
  annualDebtService: number
  equityInvested: number
}

const FALLBACK: SensParams = {
  baseNOI: 500_000,
  purchasePrice: 8_000_000,
  holdYears: 5,
  loanAmount: 5_600_000,
  annualDebtService: 380_000,
  equityInvested: 2_400_000,
}

function computeAnnualDebtService(loanAmount: number, rate: number, amortYears: number): number {
  const r = rate / 12
  const n = amortYears * 12
  if (r === 0 || n === 0) return 0
  return (loanAmount * r / (1 - Math.pow(1 + r, -n))) * 12
}

function computeIRR(exitCap: number, rentGrowth: number, p: SensParams): number {
  const cashFlows: number[] = [-p.equityInvested]
  let noi = p.baseNOI
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
  try {
    return calcIRR(cashFlows) * 100
  } catch {
    return 0
  }
}

function computeEM(exitCap: number, rentGrowth: number, p: SensParams): number {
  const cashFlows: number[] = [-p.equityInvested]
  let noi = p.baseNOI
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

const EXIT_CAPS = [5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00, 7.25, 7.50]
const RENT_GROWTHS = [1, 2, 3, 4, 5]
const LINE_COLORS = ['#0D9488', '#7C3AED', '#2563EB', '#D97706', '#DC2626']

function irrCellClass(irr: number): string {
  if (irr > 20) return 'bg-emerald-500/20 text-emerald-400'
  if (irr > 15) return 'bg-emerald-500/10 text-emerald-400'
  if (irr > 10) return 'bg-amber-500/10 text-amber-400'
  return 'bg-red-500/10 text-red-400'
}

function SliderRow({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(2)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
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

export default function SensitivityAnalysisPage() {
  const { dealId, propertyId } = useParams<{ dealId?: string; propertyId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [exitCap, setExitCap] = useState(6.5)
  const [rentGrowth, setRentGrowth] = useState(3.0)
  const [vacancyRate, setVacancyRate] = useState(5.0)
  const [overrides, setOverrides] = useState<Partial<SensParams>>({})

  const isScoped = !!(dealId || propertyId)

  // Fetch deal when on deal-scoped route
  const { data: deal } = useQuery({
    queryKey: ['deal-sensitivity', dealId],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('*').eq('id', dealId!).single()
      return data
    },
    enabled: !!dealId,
  })

  // Resolve property id from either route param or deal FK
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

  // For landing selectors
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

  // Derive params from fetched data
  const fetchedParams = useMemo<Partial<SensParams>>(() => {
    if (!property) return {}
    const totalLoan = (tranches ?? []).reduce((s: number, t: any) => s + (t.loan_amount ?? 0), 0)
    const totalDebtService = (tranches ?? []).reduce((s: number, t: any) => {
      return s + computeAnnualDebtService(t.loan_amount ?? 0, (t.rate ?? 0) / 100, t.amortization ?? 30)
    }, 0)
    return {
      baseNOI: property.noi ?? undefined,
      purchasePrice: property.purchase_price ?? deal?.asking_price ?? undefined,
      loanAmount: totalLoan > 0 ? totalLoan : undefined,
      annualDebtService: totalDebtService > 0 ? totalDebtService : undefined,
    }
  }, [property, tranches, deal])

  const set = (k: keyof SensParams) => (v: number) => setOverrides(p => ({ ...p, [k]: v }))

  // Merge: overrides win, then fetched, then fallback
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
    }
  }, [overrides, fetchedParams])

  const irrChartData = useMemo(() =>
    EXIT_CAPS.map(cap => ({
      cap: `${cap.toFixed(2)}%`,
      ...Object.fromEntries(RENT_GROWTHS.map(rg => [`${rg}% Growth`, parseFloat(computeIRR(cap, rg, params).toFixed(2))])),
    })),
    [params]
  )

  const sensitivityMatrix = useMemo(() =>
    EXIT_CAPS.map(cap =>
      RENT_GROWTHS.map(rg => parseFloat(computeIRR(cap, rg, params).toFixed(1)))
    ),
    [params]
  )

  const customData = useMemo(() =>
    RENT_GROWTHS.map(rg => ({
      growth: `${rg}%`,
      IRR: parseFloat(computeIRR(exitCap, rg, params).toFixed(2)),
      'Equity Multiple': parseFloat(computeEM(exitCap, rg, params).toFixed(2)),
    })),
    [exitCap, params]
  )

  const contextName = property?.name ?? null
  const contextBadge = dealId ? 'Deal-level' : propertyId ? 'Property-level' : null

  // Landing — no context selected
  if (!isScoped) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sensitivity Analysis</h1>
          <p className="text-sm text-muted-foreground">Select a deal or property to run a scoped analysis</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
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

      {/* Editable base parameters — always shown when scoped */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Parameters</CardTitle>
          <CardDescription className="text-xs">
            Pre-filled from your {dealId ? 'deal' : 'property'} record. Adjust any value to update the model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ParamInput label="Base NOI ($)" value={params.baseNOI} onChange={set('baseNOI')} />
            <ParamInput label="Purchase Price ($)" value={params.purchasePrice} onChange={set('purchasePrice')} />
            <ParamInput label="Loan Amount ($)" value={params.loanAmount} onChange={set('loanAmount')} />
            <ParamInput label="Annual Debt Service ($)" value={params.annualDebtService} onChange={set('annualDebtService')} />
            <ParamInput label="Equity Invested ($)" value={params.equityInvested} onChange={set('equityInvested')} />
            <ParamInput label="Hold Years" value={params.holdYears} onChange={set('holdYears')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Parameter Adjustments</CardTitle>
          <CardDescription className="text-xs">
            Base assumptions: NOI ${(params.baseNOI / 1000).toFixed(0)}K · Purchase Price ${(params.purchasePrice / 1_000_000).toFixed(1)}M · Hold {params.holdYears}Y · Equity ${(params.equityInvested / 1_000_000).toFixed(1)}M
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SliderRow label="Exit Cap Rate (%)" value={exitCap} min={3} max={12} step={0.25} onChange={setExitCap} />
          <SliderRow label="Annual Rent Growth (%)" value={rentGrowth} min={0} max={10} step={0.5} onChange={setRentGrowth} />
          <SliderRow label="Vacancy Rate (%)" value={vacancyRate} min={0} max={25} step={0.5} onChange={setVacancyRate} />
        </CardContent>
      </Card>

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
                  {RENT_GROWTHS.map((rg, i) => (
                    <Line
                      key={rg}
                      type="monotone"
                      dataKey={`${rg}% Growth`}
                      stroke={LINE_COLORS[i]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="matrix" className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Exit Cap</th>
                      {RENT_GROWTHS.map(rg => (
                        <th key={rg} className="px-3 py-2 text-center text-xs text-muted-foreground font-medium">
                          {rg}% Growth
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EXIT_CAPS.map((cap, i) => (
                      <tr key={cap} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs font-medium">{cap.toFixed(2)}%</td>
                        {sensitivityMatrix[i].map((irr, j) => (
                          <td key={j} className="px-3 py-2 text-center">
                            <span className={cn('rounded px-2 py-0.5 text-xs font-mono', irrCellClass(irr))}>
                              {irr.toFixed(1)}%
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

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
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${v}%`}
                    label={{ value: 'IRR %', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <YAxis
                    yAxisId="em"
                    orientation="right"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
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
