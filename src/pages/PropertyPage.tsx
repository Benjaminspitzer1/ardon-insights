import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ImportExcelDialog from '@/components/ImportExcelDialog'
import EditPropertyDialog from '@/components/EditPropertyDialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Building2, Calendar, DollarSign, FileText, FileSpreadsheet, File, Image, Trash2, Upload, Download, Pencil, Plus, Check, X, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, cn } from '@/lib/utils'
import ProFormaTable from '@/components/ProFormaTable'
import PropertyMap3D from '@/components/PropertyMap3D'
import { buildProForma } from '@/lib/calculators'
import { downloadUnitMixTemplate, downloadRentRollTemplate, exportProFormaTable } from '@/lib/exportExcel'
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

const RENT_STATUSES = ['occupied', 'vacant', 'notice', 'model'] as const

const DEFAULT_ASSUMPTIONS = {
  revenueGrowth: 0.03,
  expenseGrowth: 0.025,
  vacancyRate: 0.05,
  exitCapRate: 0.055,
  holdYears: 5,
  initialNOI: null as number | null,
  basePeriod: 't12' as 't12' | 't6' | 't3' | 'property',
  preset: 'base' as 'conservative' | 'base' | 'optimistic',
}
type Assumptions = typeof DEFAULT_ASSUMPTIONS

type HistPeriod = {
  gpi: number; vacancy_pct: number; other_income: number
  mgmt: number; insurance: number; taxes: number
  maintenance: number; utilities: number; other_opex: number
}
type HistData = { t12: HistPeriod; t6: HistPeriod; t3: HistPeriod }

const EMPTY_PERIOD: HistPeriod = { gpi: 0, vacancy_pct: 5, other_income: 0, mgmt: 0, insurance: 0, taxes: 0, maintenance: 0, utilities: 0, other_opex: 0 }
const EMPTY_HIST: HistData = { t12: { ...EMPTY_PERIOD }, t6: { ...EMPTY_PERIOD }, t3: { ...EMPTY_PERIOD } }
const PERIOD_MONTHS = { t12: 12, t6: 6, t3: 3 } as const
const UW_PRESETS = {
  conservative: { holdYears: 5, exitCapRate: 0.065, revenueGrowth: 0.02, expenseGrowth: 0.03, vacancyRate: 0.08 },
  base: { holdYears: 5, exitCapRate: 0.055, revenueGrowth: 0.03, expenseGrowth: 0.025, vacancyRate: 0.05 },
  optimistic: { holdYears: 7, exitCapRate: 0.05, revenueGrowth: 0.04, expenseGrowth: 0.02, vacancyRate: 0.03 },
} as const

function annualizeHist(period: HistPeriod, months: number): { gpi: number; egi: number; opex: number; noi: number } {
  const factor = 12 / months
  const annGPI = period.gpi * factor
  const vacLoss = annGPI * (period.vacancy_pct / 100)
  const egi = annGPI - vacLoss + period.other_income * factor
  const opex = (period.mgmt + period.insurance + period.taxes + period.maintenance + period.utilities + period.other_opex) * factor
  return { gpi: annGPI, egi, opex, noi: egi - opex }
}

const EMPTY_UNIT = { unit_type: '', units: '', sf: '', market_rent: '', in_place_rent: '' }

type UnitForm = typeof EMPTY_UNIT
type RentForm = {
  unit_number: string
  unit_type: string
  tenant_name: string
  lease_start: string
  lease_end: string
  monthly_rent: string
  sqft: string
  status: string
}

const EMPTY_RENT: RentForm = {
  unit_number: '', unit_type: '', tenant_name: '', lease_start: '',
  lease_end: '', monthly_rent: '', sqft: '', status: 'occupied',
}

