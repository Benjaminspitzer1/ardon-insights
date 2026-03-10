import { useQuery } from '@tanstack/react-query'
import { Receipt, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pct(n: number | null | undefined) {
  if (n == null) return '—'
  return (n * 100).toFixed(1) + '%'
}

// Expense ratio = operating_expenses / gross_rental_income
function expenseRatio(opex: number | null, gri: number | null) {
  if (!opex || !gri || gri === 0) return null
  return opex / gri
}

export default function OperatingExpensesPage() {
  const { user } = useAuth()

  const { data: properties } = useQuery({
    queryKey: ['properties-opex', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name, address, city, state, gross_rental_income, operating_expenses, vacancy_rate, sf')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const totalOpEx = properties?.reduce((s, p) => s + (p.operating_expenses ?? 0), 0) ?? 0
  const totalGRI = properties?.reduce((s, p) => s + (p.gross_rental_income ?? 0), 0) ?? 0
  const portfolioRatio = totalGRI > 0 ? totalOpEx / totalGRI : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operating Expenses</h1>
        <p className="text-sm text-muted-foreground">Expense analysis across your portfolio</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total OpEx</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{fmt(totalOpEx)}</p>
            <p className="text-xs text-muted-foreground mt-1">annual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Expense Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">{pct(portfolioRatio)}</p>
            <p className="text-xs text-muted-foreground mt-1">of gross income</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Properties Tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{properties?.filter(p => p.operating_expenses).length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">with expense data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property Expense Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {!properties || properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium">No expense data</p>
              <p className="text-sm text-muted-foreground mt-1">Add properties with operating expense data to see analysis</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <div className="col-span-2">Property</div>
                <div className="text-right">Gross Income</div>
                <div className="text-right">Operating Expenses</div>
                <div className="text-right">Expense Ratio</div>
              </div>
              {properties.map(p => {
                const ratio = expenseRatio(p.operating_expenses, p.gross_rental_income)
                const ratioColor = ratio == null ? '' : ratio > 0.5 ? 'text-red-400' : ratio > 0.4 ? 'text-yellow-400' : 'text-emerald-400'
                return (
                  <Link
                    key={p.id}
                    to={`/properties/${p.id}`}
                    className="grid grid-cols-5 gap-4 px-3 py-3 text-sm hover:bg-secondary/30 transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="col-span-2">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.city}, {p.state}</p>
                    </div>
                    <div className="text-right font-mono text-emerald-400">{fmt(p.gross_rental_income)}</div>
                    <div className="text-right font-mono text-red-400">{fmt(p.operating_expenses)}</div>
                    <div className={`text-right font-mono font-semibold ${ratioColor}`}>{pct(ratio)}</div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
