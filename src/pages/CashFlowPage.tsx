import { useQuery } from '@tanstack/react-query'
import { TrendingUp, DollarSign, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

function fmt(n: number | null | undefined, prefix = '$') {
  if (n == null) return '—'
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pct(n: number | null | undefined) {
  if (n == null) return '—'
  return (n * 100).toFixed(1) + '%'
}

export default function CashFlowPage() {
  const { user } = useAuth()

  const { data: properties } = useQuery({
    queryKey: ['properties-cashflow', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name, address, city, state, noi, gross_rental_income, operating_expenses, vacancy_rate, purchase_price')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const totalNOI = properties?.reduce((s, p) => s + (p.noi ?? 0), 0) ?? 0
  const totalGRI = properties?.reduce((s, p) => s + (p.gross_rental_income ?? 0), 0) ?? 0
  const totalOpEx = properties?.reduce((s, p) => s + (p.operating_expenses ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cash Flow</h1>
        <p className="text-sm text-muted-foreground">Portfolio-level income and expense summary</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gross Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{fmt(totalGRI)}</p>
            <p className="text-xs text-muted-foreground mt-1">across {properties?.length ?? 0} properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Operating Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{fmt(totalOpEx)}</p>
            <p className="text-xs text-muted-foreground mt-1">annual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total NOI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-teal-light">{fmt(totalNOI)}</p>
            <p className="text-xs text-muted-foreground mt-1">net operating income</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property Cash Flow Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {!properties || properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium">No properties yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add a property to see cash flow data</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-6 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <div className="col-span-2">Property</div>
                <div className="text-right">Gross Income</div>
                <div className="text-right">Vacancy</div>
                <div className="text-right">OpEx</div>
                <div className="text-right">NOI</div>
              </div>
              {properties.map(p => (
                <Link
                  key={p.id}
                  to={`/properties/${p.id}`}
                  className="grid grid-cols-6 gap-4 px-3 py-3 text-sm hover:bg-secondary/30 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="col-span-2">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.city}, {p.state}</p>
                  </div>
                  <div className="text-right font-mono text-emerald-400">{fmt(p.gross_rental_income)}</div>
                  <div className="text-right font-mono text-yellow-400">{pct(p.vacancy_rate)}</div>
                  <div className="text-right font-mono text-red-400">{fmt(p.operating_expenses)}</div>
                  <div className="text-right font-mono font-semibold text-brand-teal-light">{fmt(p.noi)}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
