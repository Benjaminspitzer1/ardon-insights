import { useRef, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, CheckSquare, BarChart3, FileText, FileSpreadsheet, Plus, Layers, Users, Pencil, Trash2, Upload, TrendingUp } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { exportUWModel } from '@/lib/exportExcel'
import { exportDealOnePager as exportPDF } from '@/lib/exportPDF'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { calcCapRate, calcDSCR, calcLTV, calcNOI, calcEGI, buildProForma, calcIRR, calcEquityMultiple, calcWaterfall } from '@/lib/calculators'
import ProFormaTable from '@/components/ProFormaTable'
import IRRSensitivityMatrix from '@/components/IRRSensitivityMatrix'
import UWChecklist from '@/components/UWChecklist'
import ScrapePanel from '@/components/ScrapePanel'
import ImportExcelDialog from '@/components/ImportExcelDialog'

const RENT_STATUSES = ['occupied', 'vacant', 'notice', 'model'] as const

type RentForm = {
  unit_number: string; unit_type: string; tenant_name: string
  lease_start: string; lease_end: string; monthly_rent: string; sqft: string; status: string
}
const EMPTY_RENT: RentForm = {
  unit_number: '', unit_type: '', tenant_name: '', lease_start: '',
  lease_end: '', monthly_rent: '', sqft: '', status: 'occupied',
}

