import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, Filter, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import type { Database } from '@/types/database'

type Deal = Database['public']['Tables']['deals']['Row'] & {
  properties: Pick<Database['public']['Tables']['properties']['Row'], 'name' | 'city' | 'state' | 'property_type' | 'units'>
}

const STAGES = ['sourced', 'screening', 'loi', 'due_diligence', 'closing', 'closed', 'dead'] as const
const STAGE_LABELS: Record<string, string> = {
  sourced: 'Sourced', screening: 'Screening', loi: 'LOI', due_diligence: 'Due Diligence',
  closing: 'Closing', closed: 'Closed', dead: 'Dead',
}
const STAGE_COLORS: Record<string, any> = {
  sourced: 'outline', screening: 'teal', loi: 'purple', due_diligence: 'warning',
  closing: 'success', closed: 'success', dead: 'danger',
}

export default function DealFlowPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [newDeal, setNewDeal] = useState({ propertyName: '', address: '', city: '', state: '', propertyType: 'Multifamily', askingPrice: '' })

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, properties(name, city, state, property_type, units)')
        .order('created_at', { ascending: false })
      return (data ?? []) as Deal[]
    },
    enabled: !!user,
  })

  const createDeal = useMutation({
    mutationFn: async () => {
      // First create property
      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .insert({ name: newDeal.propertyName, address: newDeal.address, city: newDeal.city, state: newDeal.state, zip: '', property_type: newDeal.propertyType, status: 'pipeline', user_id: user!.id })
        .select()
        .single()
      if (propErr) throw propErr

      // Then create deal
      const { error: dealErr } = await supabase
        .from('deals')
        .insert({ property_id: prop.id, user_id: user!.id, stage: 'sourced', priority: 'medium', asking_price: newDeal.askingPrice ? Number(newDeal.askingPrice) : null })
      if (dealErr) throw dealErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['properties'] })
      setShowNewDeal(false)
      setNewDeal({ propertyName: '', address: '', city: '', state: '', propertyType: 'Multifamily', askingPrice: '' })
    },
  })

  const filtered = deals.filter(d => {
    const matchSearch = !search || d.properties?.name?.toLowerCase().includes(search.toLowerCase()) || d.properties?.city?.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || d.stage === stageFilter
    return matchSearch && matchStage
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Flow</h1>
          <p className="text-sm text-muted-foreground">{deals.filter(d => !['closed','dead'].includes(d.stage)).length} active deals in pipeline</p>
        </div>
        <Button variant="brand" className="gap-2" onClick={() => setShowNewDeal(true)}>
          <Plus className="h-4 w-4" />
          New Deal
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stage columns (Kanban) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {(['sourced', 'screening', 'loi', 'due_diligence', 'closing'] as const).map(stage => {
          const stageDeal = filtered.filter(d => d.stage === stage)
          return (
            <div key={stage} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{STAGE_LABELS[stage]}</h3>
                <Badge variant={STAGE_COLORS[stage]} className="text-xs">{stageDeal.length}</Badge>
              </div>
              {stageDeal.map(deal => (
                <Link key={deal.id} to={`/deal-flow/${deal.id}`}>
                  <Card className="cursor-pointer hover:border-brand-teal/40 transition-colors">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{deal.properties?.name}</p>
                          <p className="text-xs text-muted-foreground">{deal.properties?.city}, {deal.properties?.state}</p>
                        </div>
                      </div>
                      {deal.asking_price && (
                        <p className="text-right text-xs font-mono text-brand-teal-light">{formatCurrency(deal.asking_price)}</p>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{deal.properties?.property_type}</span>
                        {deal.properties?.units && <span className="text-[10px] text-muted-foreground">· {deal.properties.units} units</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {stageDeal.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">No deals</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New Deal Dialog */}
      <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property Name</Label>
              <Input placeholder="123 Main St Apartments" value={newDeal.propertyName} onChange={e => setNewDeal(p => ({ ...p, propertyName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input placeholder="Miami" value={newDeal.city} onChange={e => setNewDeal(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input placeholder="FL" maxLength={2} value={newDeal.state} onChange={e => setNewDeal(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input placeholder="123 Main St" value={newDeal.address} onChange={e => setNewDeal(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select value={newDeal.propertyType} onValueChange={v => setNewDeal(p => ({ ...p, propertyType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Multifamily">Multifamily</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Industrial">Industrial</SelectItem>
                    <SelectItem value="Mixed Use">Mixed Use</SelectItem>
                    <SelectItem value="Land">Land</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asking Price</Label>
                <Input type="number" placeholder="5000000" value={newDeal.askingPrice} onChange={e => setNewDeal(p => ({ ...p, askingPrice: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDeal(false)}>Cancel</Button>
            <Button
              variant="brand"
              onClick={() => createDeal.mutate()}
              disabled={!newDeal.propertyName || !newDeal.city || !newDeal.state || createDeal.isPending}
            >
              {createDeal.isPending ? 'Creating...' : 'Create Deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
