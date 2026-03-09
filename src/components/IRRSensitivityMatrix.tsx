import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildSensitivityMatrix } from '@/lib/calculators'
import { cn } from '@/lib/utils'

interface IRRSensitivityMatrixProps {
  baseIRR: number
  baseParams: {
    purchasePrice: number
    loanAmount: number
    annualRate: number
    amortYears: number
    ioPeriod: number
    vacancyRate: number
    opexRatio: number
    holdYears: number
    exitCapRate: number
    revenueGrowth: number
    lpShare: number
  }
  equity: number
  initialNOI: number
}

const CAP_RATES = [0.045, 0.050, 0.055, 0.060, 0.065, 0.070]
const RENT_GROWTHS = [0.00, 0.01, 0.02, 0.03, 0.04, 0.05]

function irrColor(irr: number): string {
  if (irr >= 0.2) return 'bg-emerald-500/30 text-emerald-300'
  if (irr >= 0.15) return 'bg-emerald-500/15 text-emerald-400'
  if (irr >= 0.10) return 'bg-amber-500/15 text-amber-400'
  if (irr >= 0.05) return 'bg-orange-500/15 text-orange-400'
  return 'bg-red-500/20 text-red-400'
}

export default function IRRSensitivityMatrix({ baseParams, equity, initialNOI }: IRRSensitivityMatrixProps) {
  const cells = useMemo(() => {
    return buildSensitivityMatrix({
      baseParams: {
        initialNOI,
        revenueGrowth: baseParams.revenueGrowth,
        expenseGrowth: baseParams.revenueGrowth * 0.8,
        vacancyRate: baseParams.vacancyRate,
        operatingExpenseRatio: baseParams.opexRatio,
        holdYears: baseParams.holdYears,
        exitCapRate: baseParams.exitCapRate,
        loanAmount: baseParams.loanAmount,
        annualRate: baseParams.annualRate,
        amortYears: baseParams.amortYears,
        ioPeriod: baseParams.ioPeriod,
        purchasePrice: baseParams.purchasePrice,
      },
      equityInvested: equity,
      capRateRange: CAP_RATES,
      growthRange: RENT_GROWTHS,
    })
  }, [baseParams, equity, initialNOI])

  const cellMap = new Map(cells.map(c => [`${c.exitCapRate}-${c.rentGrowth}`, c]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">IRR Sensitivity Matrix</CardTitle>
        <p className="text-xs text-muted-foreground">Exit Cap Rate vs. Annual Rent Growth — LP IRR</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-right text-muted-foreground">Cap Rate ↓ / Growth →</th>
              {RENT_GROWTHS.map(g => (
                <th key={g} className="p-2 text-center font-semibold text-muted-foreground min-w-[80px]">
                  {(g * 100).toFixed(0)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAP_RATES.map(cap => (
              <tr key={cap}>
                <td className="p-2 text-right font-semibold text-muted-foreground">{(cap * 100).toFixed(1)}%</td>
                {RENT_GROWTHS.map(g => {
                  const cell = cellMap.get(`${cap}-${g}`)
                  const irr = cell?.irr ?? 0
                  return (
                    <td key={g} className={cn('p-2 text-center rounded font-mono font-semibold', irrColor(irr))}>
                      {(irr * 100).toFixed(1)}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/30 inline-block" /> &gt;20% IRR</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/15 inline-block" /> 15–20%</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500/15 inline-block" /> 10–15%</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/20 inline-block" /> &lt;10%</span>
        </div>
      </CardContent>
    </Card>
  )
}
