import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  mode: 'rent-roll' | 'unit-mix'
  propertyId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const RENT_ROLL_FIELDS = ['unit_number', 'unit_type', 'tenant_name', 'lease_start', 'lease_end', 'monthly_rent', 'sqft', 'status']
const UNIT_MIX_FIELDS = ['unit_type', 'units', 'sf', 'market_rent', 'in_place_rent']
const NUMERIC_FIELDS = new Set(['monthly_rent', 'sqft', 'units', 'sf', 'market_rent', 'in_place_rent'])

export default function ImportExcelDialog({ mode, propertyId, open, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = mode === 'rent-roll' ? RENT_ROLL_FIELDS : UNIT_MIX_FIELDS

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    if (!rawRows.length) { setError('File is empty.'); return }
    const hdrs = rawRows[0].map(String)
    const dataRows = rawRows.slice(1).filter(r => r.some(c => c !== null && c !== undefined && c !== ''))
    setHeaders(hdrs)
    setRows(dataRows)
    // Auto-detect mapping by normalizing header names
    const autoMap: Record<string, string> = {}
    for (const field of fields) {
      const match = hdrs.find(h => h.toLowerCase().replace(/[\s-]/g, '_') === field)
      if (match) autoMap[field] = match
    }
    setMapping(autoMap)
    setStep('preview')
  }

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const mapped = rows.map(row => {
        const obj: Record<string, any> = { property_id: propertyId }
        for (const field of fields) {
          const col = mapping[field]
          if (!col) continue
          const idx = headers.indexOf(col)
          const val = idx >= 0 ? row[idx] : undefined
          if (NUMERIC_FIELDS.has(field)) {
            obj[field] = val !== undefined && val !== '' ? Number(val) : null
          } else {
            obj[field] = val !== undefined && val !== '' ? String(val) : null
          }
        }
        return obj
      }).filter(r => mode === 'rent-roll' ? r.unit_number && r.monthly_rent : r.unit_type && r.units)

      if (mapped.length === 0) {
        setError('No valid rows found. Check that required fields (unit_number + monthly_rent for rent roll, or unit_type + units for unit mix) are mapped.')
        setImporting(false)
        return
      }

      const table = mode === 'rent-roll' ? 'rent_roll' : 'unit_mix'
      const { error: dbError } = await supabase.from(table).insert(mapped)
      if (dbError) throw dbError
      onSuccess()
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setStep('upload')
    setHeaders([])
    setRows([])
    setMapping({})
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const title = mode === 'rent-roll' ? 'Import Rent Roll from Excel' : 'Import Unit Mix from Excel'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx, .xls) or CSV file. The first row must be column headers.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-brand-teal hover:text-brand-teal-light"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Click to select a file</span>
              <span className="text-xs">.xlsx, .xls, .csv</span>
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Field mapping */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Map your columns to fields</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {fields.map(field => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs font-mono">{field}</Label>
                    <Select value={mapping[field] ?? ''} onValueChange={v => setMapping(p => ({ ...p, [field]: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="— skip —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— skip —</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Data preview */}
            <div>
              <p className="mb-2 text-sm font-medium">
                Preview — first {Math.min(rows.length, 10)} of {rows.length} rows
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/60">
                      {headers.map(h => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {headers.map((_, j) => (
                          <td key={j} className="whitespace-nowrap px-3 py-1.5">{row[j] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setHeaders([]); setRows([]) }}>
                Back
              </Button>
              <Button variant="brand" onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : `Import ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
