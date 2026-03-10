import { useQuery } from '@tanstack/react-query'
import { Landmark, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pct(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toFixed(2) + '%'
}

export default function FinancingPage() {
  const { user } = useAuth()

  const { data: tranches } = useQuery({
    queryKey: ['all-debt-tranches', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('debt_tranches')
        .select('*, deals(name, properties(name, city, state))')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const totalDebt = tranches?.reduce((s, t) => s + (t.loan_amount ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financing</h1>
        <p className="text-sm text-muted-foreground">Debt structure and loan summary across all deals</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-teal-light">{fmt(totalDebt)}</p>
            <p className="text-xs text-muted-foreground mt-1">{tranches?.length ?? 0} tranches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Senior Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tranches?.filter(t => t.tranche_type === 'senior').length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mezzanine / Bridge</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tranches?.filter(t => t.tranche_type !== 'senior').length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Debt Tranches</CardTitle>
        </CardHeader>
        <CardContent>
          {!tranches || tranches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Landmark className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium">No financing data</p>
              <p className="text-sm text-muted-foreground mt-1">Add debt tranches from the Deals underwriting tab</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-6 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <div className="col-span-2">Deal / Property</div>
                <div>Type</div>
                <div className="text-right">Loan Amount</div>
                <div className="text-right">Rate</div>
                <div className="text-right">Term</div>
              </div>
              {tranches.map((t: any) => (
                <div
                  key={t.id}
                  className="grid grid-cols-6 gap-4 px-3 py-3 text-sm border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <div className="col-span-2">
                    <p className="font-medium truncate">{t.deals?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.deals?.properties?.name ?? ''}{t.deals?.properties?.city ? `, ${t.deals.properties.city}` : ''}
                    </p>
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[10px] capitalize">{t.tranche_type ?? '—'}</Badge>
                  </div>
                  <div className="text-right font-mono">{fmt(t.loan_amount)}</div>
                  <div className="text-right font-mono text-brand-teal-light">{pct(t.interest_rate)}</div>
                  <div className="text-right font-mono text-muted-foreground">{t.term_months ? `${t.term_months}mo` : '—'}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
