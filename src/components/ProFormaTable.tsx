import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { ProFormaYear } from '@/lib/calculators'

interface ProFormaTableProps {
  rows: ProFormaYear[]
}

interface RowDef {
  key: keyof ProFormaYear
  label: string
  highlight: boolean
  bold?: boolean
  negative?: boolean
  optional?: boolean
}

const ROW_DEFS: RowDef[] = [
  { key: 'gpi', label: 'Gross Potential Income', highlight: false },
  { key: 'vacancyLoss', label: 'Vacancy Loss', negative: true, highlight: false },
  { key: 'egi', label: 'Effective Gross Income', highlight: false, bold: true },
  { key: 'operatingExpenses', label: 'Operating Expenses', negative: true, highlight: false },
  { key: 'noi', label: 'Net Operating Income', highlight: true, bold: true },
  { key: 'debtService', label: 'Debt Service', negative: true, highlight: false },
  { key: 'cashFlow', label: 'Cash Flow Before Tax', highlight: true, bold: true },
  { key: 'exitValue', label: 'Exit Value', highlight: false, optional: true },
]

export default function ProFormaTable({ rows }: ProFormaTableProps) {
  if (!rows.length) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">No pro forma data. Set assumptions to generate.</CardContent></Card>
  )

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">10-Year Pro Forma</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-card px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-48">Line Item</th>
              {rows.map(r => (
                <th key={r.year} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground min-w-[100px]">Year {r.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_DEFS.map(({ key, label, highlight, bold, negative, optional }) => {
              const hasValues = rows.some(r => r[key] !== undefined)
              if (optional && !hasValues) return null
              return (
                <tr
                  key={key}
                  className={`border-b border-border/50 ${highlight ? 'bg-brand-teal/5' : 'hover:bg-secondary/30'}`}
                >
                  <td className={`sticky left-0 bg-inherit px-4 py-2 ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {label}
                  </td>
                  {rows.map(r => {
                    const raw = r[key] as number | undefined
                    const val = raw ?? 0
                    return (
                      <td
                        key={r.year}
                        className={`px-3 py-2 text-right font-mono text-xs ${bold ? 'font-semibold' : ''} ${negative && val > 0 ? 'text-red-400' : ''} ${key === 'cashFlow' ? (val >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}
                      >
                        {raw === undefined ? '—' : (negative ? `(${formatCurrency(Math.abs(val))})` : formatCurrency(val))}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
