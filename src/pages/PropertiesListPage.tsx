import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Building2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/utils'

export default function PropertiesListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const groupFilter = searchParams.get('group')

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const filtered = (properties ?? []).filter(p => {
    if (groupFilter && (p as any).group_id !== groupFilter) return false
    const q = search.toLowerCase()
    return (
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q) ||
      p.property_type?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Property Portfolio</h1>
          <p className="text-sm text-muted-foreground">Manage and track your real estate investments</p>
        </div>
        <Button variant="brand" className="gap-2" onClick={() => navigate('/new-property')}>
          <Plus className="h-4 w-4" />
          New Property
        </Button>
      </div>

      {groupFilter && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Showing properties in portfolio</span>
          <Link to="/properties" className="ml-auto text-xs text-brand-teal-light hover:underline">Clear filter ×</Link>
        </div>
      )}

      <Input
        placeholder="Search by name, city, or type..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium">No properties yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first property to get started</p>
          <Button variant="brand" className="mt-4 gap-2" onClick={() => navigate('/new-property')}>
            <Plus className="h-4 w-4" />
            Add Your First Property
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p: any) => {
            const capRate = p.noi && p.purchase_price ? p.noi / p.purchase_price : null
            return (
              <Card key={p.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs">{p.property_type ?? 'Unknown'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[p.address, p.city, p.state, p.zip_code].filter(Boolean).join(', ')}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Purchase Price</p>
                      <p className="text-sm font-semibold">{formatCurrency(p.purchase_price ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current Value</p>
                      <p className="text-sm font-semibold">{formatCurrency(p.current_value ?? p.purchase_price ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cap Rate</p>
                      <p className="text-sm font-semibold">{capRate != null ? formatPercent(capRate) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">NOI</p>
                      <p className="text-sm font-semibold">{formatCurrency(p.noi ?? 0)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/properties/${p.id}`}>View →</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
