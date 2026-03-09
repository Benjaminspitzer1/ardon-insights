import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { calcIRR } from '@/lib/calculators'
import { cn } from '@/lib/utils'

const BASE_PARAMS = {
  baseNOI: 500_000,
  purchasePrice: 8_000_000,
  holdYears: 5,
  loanAmount: 5_600_000,
  annualDebtService: 380_000,
  equityInvested: 2_400_000,
}

function computeIRR(exitCap: number, rentGrowth: number): number {
  const cashFlows: number[] = [-BASE_PARAMS.equityInvested]
  let noi = BASE_PARAMS.baseNOI
  for (let yr = 1; yr <= BASE_PARAMS.holdYears; yr++) {
    noi = noi * (1 + rentGrowth / 100)
    const levered = noi - BASE_PARAMS.annualDebtService
    if (yr < BASE_PARAMS.holdYears) {
      cashFlows.push(levered)
    } else {
      const exitValue = noi / (exitCap / 100)
      const netSale = exitValue - BASE_PARAMS.loanAmount - exitValue * 0.02
      cashFlows.push(levered + netSale)
    }
  }
  try {
    return calcIRR(cashFlows) * 100
  } catch {
    return 0
  }
}

function computeEM(exitCap: number, rentGrowth: number): number {
  const cashFlows: number[] = [-BASE_PARAMS.equityInvested]
  let noi = BASE_PARAMS.baseNOI
  for (let yr = 1; yr <= BASE_PARAMS.holdYears; yr++) {
    noi = noi * (1 + rentGrowth / 100)
    const levered = noi - BASE_PARAMS.annualDebtService
    if (yr < BASE_PARAMS.holdYears) {
      cashFlows.push(levered)
    } else {
      const exitValue = noi / (exitCap / 100)
      const netSale = exitValue - BASE_PARAMS.loanAmount - exitValue * 0.02
      cashFlows.push(levered + netSale)
    }
  }
  const total = cashFlows.slice(1).reduce((a, b) => a + b, 0)
  return total / BASE_PARAMS.equityInvested
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

export default function SensitivityAnalysisPage() {
  const [exitCap, setExitCap] = useState(6.5)
  const [rentGrowth, setRentGrowth] = useState(3.0)
  const [vacancyRate, setVacancyRate] = useState(5.0)

  const irrChartData = useMemo(() =>
    EXIT_CAPS.map(cap => ({
      cap: `${cap.toFixed(2)}%`,
      ...Object.fromEntries(RENT_GROWTHS.map(rg => [`${rg}% Growth`, parseFloat(computeIRR(cap, rg).toFixed(2))])),
    })),
    []
  )

  const sensitivityMatrix = useMemo(() =>
    EXIT_CAPS.map(cap =>
      RENT_GROWTHS.map(rg => parseFloat(computeIRR(cap, rg).toFixed(1)))
    ),
    []
  )

  const customData = useMemo(() =>
    RENT_GROWTHS.map(rg => ({
      growth: `${rg}%`,
      IRR: parseFloat(computeIRR(exitCap, rg).toFixed(2)),
      'Equity Multiple': parseFloat(computeEM(exitCap, rg).toFixed(2)),
    })),
    [exitCap]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sensitivity Analysis</h1>
        <p className="text-sm text-muted-foreground">Model how changes in key assumptions affect returns</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Parameter Adjustments</CardTitle>
          <CardDescription className="text-xs">
            Base assumptions: NOI ${(BASE_PARAMS.baseNOI / 1000).toFixed(0)}K · Purchase Price ${(BASE_PARAMS.purchasePrice / 1_000_000).toFixed(1)}M · Hold {BASE_PARAMS.holdYears}Y · Equity ${(BASE_PARAMS.equityInvested / 1_000_000).toFixed(1)}M
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
