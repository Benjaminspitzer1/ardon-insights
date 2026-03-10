import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PROPERTY_TYPES = ['Multifamily', 'Office', 'Retail', 'Industrial', 'Mixed Use', 'Land']
const PROPERTY_STATUSES = ['active', 'pipeline', 'sold', 'inactive'] as const

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5${className ? ' ' + className : ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  property: Record<string, any>
}

export default function EditPropertyDialog({ open, onClose, property }: Props) {
  const qc = useQueryClient()

  const [name, setName] = useState(property.name ?? '')
  const [address, setAddress] = useState(property.address ?? '')
  const [city, setCity] = useState(property.city ?? '')
  const [state, setState] = useState(property.state ?? '')
  const [zip, setZip] = useState(property.zip ?? '')
  const [propertyType, setPropertyType] = useState(property.property_type ?? '')
  const [purchasePrice, setPurchasePrice] = useState(String(property.purchase_price ?? ''))
  const [currentValue, setCurrentValue] = useState(String(property.current_value ?? ''))
  const [sf, setSf] = useState(String(property.sf ?? ''))
  const [units, setUnits] = useState(String(property.units ?? ''))
  const [yearBuilt, setYearBuilt] = useState(String(property.year_built ?? ''))
  const [status, setStatus] = useState(property.status ?? 'pipeline')
  const [lat, setLat] = useState(String(property.lat ?? ''))
  const [lng, setLng] = useState(String(property.lng ?? ''))
  const [grossRental, setGrossRental] = useState(String(property.gross_rental_income ?? ''))
  const [otherIncome, setOtherIncome] = useState(String(property.other_income ?? ''))
  const [vacancyRate, setVacancyRate] = useState(String(property.vacancy_rate ?? '5'))
  const [operatingExpenses, setOperatingExpenses] = useState(String(property.operating_expenses ?? ''))
  const [noi, setNoi] = useState(String(property.noi ?? ''))

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Property name is required.')
      const gross = parseFloat(grossRental) || 0
      const other = parseFloat(otherIncome) || 0
      const vacancy = parseFloat(vacancyRate) || 0
      const opex = parseFloat(operatingExpenses) || 0
      const computedNoi = noi.trim()
        ? parseFloat(noi)
        : (gross + other) * (1 - vacancy / 100) - opex

      const { error } = await supabase.from('properties').update({
        name: name.trim(),
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || '',
        status,
        property_type: propertyType || 'multifamily',
        purchase_price: parseFloat(purchasePrice) || null,
        current_value: parseFloat(currentValue) || null,
        sf: parseFloat(sf) || null,
        units: parseFloat(units) || null,
        year_built: parseFloat(yearBuilt) || null,
        lat: parseFloat(lat) || null,
        lng: parseFloat(lng) || null,
        gross_rental_income: gross || null,
        other_income: other || null,
        vacancy_rate: vacancy || null,
        operating_expenses: opex || null,
        noi: computedNoi || null,
      }).eq('id', property.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property', property.id] })
      qc.invalidateQueries({ queryKey: ['properties'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Details</p>
            <Field label="Property Name *">
              <Input value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <Field label="Address">
              <Input value={address} onChange={e => setAddress(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City"><Input value={city} onChange={e => setCity(e.target.value)} /></Field>
              <Field label="State"><Input value={state} onChange={e => setState(e.target.value)} /></Field>
              <Field label="Zip"><Input value={zip} onChange={e => setZip(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Property Type">
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchase Price ($)">
                <Input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
              </Field>
              <Field label="Current Value ($)">
                <Input type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)} />
              </Field>
              <Field label="Square Feet">
                <Input type="number" value={sf} onChange={e => setSf(e.target.value)} />
              </Field>
              <Field label="Units">
                <Input type="number" value={units} onChange={e => setUnits(e.target.value)} />
              </Field>
              <Field label="Year Built">
                <Input type="number" value={yearBuilt} onChange={e => setYearBuilt(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <Input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 40.7128" />
              </Field>
              <Field label="Longitude">
                <Input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. -74.0060" />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financials</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gross Rental Income (Annual $)">
                <Input type="number" value={grossRental} onChange={e => setGrossRental(e.target.value)} />
              </Field>
              <Field label="Other Income (Annual $)">
                <Input type="number" value={otherIncome} onChange={e => setOtherIncome(e.target.value)} />
              </Field>
              <Field label="Vacancy Rate (%)">
                <Input type="number" value={vacancyRate} onChange={e => setVacancyRate(e.target.value)} />
              </Field>
              <Field label="Operating Expenses (Annual $)">
                <Input type="number" value={operatingExpenses} onChange={e => setOperatingExpenses(e.target.value)} />
              </Field>
              <Field label="NOI (Annual $)" className="col-span-2">
                <Input type="number" value={noi} onChange={e => setNoi(e.target.value)} placeholder="Auto-calculated if blank" />
              </Field>
            </div>
          </div>
        </div>

        {save.isError && (
          <p className="text-sm text-destructive">{(save.error as Error).message}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
