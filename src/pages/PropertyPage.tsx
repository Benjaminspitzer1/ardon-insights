import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Building2, Calendar, DollarSign, FileText, FileSpreadsheet, File, Image, Trash2, Upload, Download } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import ProFormaTable from '@/components/ProFormaTable'
import PropertyMap3D from '@/components/PropertyMap3D'
import { buildProForma } from '@/lib/calculators'
import ScrapePanel from '@/components/ScrapePanel'

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'PDF'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'Excel'
  if (['docx', 'doc'].includes(ext)) return 'Word'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image'
  return 'Other'
}

function DocFileIcon({ type }: { type: string }) {
  if (type === 'PDF') return <FileText className="h-5 w-5 text-red-400" />
  if (type === 'Excel') return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
  if (type === 'Word') return <FileText className="h-5 w-5 text-blue-400" />
  if (type === 'Image') return <Image className="h-5 w-5 text-yellow-400" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STAGE_VARIANTS: Record<string, string> = {
  sourced: 'secondary',
  screening: 'warning',
  loi: 'teal',
  due_diligence: 'warning',
  closing: 'teal',
  closed: 'success',
  dead: 'danger',
}

export default function PropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: property } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('*').eq('id', propertyId!).single()
      return data
    },
    enabled: !!propertyId,
  })

  const { data: unitMix } = useQuery({
    queryKey: ['unit-mix', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('unit_mix').select('*').eq('property_id', propertyId!)
      return data ?? []
    },
    enabled: !!propertyId,
  })

  const { data: rentRoll } = useQuery({
    queryKey: ['rent-roll', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('rent_roll').select('*').eq('property_id', propertyId!)
      return data ?? []
    },
    enabled: !!propertyId,
  })

  const { data: deals } = useQuery({
    queryKey: ['deals', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('*').eq('property_id', propertyId!)
      return data ?? []
    },
    enabled: !!propertyId,
  })

  const { data: documents } = useQuery({
    queryKey: ['documents', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('property_id', propertyId!).order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!propertyId,
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of files) {
        const path = `${user.id}/${Date.now()}_${file.name}`
        const { error: storageError } = await supabase.storage.from('documents').upload(path, file)
        if (storageError) throw storageError
        await supabase.from('documents').insert({
          user_id: user.id,
          property_id: propertyId,
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          storage_path: path,
        })
      }
      qc.invalidateQueries({ queryKey: ['documents', propertyId] })
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteDoc = async (doc: any) => {
    if (doc.storage_path) {
      await supabase.storage.from('documents').remove([doc.storage_path])
    }
    await supabase.from('documents').delete().eq('id', doc.id)
    qc.invalidateQueries({ queryKey: ['documents', propertyId] })
  }

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (!property) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
    </div>
  )

  const totalUnits = unitMix?.reduce((sum, u) => sum + u.units, 0) ?? 0
  const avgMarketRent = unitMix && unitMix.length > 0
    ? unitMix.reduce((sum, u) => sum + u.market_rent * u.units, 0) / totalUnits
    : 0
  const occupiedUnits = rentRoll?.filter(r => r.status === 'occupied').length ?? 0
  const occupancyRate = totalUnits > 0 ? occupiedUnits / totalUnits : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{property.name}</h1>
            <Badge variant={property.status === 'active' ? 'success' : property.status === 'pipeline' ? 'teal' : 'outline'}>
              {property.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}, {property.city}, {property.state} {property.zip}
          </p>
        </div>
      </div>

      {/* Property stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Units', value: String(property.units ?? totalUnits), icon: <Building2 className="h-4 w-4" /> },
          { label: 'Year Built', value: String(property.year_built ?? '—'), icon: <Calendar className="h-4 w-4" /> },
          { label: 'Purchase Price', value: property.purchase_price ? formatCurrency(property.purchase_price) : '—', icon: <DollarSign className="h-4 w-4" /> },
          { label: 'Occupancy', value: occupancyRate > 0 ? `${(occupancyRate * 100).toFixed(1)}%` : '—', icon: <Building2 className="h-4 w-4" /> },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">{icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />

      <Tabs defaultValue="unit-mix">
        <TabsList>
          <TabsTrigger value="unit-mix">Unit Mix</TabsTrigger>
          <TabsTrigger value="rent-roll">Rent Roll</TabsTrigger>
          <TabsTrigger value="proforma">Pro Forma</TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
        </TabsList>

        <TabsContent value="unit-mix" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Unit Mix</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!unitMix || unitMix.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No unit mix data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Type', 'Units', 'SF', 'Market Rent', 'In-Place Rent', 'Spread'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unitMix.map((u) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-4 py-2 font-medium">{u.unit_type}</td>
                        <td className="px-4 py-2">{u.units}</td>
                        <td className="px-4 py-2">{u.sf.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono">${u.market_rent.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono">${u.in_place_rent.toLocaleString()}</td>
                        <td className={`px-4 py-2 font-mono ${u.market_rent > u.in_place_rent ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${(u.market_rent - u.in_place_rent).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rent-roll" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Rent Roll ({rentRoll?.length ?? 0} units)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {!rentRoll || rentRoll.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No rent roll data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Unit', 'Type', 'Tenant', 'Lease Start', 'Lease End', 'Rent/mo', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rentRoll.map((r) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-4 py-2 font-medium">{r.unit_number}</td>
                        <td className="px-4 py-2">{r.unit_type}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.tenant_name ?? '—'}</td>
                        <td className="px-4 py-2 text-xs">{r.lease_start ?? '—'}</td>
                        <td className="px-4 py-2 text-xs">{r.lease_end ?? '—'}</td>
                        <td className="px-4 py-2 font-mono">${r.monthly_rent.toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <Badge variant={r.status === 'occupied' ? 'success' : r.status === 'vacant' ? 'danger' : 'warning'}>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Linked Deals</CardTitle>
              <Link to="/deal-flow">
                <Button variant="outline" size="sm">View Pipeline</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!deals || deals.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No deals linked to this property.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Stage', 'Priority', 'Asking Price', 'Broker', 'Target Close', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal: any) => (
                      <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-4 py-2">
                          <Badge variant={(STAGE_VARIANTS[deal.stage] ?? 'secondary') as any}>
                            {deal.stage.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={deal.priority === 'high' ? 'danger' : deal.priority === 'medium' ? 'warning' : 'secondary'}>
                            {deal.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono">{deal.asking_price ? formatCurrency(deal.asking_price) : '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{deal.broker_name ?? '—'}</td>
                        <td className="px-4 py-2 text-xs">{deal.target_close_date ?? '—'}</td>
                        <td className="px-4 py-2">
                          <Link to={`/deal-flow/${deal.id}`}>
                            <Button variant="ghost" size="sm">Open</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Documents</CardTitle>
              <Button variant="brand" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </CardHeader>
            <CardContent>
              {uploadError && <p className="mb-3 text-sm text-destructive">{uploadError}</p>}
              {!documents || documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded for this property.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors">
                      <DocFileIcon type={doc.type ?? 'Other'} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.size ? formatBytes(doc.size) : '—'} · {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{doc.type ?? 'Other'}</Badge>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleDownload(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteDoc(doc)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proforma" className="mt-4">
          <ProFormaTable rows={buildProForma({
            initialNOI: (property.current_value ?? property.purchase_price ?? 10000000) * 0.055,
            revenueGrowth: 0.03, expenseGrowth: 0.025, vacancyRate: 0.05,
            operatingExpenseRatio: 0.35, holdYears: 5, exitCapRate: 0.055,
            loanAmount: (property.purchase_price ?? 10000000) * 0.7,
            annualRate: 0.065, amortYears: 30, ioPeriod: 2,
            purchasePrice: property.purchase_price ?? 10000000,
          })} />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          {property.lat && property.lng ? (
            <PropertyMap3D
              propertyId={propertyId!}
              lat={property.lat}
              lng={property.lng}
              propertyName={property.name}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No coordinates set for this property. Add lat/lng to enable the map.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <ScrapePanel propertyId={propertyId!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
