import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PROPERTY_TYPES = ['Multifamily', 'Office', 'Retail', 'Industrial', 'Mixed Use', 'Land']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '0'}
    />
  )
}

export default function NewPropertyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [sqft, setSqft] = useState('')
  const [units, setUnits] = useState('')
  const [yearBuilt, setYearBuilt] = useState('')
  const [grossRental, setGrossRental] = useState('')
  const [otherIncome, setOtherIncome] = useState('')
  const [vacancyRate, setVacancyRate] = useState('5')
  const [taxes, setTaxes] = useState('')
  const [insurance, setInsurance] = useState('')
  const [management, setManagement] = useState('')
  const [maintenance, setMaintenance] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Property name is required.')

      const gross = parseFloat(grossRental) || 0
      const other = parseFloat(otherIncome) || 0
      const vacancy = parseFloat(vacancyRate) || 0
      const egi = (gross + other) * (1 - vacancy / 100)
      const opex = (parseFloat(taxes) || 0) + (parseFloat(insurance) || 0) + (parseFloat(management) || 0) + (parseFloat(maintenance) || 0)
      const noi = egi - opex

      const { error } = await supabase.from('properties').insert({
        user_id: user!.id,
        name: name.trim(),
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || '',
        property_type: propertyType || 'multifamily',
        purchase_price: parseFloat(purchasePrice) || null,
        current_value: parseFloat(currentValue) || null,
        sf: parseFloat(sqft) || null,
        units: parseFloat(units) || null,
        year_built: parseFloat(yearBuilt) || null,
        gross_rental_income: gross || null,
        other_income: other || null,
        vacancy_rate: vacancy || null,
        operating_expenses: opex || null,
        noi: noi || null,
      })
      if (error) throw error
    },
    onSuccess: () => navigate('/properties'),
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Add New Property</h1>
          <p className="text-sm text-muted-foreground">Enter property details to add to your portfolio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/properties')}>Cancel</Button>
          <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save Property'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Property Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Property Name *">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunset Apartments" />
          </Field>
          <Field label="Address">
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City">
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Austin" />
            </Field>
            <Field label="State">
              <Input value={state} onChange={e => setState(e.target.value)} placeholder="TX" />
            </Field>
            <Field label="Zip Code">
              <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="78701" />
            </Field>
          </div>
          <Field label="Property Type">
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price ($)">
              <NumInput value={purchasePrice} onChange={setPurchasePrice} />
            </Field>
            <Field label="Current Value ($)">
              <NumInput value={currentValue} onChange={setCurrentValue} />
            </Field>
            <Field label="Square Feet">
              <NumInput value={sqft} onChange={setSqft} />
            </Field>
            <Field label="Units">
              <NumInput value={units} onChange={setUnits} />
            </Field>
            <Field label="Year Built">
              <NumInput value={yearBuilt} onChange={setYearBuilt} placeholder="2005" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Financial Information</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">Income</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gross Rental Income (Annual $)">
                <NumInput value={grossRental} onChange={setGrossRental} />
              </Field>
              <Field label="Other Income (Annual $)">
                <Input
                  type="number"
                  value={otherIncome}
                  onChange={e => setOtherIncome(e.target.value)}
                  placeholder="Parking, laundry, etc."
                />
              </Field>
              <Field label="Vacancy Rate (%)">
                <NumInput value={vacancyRate} onChange={setVacancyRate} placeholder="5" />
              </Field>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">Operating Expenses</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Property Taxes (Annual $)">
                <NumInput value={taxes} onChange={setTaxes} />
              </Field>
              <Field label="Insurance (Annual $)">
                <NumInput value={insurance} onChange={setInsurance} />
              </Field>
              <Field label="Property Management (Annual $)">
                <NumInput value={management} onChange={setManagement} />
              </Field>
              <Field label="Maintenance & Repairs (Annual $)">
                <NumInput value={maintenance} onChange={setMaintenance} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
