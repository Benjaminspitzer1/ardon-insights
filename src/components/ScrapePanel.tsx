import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, ExternalLink, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const SOURCES = [
  { id: 'costar', label: 'CoStar', category: 'Comps' },
  { id: 'loopnet', label: 'LoopNet', category: 'Comps' },
  { id: 'crexi', label: 'Crexi', category: 'Comps' },
  { id: 'apartments_com', label: 'Apartments.com', category: 'Rent' },
  { id: 'rentometer', label: 'Rentometer', category: 'Rent' },
  { id: 'zillow', label: 'Zillow', category: 'Rent' },
  { id: 'realtor', label: 'Realtor.com', category: 'Market' },
  { id: 'census', label: 'Census ACS', category: 'Demographics' },
  { id: 'fred', label: 'FRED Rates', category: 'Rates' },
  { id: 'walk_score', label: 'Walk Score', category: 'Location' },
  { id: 'google_places', label: 'Google Places', category: 'Location' },
  { id: 'city_permits', label: 'City Permits', category: 'Pipeline' },
  { id: 'sec_edgar', label: 'SEC EDGAR', category: 'Ownership' },
  { id: 'county_assessor', label: 'County Assessor', category: 'Tax' },
  { id: 'bizjournal', label: 'Biz Journal', category: 'News' },
]

const STATUS_BADGE: Record<string, any> = {
  pending: 'outline',
  running: 'teal',
  complete: 'success',
  failed: 'danger',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  complete: <CheckCircle className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
}

export default function ScrapePanel({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: jobs } = useQuery({
    queryKey: ['scrape-jobs', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('scrape_jobs').select('*').eq('property_id', propertyId).order('created_at', { ascending: false })
      return data ?? []
    },
    refetchInterval: 5000,
  })

  const { data: scrapedData } = useQuery({
    queryKey: ['scraped-data', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('scraped_data').select('*').eq('property_id', propertyId).order('scraped_at', { ascending: false })
      return data ?? []
    },
  })

  const runScrape = useMutation({
    mutationFn: async (sources: string[]) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scraper-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ property_id: propertyId, sources }),
      })
      if (!res.ok) throw new Error('Scrape failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scrape-jobs', propertyId] })
      setSelected(new Set())
    },
  })

  const jobBySource = new Map(jobs?.map(j => [j.source, j]) ?? [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const categories = [...new Set(SOURCES.map(s => s.category))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Research Sources</h3>
          <p className="text-xs text-muted-foreground">Select sources to scrape and enrich this property's data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set(SOURCES.map(s => s.id)))}>
            Select All
          </Button>
          <Button
            variant="brand"
            size="sm"
            className="gap-2"
            disabled={selected.size === 0 || runScrape.isPending}
            onClick={() => runScrape.mutate([...selected])}
          >
            <RefreshCw className={cn('h-4 w-4', runScrape.isPending && 'animate-spin')} />
            Scrape {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </div>

      {categories.map(cat => (
        <Card key={cat}>
          <CardHeader className="py-3">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOURCES.filter(s => s.category === cat).map(source => {
                const job = jobBySource.get(source.id)
                const isSelected = selected.has(source.id)
                return (
                  <button
                    key={source.id}
                    onClick={() => toggle(source.id)}
                    className={cn(
                      'flex items-center justify-between rounded-md border p-2.5 text-left text-sm transition-colors',
                      isSelected ? 'border-brand-teal bg-brand-teal/10' : 'border-border hover:border-brand-teal/40 hover:bg-secondary/50'
                    )}
                  >
                    <span className="font-medium">{source.label}</span>
                    {job && (
                      <div className="flex items-center gap-1">
                        {STATUS_ICON[job.status]}
                        <Badge variant={STATUS_BADGE[job.status]} className="text-[10px] px-1">{job.status}</Badge>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Scraped results */}
      {scrapedData && scrapedData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Scraped Data ({scrapedData.length} items)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {scrapedData.slice(0, 10).map(item => (
              <div key={item.id} className="flex items-start justify-between rounded-md border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="teal" className="text-[10px]">{item.source}</Badge>
                    <span className="text-xs text-muted-foreground">{item.data_type}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.scraped_at).toLocaleDateString()}
                  </p>
                </div>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="text-brand-teal-light hover:text-brand-teal">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