function RentUnitDialog({ open, onClose, propertyId, editing, onSaved }: {
  open: boolean; onClose: () => void; propertyId: string
  editing: (RentForm & { id?: string }) | null; onSaved: () => void
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
        status: form.status as typeof RENT_STATUSES[number],
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
        <DialogHeader><DialogTitle>{editing?.id ? 'Edit Unit' : 'Add Unit'}</DialogTitle></DialogHeader>
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
        {save.isError && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
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

const STAGE_LABELS: Record<string, string> = {
  sourced: 'Sourced', screening: 'Screening', loi: 'LOI',
  due_diligence: 'Due Diligence', closing: 'Closing', closed: 'Closed', dead: 'Dead',
}
const STAGE_COLORS: Record<string, any> = {
  sourced: 'outline', screening: 'teal', loi: 'purple',
  due_diligence: 'warning', closing: 'success', closed: 'success', dead: 'danger',
}

interface UWInputs {
  purchasePrice: number
  loanAmount: number
  annualRate: number
  amortYears: number
  ioPeriod: number
  vacancyRate: number
  opexRatio: number
  revenueGrowth: number
  holdYears: number
  exitCapRate: number
  lpShare: number
}

type UWPreset = 'conservative' | 'base' | 'optimistic' | 'custom'

const PRESETS: Record<Exclude<UWPreset, 'custom'>, Partial<UWInputs>> = {
  conservative: { vacancyRate: 0.10, revenueGrowth: 0.02, exitCapRate: 0.065, opexRatio: 0.40, holdYears: 7, annualRate: 0.07 },
  base:         { vacancyRate: 0.05, revenueGrowth: 0.03, exitCapRate: 0.055, opexRatio: 0.35, holdYears: 5, annualRate: 0.065 },
  optimistic:   { vacancyRate: 0.03, revenueGrowth: 0.05, exitCapRate: 0.045, opexRatio: 0.30, holdYears: 5, annualRate: 0.06 },
}

function buildAmortSchedule(loanAmount: number, annualRate: number, amortYears: number, ioPeriod: number) {
  if (!loanAmount || !annualRate || !amortYears) return []
  const r = annualRate / 12
  const n = amortYears * 12
  const monthlyPayment = r > 0 ? loanAmount * r / (1 - Math.pow(1 + r, -n)) : loanAmount / n
  const rows: { year: number; payment: number; interest: number; principal: number; balance: number }[] = []
  let balance = loanAmount
  for (let yr = 1; yr <= Math.min(amortYears, 12); yr++) {
    let yearInterest = 0
    let yearPrincipal = 0
    const isIO = yr <= ioPeriod
    for (let m = 0; m < 12; m++) {
      const interest = balance * r
      const principal = isIO ? 0 : monthlyPayment - interest
      yearInterest += interest
      yearPrincipal += principal
      balance -= principal
    }
    rows.push({ year: yr, payment: isIO ? yearInterest : monthlyPayment * 12, interest: yearInterest, principal: yearPrincipal, balance: Math.max(0, balance) })
  }
  return rows
}

export default function UnderwritingPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const qc = useQueryClient()

  const [inputs, setInputs] = useState<UWInputs>({
    purchasePrice: 10000000,
    loanAmount: 7000000,
    annualRate: 0.065,
    amortYears: 30,
    ioPeriod: 2,
    vacancyRate: 0.05,
    opexRatio: 0.35,
    revenueGrowth: 0.03,
    holdYears: 5,
    exitCapRate: 0.055,
    lpShare: 0.9,
  })

  const [preset, setPreset] = useState<UWPreset>('base')

  function applyPreset(name: Exclude<UWPreset, 'custom'>) {
    setPreset(name)
    setInputs(prev => ({ ...prev, ...PRESETS[name] }))
  }

  function setInput<K extends keyof UWInputs>(key: K, value: UWInputs[K]) {
    setPreset('custom')
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  const { data: deal } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, properties(*)')
        .eq('id', dealId!)
        .single()
      return data
    },
    enabled: !!dealId,
  })

  const { data: proFormaData } = useQuery({
    queryKey: ['pro-forma', deal?.property_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('annual_pro_forma')
        .select('*')
        .eq('property_id', deal!.property_id)
        .order('year')
      return data ?? []
    },
    enabled: !!deal?.property_id,
  })

  const { data: rentRoll = [] } = useQuery({
    queryKey: ['rent-roll', deal?.property_id],
    queryFn: async () => {
      const { data } = await supabase.from('rent_roll').select('*').eq('property_id', deal!.property_id).order('unit_number')
      return data ?? []
    },
    enabled: !!deal?.property_id,
  })

  const { data: tranches = [] } = useQuery({
    queryKey: ['debt-tranches', deal?.property_id],
    queryFn: async () => {
      const { data } = await supabase.from('debt_tranches').select('*').eq('property_id', deal!.property_id).order('created_at')
      return data ?? []
    },
    enabled: !!deal?.property_id,
  })

  const { data: waterfall } = useQuery({
    queryKey: ['waterfall', deal?.property_id],
    queryFn: async () => {
      const { data } = await supabase.from('waterfall_structure').select('*').eq('property_id', deal!.property_id).single()
      return data
    },
    enabled: !!deal?.property_id,
  })

  const [showAddTranche, setShowAddTranche] = useState(false)
  const [editingTranche, setEditingTranche] = useState<any>(null)
  const [newTranche, setNewTranche] = useState({ tranche_name: '', loan_amount: '', rate: '', rate_type: 'fixed', spread: '', index: '', amortization: '30', io_period: '0', maturity_date: '' })
  const [showWaterfall, setShowWaterfall] = useState(false)
  const [waterfallForm, setWaterfallForm] = useState({ preferred_return: '', gp_promote: '', hurdle_1: '', hurdle_1_split_lp: '', hurdle_2: '', hurdle_2_split_lp: '' })
  const [selectedTrancheId, setSelectedTrancheId] = useState<string | null>(null)
  const [exitScenario, setExitScenario] = useState<'low' | 'base' | 'high'>('base')

  // Rent roll editing state
  const [rentDialog, setRentDialog] = useState<{ open: boolean; editing: (RentForm & { id?: string }) | null }>({ open: false, editing: null })
  const [importRentOpen, setImportRentOpen] = useState(false)
  const [extractRows, setExtractRows] = useState<any[]>([])
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractPreviewOpen, setExtractPreviewOpen] = useState(false)
  const extractFileRef = useRef<HTMLInputElement>(null)

  const BLANK_TRANCHE = { tranche_name: '', loan_amount: '', rate: '', rate_type: 'fixed', spread: '', index: '', amortization: '30', io_period: '0', maturity_date: '' }

  const closeTrancheDialog = () => {
    setShowAddTranche(false)
    setEditingTranche(null)
    setNewTranche(BLANK_TRANCHE)
  }

  const openEditTranche = (t: any) => {
    setEditingTranche(t)
    setNewTranche({
      tranche_name: t.tranche_name,
      loan_amount: String(t.loan_amount),
      rate: String(t.rate * 100),
      rate_type: t.rate_type,
      spread: t.spread ? String(t.spread * 10000) : '',
      index: t.index ?? '',
      amortization: String(t.amortization),
      io_period: String(t.io_period),
      maturity_date: t.maturity_date ?? '',
    })
    setShowAddTranche(true)
  }

  const addTranche = useMutation({
    mutationFn: async () => {
      await supabase.from('debt_tranches').insert({
        property_id: deal!.property_id,
        tranche_name: newTranche.tranche_name,
        loan_amount: Number(newTranche.loan_amount),
        rate: Number(newTranche.rate) / 100,
        rate_type: newTranche.rate_type as 'fixed' | 'floating',
        spread: newTranche.spread ? Number(newTranche.spread) / 10000 : null,
        index: newTranche.index || null,
        amortization: Number(newTranche.amortization),
        io_period: Number(newTranche.io_period),
        maturity_date: newTranche.maturity_date || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-tranches', deal?.property_id] })
      closeTrancheDialog()
    },
  })

  const updateTranche = useMutation({
    mutationFn: async () => {
      await supabase.from('debt_tranches').update({
        tranche_name: newTranche.tranche_name,
        loan_amount: Number(newTranche.loan_amount),
        rate: Number(newTranche.rate) / 100,
        rate_type: newTranche.rate_type as 'fixed' | 'floating',
        spread: newTranche.spread ? Number(newTranche.spread) / 10000 : null,
        index: newTranche.index || null,
        amortization: Number(newTranche.amortization),
        io_period: Number(newTranche.io_period),
        maturity_date: newTranche.maturity_date || null,
      }).eq('id', editingTranche!.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-tranches', deal?.property_id] })
      closeTrancheDialog()
    },
  })

  const deleteTranche = async (id: string) => {
    await supabase.from('debt_tranches').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['debt-tranches', deal?.property_id] })
  }

  const upsertWaterfall = useMutation({
    mutationFn: async () => {
      await supabase.from('waterfall_structure').upsert({
        property_id: deal!.property_id,
        preferred_return: Number(waterfallForm.preferred_return) / 100,
        gp_promote: Number(waterfallForm.gp_promote) / 100,
        hurdle_1: Number(waterfallForm.hurdle_1) / 100,
        hurdle_1_split_lp: Number(waterfallForm.hurdle_1_split_lp) / 100,
        hurdle_2: waterfallForm.hurdle_2 ? Number(waterfallForm.hurdle_2) / 100 : null,
        hurdle_2_split_lp: waterfallForm.hurdle_2_split_lp ? Number(waterfallForm.hurdle_2_split_lp) / 100 : null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waterfall', deal?.property_id] })
      setShowWaterfall(false)
    },
  })

  const deleteRentUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rent_roll').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rent-roll', deal?.property_id] }),
  })

  const confirmExtractedRows = useMutation({
    mutationFn: async () => {
      const rows = extractRows.map(r => ({ ...r, property_id: deal!.property_id }))
      const { error } = await supabase.from('rent_roll').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rent-roll', deal?.property_id] })
      setExtractPreviewOpen(false)
      setExtractRows([])
    },
  })

  function downloadRentRollTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Unit #', 'Type', 'Tenant Name', 'Lease Start', 'Lease End', 'Monthly Rent', 'SF', 'Status']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rent Roll')
    XLSX.writeFile(wb, 'rent_roll_template.xlsx')
  }

  async function handleExtractFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtractLoading(true)
    setExtractError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'rent-roll')
      const { data, error } = await supabase.functions.invoke('extract-document', { body: formData })
      if (error) throw new Error(error.message)
      const rows = Array.isArray(data?.rows) ? data.rows : []
      if (rows.length === 0) throw new Error('No rows extracted. Check the document format.')
      setExtractRows(rows)
      setExtractPreviewOpen(true)
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtractLoading(false)
      if (extractFileRef.current) extractFileRef.current.value = ''
    }
  }

  const advanceDeal = useMutation({
    mutationFn: async (newStage: string) => {
      await supabase.from('deals').update({ stage: newStage }).eq('id', dealId!)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal', dealId] }),
  })

  if (!deal) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
    </div>
  )

  const property = deal.properties as any

  // Compute live underwriting metrics
  const firstYearNOI = proFormaData?.[0]?.noi ?? inputs.purchasePrice * 0.055
  const egi = firstYearNOI / (1 - inputs.opexRatio)
  const capRate = calcCapRate(firstYearNOI, inputs.purchasePrice)
  const ltv = calcLTV(inputs.loanAmount, inputs.purchasePrice)
  const annualDS = inputs.loanAmount * inputs.annualRate + (inputs.loanAmount * 0.005)
  const dscr = calcDSCR(firstYearNOI, annualDS)
  const equity = inputs.purchasePrice - inputs.loanAmount
  const pf = buildProForma({ initialNOI: firstYearNOI, revenueGrowth: inputs.revenueGrowth, expenseGrowth: inputs.revenueGrowth * 0.8, vacancyRate: inputs.vacancyRate, operatingExpenseRatio: inputs.opexRatio, holdYears: inputs.holdYears, exitCapRate: inputs.exitCapRate, loanAmount: inputs.loanAmount, annualRate: inputs.annualRate, amortYears: inputs.amortYears, ioPeriod: inputs.ioPeriod, purchasePrice: inputs.purchasePrice })
  const exitVal = pf[pf.length - 1]?.exitValue ?? 0
  const netSale = exitVal * 0.97 - inputs.loanAmount * 0.8
  const irrCFs = [-equity, ...pf.map(y => y.cashFlow * inputs.lpShare)]
  irrCFs[irrCFs.length - 1] += netSale * inputs.lpShare
  const irr = calcIRR(irrCFs)
  const em = calcEquityMultiple(irrCFs.slice(1).reduce((a, b) => a + b, 0), equity * inputs.lpShare)

  const presetMetrics = useMemo(() => {
    const baseNOI = proFormaData?.[0]?.noi ?? inputs.purchasePrice * 0.055
    return (['conservative', 'base', 'optimistic'] as const).map(name => {
      const p = { ...inputs, ...PRESETS[name] }
      const pf2 = buildProForma({
        initialNOI: baseNOI,
        revenueGrowth: p.revenueGrowth,
        expenseGrowth: p.revenueGrowth * 0.8,
        vacancyRate: p.vacancyRate,
        operatingExpenseRatio: p.opexRatio,
        holdYears: p.holdYears,
        exitCapRate: p.exitCapRate,
        loanAmount: p.loanAmount,
        annualRate: p.annualRate,
        amortYears: p.amortYears,
        ioPeriod: p.ioPeriod,
        purchasePrice: p.purchasePrice,
      })
      const exitV = pf2[pf2.length - 1]?.exitValue ?? 0
      const eq = p.purchasePrice - p.loanAmount
      const cfs = [-eq, ...pf2.map(y => y.cashFlow * p.lpShare)]
      cfs[cfs.length - 1] += (exitV * 0.97 - p.loanAmount * 0.8) * p.lpShare
      return { name, irr: calcIRR(cfs), em: calcEquityMultiple(cfs.slice(1).reduce((a, b) => a + b, 0), eq * p.lpShare) }
    })
  }, [inputs, proFormaData])

  const stages = ['sourced', 'screening', 'loi', 'due_diligence', 'closing']
  const currentStageIdx = stages.indexOf(deal.stage)
  const stageProgress = ((currentStageIdx + 1) / stages.length) * 100

  const nextStage = stages[currentStageIdx + 1]

  // ── Debt summary ──────────────────────────────────────────────────────────
  const totalDebt = tranches.reduce((s: number, t: any) => s + t.loan_amount, 0)
  const blendedRate = totalDebt > 0 ? tranches.reduce((s: number, t: any) => s + t.rate * t.loan_amount, 0) / totalDebt : 0
  const weightedTerm = totalDebt > 0 ? tranches.reduce((s: number, t: any) => s + t.amortization * t.loan_amount, 0) / totalDebt : 0

  // ── Amortization preview ──────────────────────────────────────────────────
  const amortTranche = (selectedTrancheId ? tranches.find((t: any) => t.id === selectedTrancheId) : tranches[0]) as any ?? null
  const amortSchedule = useMemo(
    () => amortTranche ? buildAmortSchedule(amortTranche.loan_amount, amortTranche.rate, amortTranche.amortization, amortTranche.io_period) : [],
    [amortTranche?.id, amortTranche?.loan_amount, amortTranche?.rate, amortTranche?.amortization, amortTranche?.io_period]
  )

  // ── Waterfall scenarios ───────────────────────────────────────────────────
  const scenarioExitVal = exitVal * (exitScenario === 'low' ? 0.80 : exitScenario === 'high' ? 1.20 : 1.0)
  const scenarioNetSale = scenarioExitVal * 0.97 - inputs.loanAmount * 0.8

  const waterfallTiers = waterfall ? [
    { label: 'Return of Capital', lpPct: inputs.lpShare, gpPct: 1 - inputs.lpShare, note: 'Pro-rata' },
    { label: 'Preferred Return', lpPct: 1, gpPct: 0, note: `${formatPercent(waterfall.preferred_return)} pref` },
    { label: `Hurdle 1 (>${formatPercent(waterfall.hurdle_1)})`, lpPct: waterfall.hurdle_1_split_lp, gpPct: 1 - waterfall.hurdle_1_split_lp, note: `LP ${(waterfall.hurdle_1_split_lp * 100).toFixed(0)} / GP ${((1 - waterfall.hurdle_1_split_lp) * 100).toFixed(0)}` },
    ...(waterfall.hurdle_2 != null ? [{ label: `Hurdle 2 (>${formatPercent(waterfall.hurdle_2)})`, lpPct: waterfall.hurdle_2_split_lp ?? 0, gpPct: 1 - (waterfall.hurdle_2_split_lp ?? 0), note: `LP ${((waterfall.hurdle_2_split_lp ?? 0) * 100).toFixed(0)} / GP ${((1 - (waterfall.hurdle_2_split_lp ?? 0)) * 100).toFixed(0)}` }] : []),
    { label: 'Above All Hurdles', lpPct: 1 - waterfall.gp_promote, gpPct: waterfall.gp_promote, note: `${formatPercent(waterfall.gp_promote)} GP promote` },
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to="/deal-flow">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{property?.name}</h1>
              <Badge variant={STAGE_COLORS[deal.stage]}>{STAGE_LABELS[deal.stage]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{property?.address}, {property?.city}, {property?.state} · {property?.property_type}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {nextStage && !['closed', 'dead'].includes(deal.stage) && (
            <Button variant="brand" size="sm" onClick={() => advanceDeal.mutate(nextStage)} disabled={advanceDeal.isPending}>
              Advance to {STAGE_LABELS[nextStage]}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportUWModel({
              propertyName: property?.name ?? 'Property',
              address: `${property?.address ?? ''}, ${property?.city ?? ''}, ${property?.state ?? ''}`,
              propertyType: property?.property_type ?? '',
              units: property?.units,
              purchasePrice: inputs.purchasePrice,
              loanAmount: inputs.loanAmount,
              annualRate: inputs.annualRate,
              ltv, capRate, dscr, irr,
              equityMultiple: em,
              proForma: pf,
              assumptions: {
                'Purchase Price': inputs.purchasePrice,
                'Loan Amount': inputs.loanAmount,
                'Interest Rate': `${(inputs.annualRate * 100).toFixed(2)}%`,
                'Amortization': `${inputs.amortYears} years`,
                'IO Period': `${inputs.ioPeriod} years`,
                'Vacancy Rate': `${(inputs.vacancyRate * 100).toFixed(1)}%`,
                'OpEx Ratio': `${(inputs.opexRatio * 100).toFixed(1)}%`,
                'Revenue Growth': `${(inputs.revenueGrowth * 100).toFixed(1)}%`,
                'Hold Period': `${inputs.holdYears} years`,
                'Exit Cap Rate': `${(inputs.exitCapRate * 100).toFixed(2)}%`,
                'LP Share': `${(inputs.lpShare * 100).toFixed(0)}%`,
              },
            })}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportPDF({
              propertyName: property?.name ?? 'Property',
              address: property?.address ?? '',
              city: property?.city ?? '',
              state: property?.state ?? '',
              propertyType: property?.property_type ?? '',
              units: property?.units,
              sf: property?.sf,
              yearBuilt: property?.year_built,
              purchasePrice: inputs.purchasePrice,
              loanAmount: inputs.loanAmount,
              equity,
              ltv, capRate, dscr, irr,
              equityMultiple: em,
              cashOnCash: pf[0]?.cashFlow / equity,
              noi: firstYearNOI,
              gpi: pf[0]?.gpi ?? firstYearNOI * 1.5,
              vacancyRate: inputs.vacancyRate,
              opexRatio: inputs.opexRatio,
              brokerName: deal.broker_name ?? undefined,
              brokerEmail: deal.broker_email ?? undefined,
              stage: deal.stage,
              notes: deal.notes ?? undefined,
            })}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          {stages.map((s, i) => (
            <span key={s} className={i <= currentStageIdx ? 'text-brand-teal-light font-medium' : ''}>{STAGE_LABELS[s]}</span>
          ))}
        </div>
        <Progress value={stageProgress} className="h-2" />
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Purchase Price', value: formatCurrency(inputs.purchasePrice) },
          { label: 'Cap Rate', value: formatPercent(capRate) },
          { label: 'LTV', value: formatPercent(ltv) },
          { label: 'DSCR', value: dscr.toFixed(2) + 'x' },
          { label: 'LP IRR', value: formatPercent(irr) },
          { label: 'Equity Multiple', value: em.toFixed(2) + 'x' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-bold font-mono">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="proforma">
        <TabsList>
          <TabsTrigger value="proforma"><BarChart3 className="mr-2 h-4 w-4" />Pro Forma</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="rent-roll"><Users className="mr-2 h-4 w-4" />Rent Roll</TabsTrigger>
          <TabsTrigger value="debt"><Layers className="mr-2 h-4 w-4" />Debt</TabsTrigger>
          <TabsTrigger value="waterfall"><TrendingUp className="mr-2 h-4 w-4" />Waterfall</TabsTrigger>
          <TabsTrigger value="checklist"><CheckSquare className="mr-2 h-4 w-4" />UW Checklist</TabsTrigger>
          <TabsTrigger value="research"><FileText className="mr-2 h-4 w-4" />Research</TabsTrigger>
        </TabsList>

        <TabsContent value="proforma" className="mt-4">
          <div className="flex gap-4 items-start">
            {/* ── Left panel: Assumptions ─────────────────────────── */}
            <div className="w-72 shrink-0 space-y-4">
              {/* Scenario Presets */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Scenario Presets</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['conservative', 'base', 'optimistic'] as const).map(p => {
                      const m = presetMetrics.find(x => x.name === p)
                      const active = preset === p
                      return (
                        <button
                          key={p}
                          onClick={() => applyPreset(p)}
                          className={cn(
                            'rounded-md border px-1.5 py-2 text-center transition-colors',
                            active ? 'border-brand-teal bg-brand-teal/10' : 'border-border hover:border-brand-teal/40'
                          )}
                        >
                          <p className={cn('text-[10px] font-semibold uppercase tracking-wide capitalize', active ? 'text-brand-teal-light' : 'text-muted-foreground')}>{p}</p>
                          <p className="mt-0.5 text-xs font-mono font-bold">{m ? formatPercent(m.irr) : '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{m ? `${m.em.toFixed(2)}x EM` : ''}</p>
                        </button>
                      )
                    })}
                  </div>
                  {preset === 'custom' && (
                    <p className="mt-2 text-center text-[10px] text-muted-foreground">Custom inputs active</p>
                  )}
                </CardContent>
              </Card>

              {/* Key Levers — sliders */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Key Levers</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  {([
                    { key: 'vacancyRate' as const, label: 'Vacancy Rate', min: 0, max: 20, step: 0.5, unit: '%', factor: 100 },
                    { key: 'revenueGrowth' as const, label: 'Revenue Growth', min: 0, max: 8, step: 0.25, unit: '%', factor: 100 },
                    { key: 'exitCapRate' as const, label: 'Exit Cap Rate', min: 3, max: 10, step: 0.25, unit: '%', factor: 100 },
                    { key: 'holdYears' as const, label: 'Hold Period', min: 1, max: 15, step: 1, unit: 'yr', factor: 1 },
                  ] as const).map(({ key, label, min, max, step, unit, factor }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-xs">{label}</Label>
                        <span className="text-xs font-mono font-bold text-brand-teal-light">
                          {factor === 100 ? (inputs[key] * 100).toFixed(1) : inputs[key]}{unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={factor === 100 ? inputs[key] * 100 : inputs[key]}
                        onChange={e => setInput(key, (factor === 100 ? Number(e.target.value) / 100 : Number(e.target.value)) as UWInputs[typeof key])}
                        className="w-full h-1 cursor-pointer accent-[#0D9488]"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{min}{unit}</span><span>{max}{unit}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* All Assumptions */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">All Assumptions</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5">
                  {(Object.entries(inputs) as [keyof UWInputs, number][]).map(([key, val]) => {
                    const isPercent = ['annualRate', 'vacancyRate', 'opexRatio', 'revenueGrowth', 'exitCapRate', 'lpShare'].includes(key)
                    return (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step={isPercent ? 0.01 : 100000}
                            value={isPercent ? (val * 100).toFixed(2) : val}
                            onChange={e => setInput(key, isPercent ? Number(e.target.value) / 100 : Number(e.target.value))}
                            className="h-7 text-xs font-mono"
                          />
                          {isPercent && <span className="shrink-0 text-xs text-muted-foreground">%</span>}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {/* ── Right panel: Pro Forma Table ─────────────────────── */}
            <div className="flex-1 min-w-0">
              <ProFormaTable rows={pf} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sensitivity" className="mt-4">
          <IRRSensitivityMatrix baseIRR={irr} baseParams={inputs} equity={equity} initialNOI={firstYearNOI} />
        </TabsContent>

        {/* ─── Rent Roll ─────────────────────────────────────────────── */}
        <TabsContent value="rent-roll" className="mt-4">
          <div className="space-y-4">
            {rentRoll.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total Units', value: String(rentRoll.length) },
                  {
                    label: 'Occupied',
                    value: `${rentRoll.filter(u => u.status === 'occupied').length} (${Math.round(rentRoll.filter(u => u.status === 'occupied').length / rentRoll.length * 100)}%)`,
                  },
                  {
                    label: 'Monthly Income',
                    value: formatCurrency(rentRoll.filter(u => u.status === 'occupied').reduce((a, u) => a + u.monthly_rent, 0)),
                  },
                  {
                    label: 'Avg Rent / Unit',
                    value: formatCurrency(rentRoll.reduce((a, u) => a + u.monthly_rent, 0) / rentRoll.length),
                  },
                ].map(({ label, value }) => (
                  <Card key={label}><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-bold font-mono">{value}</p>
                  </CardContent></Card>
                ))}
              </div>
            )}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Rent Roll ({rentRoll.length} units)</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadRentRollTemplate}>
                    <Download className="h-3.5 w-3.5" /> Template
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setImportRentOpen(true)}
                    disabled={!deal?.property_id}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Import Excel
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => extractFileRef.current?.click()}
                    disabled={extractLoading || !deal?.property_id}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {extractLoading ? 'Extracting...' : 'Extract from Doc'}
                  </Button>
                  <Button
                    variant="brand" size="sm" className="gap-1.5"
                    onClick={() => setRentDialog({ open: true, editing: null })}
                    disabled={!deal?.property_id}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Unit
                  </Button>
                </div>
              </CardHeader>
              {extractError && (
                <div className="px-4 pb-2 text-sm text-destructive">{extractError}</div>
              )}
              <CardContent className="overflow-x-auto p-0">
                {rentRoll.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No rent roll data for this property. Add units manually, import from Excel, or extract from a document.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Unit', 'Type', 'Tenant', 'SQFT', 'Rent/SF', 'Monthly Rent', 'Lease Start', 'Lease End', 'Status', ''].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rentRoll.map(unit => (
                        <tr key={unit.id} className="group border-b border-border/50 hover:bg-secondary/30">
                          <td className="px-3 py-2 font-medium">{unit.unit_number}</td>
                          <td className="px-3 py-2 text-muted-foreground">{unit.unit_type}</td>
                          <td className="px-3 py-2 text-muted-foreground">{unit.tenant_name ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{unit.sqft ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {unit.sqft ? `$${(unit.monthly_rent / unit.sqft).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-brand-teal-light">{formatCurrency(unit.monthly_rent)}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{unit.lease_start ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{unit.lease_end ?? '—'}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={unit.status === 'occupied' ? 'success' : unit.status === 'notice' ? 'warning' : unit.status === 'model' ? 'teal' : 'outline'}
                              className="text-xs"
                            >
                              {unit.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
                                onClick={() => setRentDialog({
                                  open: true,
                                  editing: {
                                    id: unit.id,
                                    unit_number: unit.unit_number,
                                    unit_type: unit.unit_type,
                                    tenant_name: unit.tenant_name ?? '',
                                    lease_start: unit.lease_start ?? '',
                                    lease_end: unit.lease_end ?? '',
                                    monthly_rent: String(unit.monthly_rent),
                                    sqft: String(unit.sqft ?? ''),
                                    status: unit.status,
                                  },
                                })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteRentUnit.mutate(unit.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Debt ───────────────────────────────────────────────────── */}
        <TabsContent value="debt" className="mt-4">
          <div className="space-y-6">
            {/* Loan summary bar */}
            {tranches.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Debt</p>
                  <p className="text-xl font-mono font-bold">{formatCurrency(totalDebt)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Blended Rate</p>
                  <p className="text-xl font-mono font-bold">{formatPercent(blendedRate)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Wtd Avg Amort</p>
                  <p className="text-xl font-mono font-bold">{weightedTerm.toFixed(1)}yr</p>
                </Card>
              </div>
            )}

            {/* Debt Tranches */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Debt Tranches</CardTitle>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddTranche(true)}>
                    <Plus className="h-4 w-4" /> Add Tranche
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {tranches.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No debt tranches recorded.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Tranche', 'Amount', 'Rate', 'Type', 'Amort', 'I/O', 'Maturity', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tranches.map(t => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTrancheId(t.id)}
                          className={`cursor-pointer border-b border-border/50 transition-colors ${selectedTrancheId === t.id ? 'bg-brand-teal/10 ring-1 ring-inset ring-brand-teal/30' : 'hover:bg-secondary/30'}`}
                        >
                          <td className="px-4 py-2 font-medium">{t.tranche_name}</td>
                          <td className="px-4 py-2 font-mono text-xs">{formatCurrency(t.loan_amount)}</td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {t.rate_type === 'floating' && t.index
                              ? `${t.index} + ${((t.spread ?? 0) * 10000).toFixed(0)}bps`
                              : formatPercent(t.rate)}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={t.rate_type === 'fixed' ? 'teal' : 'warning'} className="text-xs">{t.rate_type}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{t.amortization}yr</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{t.io_period}yr</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{t.maturity_date ?? '—'}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); openEditTranche(t) }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); deleteTranche(t.id) }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Amortization schedule preview */}
            {amortTranche && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Amortization Schedule</CardTitle>
                    {tranches.length > 1 && (
                      <select
                        value={selectedTrancheId ?? tranches[0]?.id}
                        onChange={e => setSelectedTrancheId(e.target.value)}
                        className="rounded-md border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {tranches.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.tranche_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Year', 'Annual Payment', 'Interest', 'Principal', 'Ending Balance'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {amortSchedule.map(row => (
                        <tr key={row.year} className="border-b border-border/40 hover:bg-secondary/20">
                          <td className="px-4 py-2 text-xs text-muted-foreground">Yr {row.year}</td>
                          <td className="px-4 py-2 font-mono text-xs">{formatCurrency(row.payment)}</td>
                          <td className="px-4 py-2 font-mono text-xs text-destructive/80">{formatCurrency(row.interest)}</td>
                          <td className="px-4 py-2 font-mono text-xs text-emerald-400">{formatCurrency(row.principal)}</td>
                          <td className="px-4 py-2 font-mono text-xs">{formatCurrency(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── Waterfall ──────────────────────────────────────────────── */}
        <TabsContent value="waterfall" className="mt-4">
          <div className="space-y-6">
            {/* Waterfall Structure */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Waterfall Structure</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => {
                    setWaterfallForm({
                      preferred_return: waterfall ? String(waterfall.preferred_return * 100) : '',
                      gp_promote: waterfall ? String(waterfall.gp_promote * 100) : '',
                      hurdle_1: waterfall ? String(waterfall.hurdle_1 * 100) : '',
                      hurdle_1_split_lp: waterfall ? String(waterfall.hurdle_1_split_lp * 100) : '',
                      hurdle_2: waterfall?.hurdle_2 ? String(waterfall.hurdle_2 * 100) : '',
                      hurdle_2_split_lp: waterfall?.hurdle_2_split_lp ? String(waterfall.hurdle_2_split_lp * 100) : '',
                    })
                    setShowWaterfall(true)
                  }}>
                    {waterfall ? 'Edit Waterfall' : 'Set Up Waterfall'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {waterfall ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Preferred Return</p>
                        <p className="text-lg font-mono font-bold">{formatPercent(waterfall.preferred_return)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">GP Promote</p>
                        <p className="text-lg font-mono font-bold">{formatPercent(waterfall.gp_promote)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Hurdle 1</p>
                        <p className="text-lg font-mono font-bold">
                          {formatPercent(waterfall.hurdle_1)}{' '}
                          <span className="text-sm font-normal text-muted-foreground">({formatPercent(waterfall.hurdle_1_split_lp)} LP)</span>
                        </p>
                      </div>
                      {waterfall.hurdle_2 != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Hurdle 2</p>
                          <p className="text-lg font-mono font-bold">
                            {formatPercent(waterfall.hurdle_2)}{' '}
                            <span className="text-sm font-normal text-muted-foreground">({formatPercent(waterfall.hurdle_2_split_lp ?? 0)} LP)</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Visual tier bars */}
                    <div className="mt-6 space-y-3 border-t border-border pt-4">
                      <p className="text-sm font-semibold">Distribution Tiers</p>
                      {waterfallTiers.map((tier, i) => (
                        <div key={i}>
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>{tier.label}</span>
                            <span>{tier.note}</span>
                          </div>
                          <div className="flex h-6 overflow-hidden rounded">
                            <div
                              className="flex items-center justify-center bg-brand-teal/70 text-[10px] font-semibold text-white"
                              style={{ width: `${tier.lpPct * 100}%` }}
                            >
                              {tier.lpPct >= 0.12 ? `LP ${(tier.lpPct * 100).toFixed(0)}%` : ''}
                            </div>
                            <div
                              className="flex items-center justify-center bg-purple-500/70 text-[10px] font-semibold text-white"
                              style={{ width: `${tier.gpPct * 100}%` }}
                            >
                              {tier.gpPct >= 0.12 ? `GP ${(tier.gpPct * 100).toFixed(0)}%` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No waterfall structure defined for this property.</p>
                )}
              </CardContent>
            </Card>

            {/* Exit scenario analysis */}
            {waterfall && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Exit Scenario Analysis</CardTitle>
                    <div className="flex gap-1 rounded-md border border-border p-0.5">
                      {(['low', 'base', 'high'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setExitScenario(s)}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${exitScenario === s ? 'bg-brand-teal text-white' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {s === 'low' ? 'Bear −20%' : s === 'base' ? 'Base' : 'Bull +20%'}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const wf = calcWaterfall({
                      totalEquity: equity,
                      lpShare: inputs.lpShare,
                      gpShare: 1 - inputs.lpShare,
                      cashFlows: pf.map(y => y.cashFlow),
                      exitProceeds: scenarioNetSale,
                      preferredReturn: waterfall.preferred_return,
                      gpPromote: waterfall.gp_promote,
                      hurdle1: waterfall.hurdle_1,
                      hurdle1LPSplit: waterfall.hurdle_1_split_lp,
                      hurdle2: waterfall.hurdle_2 ?? undefined,
                      hurdle2LPSplit: waterfall.hurdle_2_split_lp ?? undefined,
                    })
                    const total = wf.lpDistribution + wf.gpDistribution
                    const lpPct = total > 0 ? wf.lpDistribution / total : inputs.lpShare
                    const gpPct = 1 - lpPct
                    return (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Exit Value</p>
                            <p className="font-mono font-bold">{formatCurrency(scenarioExitVal)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">LP Distribution</p>
                            <p className="font-mono font-bold text-emerald-400">{formatCurrency(wf.lpDistribution)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">GP Distribution</p>
                            <p className="font-mono font-bold text-purple-400">{formatCurrency(wf.gpDistribution)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">LP IRR</p>
                            <p className="font-mono font-bold text-emerald-400">{formatPercent(wf.lpIRR)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">LP Equity Multiple</p>
                            <p className="font-mono font-bold text-emerald-400">{wf.lpEquityMultiple.toFixed(2)}x</p>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">Proceeds Split</p>
                          <div className="flex h-6 overflow-hidden rounded">
                            <div
                              className="flex items-center justify-center bg-brand-teal/70 text-[10px] font-semibold text-white"
                              style={{ width: `${lpPct * 100}%` }}
                            >
                              {lpPct >= 0.12 ? `LP ${(lpPct * 100).toFixed(0)}%` : ''}
                            </div>
                            <div
                              className="flex items-center justify-center bg-purple-500/70 text-[10px] font-semibold text-white"
                              style={{ width: `${gpPct * 100}%` }}
                            >
                              {gpPct >= 0.12 ? `GP ${(gpPct * 100).toFixed(0)}%` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <UWChecklist dealId={dealId!} />
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <ScrapePanel propertyId={deal.property_id} />
        </TabsContent>
      </Tabs>

      {/* Add Tranche Dialog */}
      <Dialog open={showAddTranche} onOpenChange={closeTrancheDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingTranche ? 'Edit Debt Tranche' : 'Add Debt Tranche'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tranche Name</Label>
              <Input placeholder="Senior Loan" value={newTranche.tranche_name} onChange={e => setNewTranche(p => ({ ...p, tranche_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Loan Amount ($)</Label>
                <Input type="number" placeholder="7000000" value={newTranche.loan_amount} onChange={e => setNewTranche(p => ({ ...p, loan_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rate (%)</Label>
                <Input type="number" step="0.01" placeholder="6.50" value={newTranche.rate} onChange={e => setNewTranche(p => ({ ...p, rate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rate Type</Label>
                <Select value={newTranche.rate_type} onValueChange={v => setNewTranche(p => ({ ...p, rate_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="floating">Floating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Index (if floating)</Label>
                <Input placeholder="SOFR" value={newTranche.index} onChange={e => setNewTranche(p => ({ ...p, index: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Spread (bps)</Label>
                <Input type="number" placeholder="250" value={newTranche.spread} onChange={e => setNewTranche(p => ({ ...p, spread: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Amort (yrs)</Label>
                <Input type="number" value={newTranche.amortization} onChange={e => setNewTranche(p => ({ ...p, amortization: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>I/O (yrs)</Label>
                <Input type="number" value={newTranche.io_period} onChange={e => setNewTranche(p => ({ ...p, io_period: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Maturity Date</Label>
              <Input type="date" value={newTranche.maturity_date} onChange={e => setNewTranche(p => ({ ...p, maturity_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTrancheDialog}>Cancel</Button>
            <Button
              variant="brand"
              onClick={() => editingTranche ? updateTranche.mutate() : addTranche.mutate()}
              disabled={!newTranche.tranche_name || !newTranche.loan_amount || !newTranche.rate || addTranche.isPending || updateTranche.isPending}
            >
              {(addTranche.isPending || updateTranche.isPending) ? 'Saving...' : editingTranche ? 'Save Changes' : 'Add Tranche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for extract-from-doc */}
      <input
        ref={extractFileRef}
        type="file"
        accept=".pdf,.xlsx,.xls"
        className="hidden"
        onChange={handleExtractFile}
      />

      {/* Rent Roll Add/Edit Dialog */}
      {rentDialog.open && deal?.property_id && (
        <RentUnitDialog
          key={rentDialog.editing?.id ?? 'new'}
          open={rentDialog.open}
          onClose={() => setRentDialog({ open: false, editing: null })}
          propertyId={deal.property_id}
          editing={rentDialog.editing}
          onSaved={() => qc.invalidateQueries({ queryKey: ['rent-roll', deal.property_id] })}
        />
      )}

      {/* Import Excel Dialog */}
      {importRentOpen && deal?.property_id && (
        <ImportExcelDialog
          mode="rent-roll"
          propertyId={deal.property_id}
          open={importRentOpen}
          onClose={() => setImportRentOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['rent-roll', deal.property_id] })}
        />
      )}

      {/* Extract from Doc — Preview & Confirm Dialog */}
      <Dialog open={extractPreviewOpen} onOpenChange={open => { if (!open) { setExtractPreviewOpen(false); setExtractRows([]) } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Extracted Rent Roll ({extractRows.length} units)</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/60">
                  {['Unit #', 'Type', 'Tenant', 'Lease Start', 'Lease End', 'Rent/mo', 'SF', 'Status'].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extractRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-1.5 font-medium">{r.unit_number ?? '—'}</td>
                    <td className="px-3 py-1.5">{r.unit_type ?? '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.tenant_name ?? '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.lease_start ?? '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.lease_end ?? '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{r.monthly_rent != null ? formatCurrency(r.monthly_rent) : '—'}</td>
                    <td className="px-3 py-1.5">{r.sqft ?? '—'}</td>
                    <td className="px-3 py-1.5">{r.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {confirmExtractedRows.isError && (
            <p className="text-sm text-destructive">{(confirmExtractedRows.error as Error).message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setExtractPreviewOpen(false); setExtractRows([]) }}>Cancel</Button>
            <Button variant="brand" onClick={() => confirmExtractedRows.mutate()} disabled={confirmExtractedRows.isPending}>
              {confirmExtractedRows.isPending ? 'Inserting...' : `Insert ${extractRows.length} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waterfall Dialog */}
      <Dialog open={showWaterfall} onOpenChange={setShowWaterfall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{waterfall ? 'Edit Waterfall Structure' : 'Set Up Waterfall Structure'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preferred Return (%)</Label>
                <Input type="number" step="0.1" placeholder="8.0" value={waterfallForm.preferred_return} onChange={e => setWaterfallForm(p => ({ ...p, preferred_return: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>GP Promote (%)</Label>
                <Input type="number" step="0.1" placeholder="20.0" value={waterfallForm.gp_promote} onChange={e => setWaterfallForm(p => ({ ...p, gp_promote: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hurdle 1 (%)</Label>
                <Input type="number" step="0.1" placeholder="10.0" value={waterfallForm.hurdle_1} onChange={e => setWaterfallForm(p => ({ ...p, hurdle_1: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Hurdle 1 LP Split (%)</Label>
                <Input type="number" step="0.1" placeholder="80.0" value={waterfallForm.hurdle_1_split_lp} onChange={e => setWaterfallForm(p => ({ ...p, hurdle_1_split_lp: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hurdle 2 (%) <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input type="number" step="0.1" placeholder="15.0" value={waterfallForm.hurdle_2} onChange={e => setWaterfallForm(p => ({ ...p, hurdle_2: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Hurdle 2 LP Split (%) <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input type="number" step="0.1" placeholder="70.0" value={waterfallForm.hurdle_2_split_lp} onChange={e => setWaterfallForm(p => ({ ...p, hurdle_2_split_lp: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWaterfall(false)}>Cancel</Button>
            <Button
              variant="brand"
              onClick={() => upsertWaterfall.mutate()}
              disabled={!waterfallForm.preferred_return || !waterfallForm.gp_promote || !waterfallForm.hurdle_1 || !waterfallForm.hurdle_1_split_lp || upsertWaterfall.isPending}
            >
              {upsertWaterfall.isPending ? 'Saving...' : 'Save Waterfall'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
