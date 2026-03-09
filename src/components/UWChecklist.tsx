import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Circle, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// 45-item UW checklist from the spec
const CHECKLIST_TEMPLATE = [
  { category: 'Title & Legal', item: 'Title search ordered' },
  { category: 'Title & Legal', item: 'Title insurance commitment received' },
  { category: 'Title & Legal', item: 'Survey ordered and received' },
  { category: 'Title & Legal', item: 'Zoning confirmation letter obtained' },
  { category: 'Title & Legal', item: 'Legal entity / ownership structure verified' },
  { category: 'Physical', item: 'Property inspection scheduled' },
  { category: 'Physical', item: 'Phase I environmental ordered' },
  { category: 'Physical', item: 'Phase II environmental (if required)' },
  { category: 'Physical', item: 'Roof inspection completed' },
  { category: 'Physical', item: 'Structural engineering report obtained' },
  { category: 'Physical', item: 'MEP assessment completed' },
  { category: 'Financial', item: 'T-12 operating statement received' },
  { category: 'Financial', item: 'T-3 operating statement received' },
  { category: 'Financial', item: 'Rent roll (current) received' },
  { category: 'Financial', item: 'Leases reviewed and abstracted' },
  { category: 'Financial', item: 'Bank statements (3 months) reviewed' },
  { category: 'Financial', item: 'Tax returns (2 years) reviewed' },
  { category: 'Financial', item: 'CAM reconciliations reviewed' },
  { category: 'Debt', item: 'Loan application submitted' },
  { category: 'Debt', item: 'Lender LOI received' },
  { category: 'Debt', item: 'Appraisal ordered' },
  { category: 'Debt', item: 'Appraisal received and reviewed' },
  { category: 'Debt', item: 'Loan commitment received' },
  { category: 'Debt', item: 'Loan documents reviewed by counsel' },
  { category: 'Market', item: 'Competitive set analysis completed' },
  { category: 'Market', item: 'Submarket vacancy and rent trends analyzed' },
  { category: 'Market', item: 'Employment drivers and demographics reviewed' },
  { category: 'Market', item: 'Pipeline supply analysis completed' },
  { category: 'Market', item: 'Walk score / transit score verified' },
  { category: 'Market', item: 'Google Street View reviewed' },
  { category: 'Market', item: 'Neighborhood crime data reviewed' },
  { category: 'Closing', item: 'Purchase contract executed' },
  { category: 'Closing', item: 'Earnest money deposited' },
  { category: 'Closing', item: 'Title company selected' },
  { category: 'Closing', item: 'Closing attorney selected' },
  { category: 'Closing', item: 'Insurance binder obtained' },
  { category: 'Closing', item: 'Utility transfer letters sent' },
  { category: 'Closing', item: 'Prorations calculated and agreed' },
  { category: 'Closing', item: 'Wire instructions verified' },
  { category: 'Equity', item: 'Investor PPM prepared' },
  { category: 'Equity', item: 'Subscription agreements circulated' },
  { category: 'Equity', item: 'Capital commitments received' },
  { category: 'Equity', item: 'Equity wired to escrow' },
  { category: 'Equity', item: 'Operating agreement executed' },
  { category: 'Equity', item: 'K-1 distribution schedule set' },
]

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_review: <Minus className="h-4 w-4 text-amber-400" />,
  complete: <Check className="h-4 w-4 text-emerald-400" />,
  na: <Minus className="h-4 w-4 text-muted-foreground/40" />,
}

const STATUS_CYCLE: Record<string, string> = {
  pending: 'in_review',
  in_review: 'complete',
  complete: 'na',
  na: 'pending',
}

export default function UWChecklist({ dealId }: { dealId: string }) {
  const qc = useQueryClient()

  const { data: items } = useQuery({
    queryKey: ['checklist', dealId],
    queryFn: async () => {
      const { data } = await supabase.from('uw_checklist_items').select('*').eq('deal_id', dealId).order('category')
      return data ?? []
    },
  })

  const seed = useMutation({
    mutationFn: async () => {
      const rows = CHECKLIST_TEMPLATE.map(t => ({ deal_id: dealId, category: t.category, item: t.item, status: 'pending' as const }))
      await supabase.from('uw_checklist_items').insert(rows)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', dealId] }),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('uw_checklist_items').update({ status } as any).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', dealId] }),
  })

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <p className="text-muted-foreground text-sm">No checklist loaded yet.</p>
          <Button variant="brand" onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? 'Loading...' : 'Initialize 45-Item UW Checklist'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const categories = [...new Set(items.map(i => i.category))]
  const complete = items.filter(i => i.status === 'complete').length
  const pct = Math.round((complete / items.length) * 100)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{complete} / {items.length} complete</span>
            <Badge variant={pct === 100 ? 'success' : pct >= 50 ? 'teal' : 'outline'}>{pct}%</Badge>
          </div>
          <Progress value={pct} />
        </CardContent>
      </Card>

      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat)
        const catComplete = catItems.filter(i => i.status === 'complete').length
        return (
          <Card key={cat}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{cat}</CardTitle>
                <span className="text-xs text-muted-foreground">{catComplete}/{catItems.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {catItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => updateStatus.mutate({ id: item.id, status: STATUS_CYCLE[item.status] })}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors',
                    item.status === 'complete' && 'opacity-60'
                  )}
                >
                  {STATUS_ICON[item.status]}
                  <span className={item.status === 'complete' ? 'line-through text-muted-foreground' : ''}>
                    {item.item}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
