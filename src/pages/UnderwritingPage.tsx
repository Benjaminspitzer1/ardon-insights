import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, CheckSquare, BarChart3, DollarSign, FileText, FileSpreadsheet, Plus, Layers, Users } from 'lucide-react'
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
import { formatCurrency, formatPercent } from '@/lib/utils'
import { calcCapRate, calcDSCR, calcLTV, calcNOI, calcEGI, buildProForma, calcIRR, calcEquityMultiple, calcWaterfall } from '@/lib/calculators'
import ProFormaTable from '@/components/ProFormaTable'
import IRRSensitivityMatrix from '@/components/IRRSensitivityMatrix'
import UWChecklist from '@/components/UWChecklist'
import ScrapePanel from '@/components/ScrapePanel'

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
  const [newTranche, setNewTranche] = useState({ tranche_name: '', loan_amount: '', rate: '', rate_type: 'fixed', spread: '', index: '', amortization: '30', io_period: '0', maturity_date: '' })

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
      setShowAddTranche(false)
      setNewTranche({ tranche_name: '', loan_amount: '', rate: '', rate_type: 'fixed', spread: '', index: '', amortization: '30', io_period: '0', maturity_date: '' })
    },
  })

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

  const stages = ['sourced', 'screening', 'loi', 'due_diligence', 'closing']
  const currentStageIdx = stages.indexOf(deal.stage)
  const stageProgress = ((currentStageIdx + 1) / stages.length) * 100

  const nextStage = stages[currentStageIdx + 1]

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
          <TabsTrigger value="assumptions"><DollarSign className="mr-2 h-4 w-4" />Assumptions</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="rent-roll"><Users className="mr-2 h-4 w-4" />Rent Roll</TabsTrigger>
          <TabsTrigger value="debt"><Layers className="mr-2 h-4 w-4" />Debt & Waterfall</TabsTrigger>
          <TabsTrigger value="checklist"><CheckSquare className="mr-2 h-4 w-4" />UW Checklist</TabsTrigger>
          <TabsTrigger value="research"><FileText className="mr-2 h-4 w-4" />Research</TabsTrigger>
        </TabsList>

        <TabsContent value="proforma" className="mt-4">
          <ProFormaTable rows={pf} />
        </TabsContent>

        <TabsContent value="assumptions" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Underwriting Assumptions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {(Object.entries(inputs) as [keyof UWInputs, number][]).map(([key, val]) => {
                  const isPercent = ['annualRate', 'vacancyRate', 'opexRatio', 'revenueGrowth', 'exitCapRate', 'lpShare'].includes(key)
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step={isPercent ? 0.001 : 100000}
                          value={isPercent ? (val * 100).toFixed(2) : val}
                          onChange={e => setInputs(prev => ({ ...prev, [key]: isPercent ? Number(e.target.value) / 100 : Number(e.target.value) }))}
                          className="h-8 text-sm font-mono"
                        />
                        {isPercent && <span className="text-muted-foreground text-sm">%</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
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
              <CardContent className="overflow-x-auto p-0">
                {rentRoll.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No rent roll data for this property.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Unit', 'Type', 'Tenant', 'SQFT', 'Rent/SF', 'Monthly Rent', 'Lease Start', 'Lease End', 'Status'].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rentRoll.map(unit => (
                        <tr key={unit.id} className="border-b border-border/50 hover:bg-secondary/30">
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Debt & Waterfall ──────────────────────────────────────── */}
        <TabsContent value="debt" className="mt-4">
          <div className="space-y-6">
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
                        {['Tranche', 'Amount', 'Rate', 'Type', 'Amort', 'I/O', 'Maturity'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tranches.map(t => (
                        <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30">
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Waterfall Structure */}
            <Card>
              <CardHeader><CardTitle className="text-base">Waterfall Structure</CardTitle></CardHeader>
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

                    {/* Projected distributions */}
                    <div className="mt-6 border-t border-border pt-4">
                      <p className="mb-3 text-sm font-semibold">Projected Distributions</p>
                      {(() => {
                        const wf = calcWaterfall({
                          totalEquity: equity,
                          lpShare: inputs.lpShare,
                          gpShare: 1 - inputs.lpShare,
                          cashFlows: pf.map(y => y.cashFlow),
                          exitProceeds: exitVal * 0.97 - inputs.loanAmount * 0.8,
                          preferredReturn: waterfall.preferred_return,
                          gpPromote: waterfall.gp_promote,
                          hurdle1: waterfall.hurdle_1,
                          hurdle1LPSplit: waterfall.hurdle_1_split_lp,
                          hurdle2: waterfall.hurdle_2 ?? undefined,
                          hurdle2LPSplit: waterfall.hurdle_2_split_lp ?? undefined,
                        })
                        return (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground">LP Distribution</p>
                              <p className="font-mono font-bold text-emerald-400">{formatCurrency(wf.lpDistribution)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">GP Distribution</p>
                              <p className="font-mono font-bold">{formatCurrency(wf.gpDistribution)}</p>
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
                        )
                      })()}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No waterfall structure defined for this property.</p>
                )}
              </CardContent>
            </Card>
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
      <Dialog open={showAddTranche} onOpenChange={setShowAddTranche}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Debt Tranche</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setShowAddTranche(false)}>Cancel</Button>
            <Button
              variant="brand"
              onClick={() => addTranche.mutate()}
              disabled={!newTranche.tranche_name || !newTranche.loan_amount || !newTranche.rate || addTranche.isPending}
            >
              {addTranche.isPending ? 'Saving...' : 'Add Tranche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