function RentRollDialog({
  open, onClose, propertyId, editing, onSaved,
}: {
  open: boolean
  onClose: () => void
  propertyId: string
  editing: (RentForm & { id?: string }) | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<RentForm>(editing ? {
    unit_number: editing.unit_number,
    unit_type: editing.unit_type,
    tenant_name: editing.tenant_name ?? '',
    lease_start: editing.lease_start ?? '',
    lease_end: editing.lease_end ?? '',
    monthly_rent: String(editing.monthly_rent),
    sqft: String(editing.sqft ?? ''),
    status: editing.status,
  } : EMPTY_RENT)

  const set = (k: keyof RentForm) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id: propertyId,
        unit_number: form.unit_number.trim(),
        unit_type: form.unit_type.trim(),
        tenant_name: form.tenant_name.trim() || null,
        lease_start: form.lease_start || null,
        lease_end: form.lease_end || null,
        monthly_rent: parseFloat(form.monthly_rent) || 0,
        sqft: parseFloat(form.sqft) || null,
        status: form.status as 'occupied' | 'vacant' | 'notice' | 'model',
      }
      if (editing?.id) {
        const { error } = await supabase.from('rent_roll').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rent_roll').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing?.id ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Number *</Label>
              <Input value={form.unit_number} onChange={e => set('unit_number')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Type</Label>
              <Input value={form.unit_type} onChange={e => set('unit_type')(e.target.value)} placeholder="1BR, 2BR..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant Name</Label>
              <Input value={form.tenant_name} onChange={e => set('tenant_name')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly Rent ($)</Label>
              <Input type="number" value={form.monthly_rent} onChange={e => set('monthly_rent')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lease Start</Label>
              <Input type="date" value={form.lease_start} onChange={e => set('lease_start')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lease End</Label>
              <Input type="date" value={form.lease_end} onChange={e => set('lease_end')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sq Ft</Label>
              <Input type="number" value={form.sqft} onChange={e => set('sqft')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={set('status')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {save.isError && (
          <p className="text-sm text-destructive">{(save.error as Error).message}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'rent-roll' | 'unit-mix' | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Unit mix inline edit state
  const [addingUnit, setAddingUnit] = useState(false)
  const [editUnitId, setEditUnitId] = useState<string | null>(null)
  const [unitForm, setUnitForm] = useState<UnitForm>(EMPTY_UNIT)

  // Rent roll dialog state
  const [rentDialogOpen, setRentDialogOpen] = useState(false)
  const [editingRent, setEditingRent] = useState<(RentForm & { id?: string }) | null>(null)

  // Pro forma assumptions state
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [assumptionsForm, setAssumptionsForm] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)

  // Historical data state
  const [histPeriod, setHistPeriod] = useState<'t12' | 't6' | 't3'>('t12')
  const [hist, setHist] = useState<HistData>(EMPTY_HIST)

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

  // Unit mix mutations
  const upsertUnit = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id: propertyId!,
        unit_type: unitForm.unit_type.trim(),
        units: parseInt(unitForm.units) || 0,
        sf: parseFloat(unitForm.sf) || 0,
        market_rent: parseFloat(unitForm.market_rent) || 0,
        in_place_rent: parseFloat(unitForm.in_place_rent) || 0,
      }
      if (editUnitId) {
        const { error } = await supabase.from('unit_mix').update(payload).eq('id', editUnitId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('unit_mix').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unit-mix', propertyId] })
      setEditUnitId(null)
      setAddingUnit(false)
      setUnitForm(EMPTY_UNIT)
    },
  })

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('unit_mix').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-mix', propertyId] }),
  })

  const deleteRent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rent_roll').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rent-roll', propertyId] }),
  })

  const saveAssumptions = useMutation({
    mutationFn: async (values: Assumptions) => {
      const { error } = await supabase.from('properties').update({ assumptions: values }).eq('id', propertyId!)
      if (error) throw error
    },
    onSuccess: (_, values) => {
      setAssumptions(values)
      setAssumptionsOpen(false)
      qc.invalidateQueries({ queryKey: ['property', propertyId] })
    },
  })

  const saveHistoricals = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('properties').update({ historicals: hist }).eq('id', propertyId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['property', propertyId] }),
  })

  function setHistField(period: 't12' | 't6' | 't3', field: keyof HistPeriod, value: string) {
    setHist(h => ({ ...h, [period]: { ...h[period], [field]: parseFloat(value) || 0 } }))
  }

  function startEditUnit(u: any) {
    setEditUnitId(u.id)
    setAddingUnit(false)
    setUnitForm({
      unit_type: u.unit_type,
      units: String(u.units),
      sf: String(u.sf),
      market_rent: String(u.market_rent),
      in_place_rent: String(u.in_place_rent),
    })
  }

  function cancelUnitEdit() {
    setEditUnitId(null)
    setAddingUnit(false)
    setUnitForm(EMPTY_UNIT)
  }

  // Sync saved assumptions from DB when property loads
  useEffect(() => {
    if (property?.assumptions) {
      setAssumptions(prev => ({ ...prev, ...(property.assumptions as Partial<Assumptions>) }))
    }
  }, [property?.id])

  useEffect(() => {
    if (!property?.historicals) return
    const h = property.historicals as any
    setHist({
      t12: h.t12 ? { ...EMPTY_PERIOD, ...h.t12 } : { ...EMPTY_PERIOD },
      t6: h.t6 ? { ...EMPTY_PERIOD, ...h.t6 } : { ...EMPTY_PERIOD },
      t3: h.t3 ? { ...EMPTY_PERIOD, ...h.t3 } : { ...EMPTY_PERIOD },
    })
  }, [property?.id])

  const derivedNOI = useMemo(() => {
    if (!property) return 0
    const fallback = assumptions.initialNOI ?? (property.current_value ?? property.purchase_price ?? 10000000) * 0.055
    if (assumptions.basePeriod === 'property') return fallback
    const months = PERIOD_MONTHS[assumptions.basePeriod]
    const { noi } = annualizeHist(hist[assumptions.basePeriod], months)
    return noi > 0 ? noi : fallback
  }, [hist, assumptions, property])

  const proFormaRows = useMemo(() => {
    if (!property) return []
    return buildProForma({
      initialNOI: derivedNOI,
      revenueGrowth: assumptions.revenueGrowth,
      expenseGrowth: assumptions.expenseGrowth,
      vacancyRate: assumptions.vacancyRate,
      operatingExpenseRatio: 0.35,
      holdYears: assumptions.holdYears,
      exitCapRate: assumptions.exitCapRate,
      loanAmount: (property.purchase_price ?? 10000000) * 0.7,
      annualRate: 0.065, amortYears: 30, ioPeriod: 2,
      purchasePrice: property.purchase_price ?? 10000000,
    })
  }, [property, assumptions, derivedNOI])

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

  const setUF = (k: keyof UnitForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setUnitForm(f => ({ ...f, [k]: e.target.value }))

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
        <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
          <Link to={`/properties/${propertyId}/sensitivity`}>
            <TrendingUp className="h-4 w-4" /> Sensitivity
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit Property
        </Button>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Unit Mix</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => downloadUnitMixTemplate()}>
                  <Download className="h-4 w-4" /> Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportMode('unit-mix')}>Import Excel</Button>
                <Button variant="brand" size="sm" className="gap-1" onClick={() => { setAddingUnit(true); setEditUnitId(null); setUnitForm(EMPTY_UNIT) }}>
                  <Plus className="h-4 w-4" /> Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Type', 'Units', 'SF', 'Market Rent', 'In-Place Rent', 'Spread', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unitMix && unitMix.map((u) => (
                    editUnitId === u.id ? (
                      <tr key={u.id} className="border-b border-brand-teal/30 bg-brand-teal/5">
                        <td className="px-2 py-1"><Input className="h-7 text-xs" value={unitForm.unit_type} onChange={setUF('unit_type')} placeholder="1BR" /></td>
                        <td className="px-2 py-1"><Input className="h-7 text-xs w-20" type="number" value={unitForm.units} onChange={setUF('units')} /></td>
                        <td className="px-2 py-1"><Input className="h-7 text-xs w-24" type="number" value={unitForm.sf} onChange={setUF('sf')} /></td>
                        <td className="px-2 py-1"><Input className="h-7 text-xs w-28" type="number" value={unitForm.market_rent} onChange={setUF('market_rent')} /></td>
                        <td className="px-2 py-1"><Input className="h-7 text-xs w-28" type="number" value={unitForm.in_place_rent} onChange={setUF('in_place_rent')} /></td>
                        <td className="px-2 py-1 text-muted-foreground text-xs">auto</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-brand-teal" onClick={() => upsertUnit.mutate()} disabled={upsertUnit.isPending}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={cancelUnitEdit}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={u.id} className="group border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-4 py-2 font-medium">{u.unit_type}</td>
                        <td className="px-4 py-2">{u.units}</td>
                        <td className="px-4 py-2">{u.sf.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono">${u.market_rent.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono">${u.in_place_rent.toLocaleString()}</td>
                        <td className={cn('px-4 py-2 font-mono', u.market_rent > u.in_place_rent ? 'text-emerald-400' : 'text-red-400')}>
                          ${(u.market_rent - u.in_place_rent).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => startEditUnit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteUnit.mutate(u.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                  {addingUnit && (
                    <tr className="border-b border-brand-teal/30 bg-brand-teal/5">
                      <td className="px-2 py-1"><Input className="h-7 text-xs" value={unitForm.unit_type} onChange={setUF('unit_type')} placeholder="1BR" /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-20" type="number" value={unitForm.units} onChange={setUF('units')} placeholder="0" /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-24" type="number" value={unitForm.sf} onChange={setUF('sf')} placeholder="0" /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-28" type="number" value={unitForm.market_rent} onChange={setUF('market_rent')} placeholder="0" /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-28" type="number" value={unitForm.in_place_rent} onChange={setUF('in_place_rent')} placeholder="0" /></td>
                      <td className="px-2 py-1 text-muted-foreground text-xs">auto</td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-brand-teal" onClick={() => upsertUnit.mutate()} disabled={upsertUnit.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={cancelUnitEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(!unitMix || unitMix.length === 0) && !addingUnit && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-muted-foreground">No unit mix data yet. Click Add Row to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rent-roll" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Rent Roll ({rentRoll?.length ?? 0} units)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => downloadRentRollTemplate()}>
                  <Download className="h-4 w-4" /> Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportMode('rent-roll')}>Import Excel</Button>
                <Button variant="brand" size="sm" className="gap-1" onClick={() => { setEditingRent(null); setRentDialogOpen(true) }}>
                  <Plus className="h-4 w-4" /> Add Unit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Unit', 'Type', 'Tenant', 'Lease Start', 'Lease End', 'Rent/mo', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rentRoll && rentRoll.map((r) => (
                    <tr key={r.id} className="group border-b border-border/50 hover:bg-secondary/30">
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
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
                            onClick={() => {
                              setEditingRent({
                                id: r.id,
                                unit_number: r.unit_number,
                                unit_type: r.unit_type,
                                tenant_name: r.tenant_name ?? '',
                                lease_start: r.lease_start ?? '',
                                lease_end: r.lease_end ?? '',
                                monthly_rent: String(r.monthly_rent),
                                sqft: String(r.sqft ?? ''),
                                status: r.status,
                              })
                              setRentDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteRent.mutate(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!rentRoll || rentRoll.length === 0) && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">No rent roll data yet. Click Add Unit to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Pro Forma ({assumptions.holdYears}-Year Hold)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => exportProFormaTable(property.name, proFormaRows)}>
                  <Download className="h-4 w-4" /> Export
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setAssumptionsForm({ ...assumptions }); setAssumptionsOpen(true) }}>
                  <Pencil className="h-4 w-4" /> Edit Assumptions
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ProFormaTable rows={proFormaRows} />
            </CardContent>
          </Card>
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

      <Dialog open={assumptionsOpen} onOpenChange={setAssumptionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pro Forma Assumptions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Revenue Growth %</Label>
                <Input
                  type="number" step="0.1"
                  value={(assumptionsForm.revenueGrowth * 100).toFixed(2)}
                  onChange={e => setAssumptionsForm(f => ({ ...f, revenueGrowth: parseFloat(e.target.value) / 100 || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expense Growth %</Label>
                <Input
                  type="number" step="0.1"
                  value={(assumptionsForm.expenseGrowth * 100).toFixed(2)}
                  onChange={e => setAssumptionsForm(f => ({ ...f, expenseGrowth: parseFloat(e.target.value) / 100 || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vacancy Rate %</Label>
                <Input
                  type="number" step="0.1"
                  value={(assumptionsForm.vacancyRate * 100).toFixed(2)}
                  onChange={e => setAssumptionsForm(f => ({ ...f, vacancyRate: parseFloat(e.target.value) / 100 || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exit Cap Rate %</Label>
                <Input
                  type="number" step="0.1"
                  value={(assumptionsForm.exitCapRate * 100).toFixed(2)}
                  onChange={e => setAssumptionsForm(f => ({ ...f, exitCapRate: parseFloat(e.target.value) / 100 || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hold Years</Label>
                <Input
                  type="number" min="1" max="30"
                  value={assumptionsForm.holdYears}
                  onChange={e => setAssumptionsForm(f => ({ ...f, holdYears: parseInt(e.target.value) || 5 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Initial NOI ($)</Label>
                <Input
                  type="number"
                  value={assumptionsForm.initialNOI ?? ''}
                  placeholder={`Auto: ${formatCurrency((property.current_value ?? property.purchase_price ?? 10000000) * 0.055)}`}
                  onChange={e => setAssumptionsForm(f => ({ ...f, initialNOI: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
            </div>
          </div>
          {saveAssumptions.isError && (
            <p className="text-sm text-destructive">{(saveAssumptions.error as Error).message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssumptionsOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={() => saveAssumptions.mutate(assumptionsForm)} disabled={saveAssumptions.isPending}>
              {saveAssumptions.isPending ? 'Saving...' : 'Save & Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditPropertyDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        property={property}
      />

      {rentDialogOpen && (
        <RentRollDialog
          key={editingRent?.id ?? 'new'}
          open={rentDialogOpen}
          onClose={() => { setRentDialogOpen(false); setEditingRent(null) }}
          propertyId={propertyId!}
          editing={editingRent}
          onSaved={() => qc.invalidateQueries({ queryKey: ['rent-roll', propertyId] })}
        />
      )}

      {importMode && (
        <ImportExcelDialog
          mode={importMode}
          propertyId={propertyId!}
          open={!!importMode}
          onClose={() => setImportMode(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: importMode === 'unit-mix' ? ['unit-mix', propertyId] : ['rent-roll', propertyId] })
          }}
        />
      )}
    </div>
  )
}
