import { useRef, useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText, FileSpreadsheet, Image, File, FileX, Upload, Trash2,
  Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle, AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'PDF'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'Excel'
  if (['docx', 'doc'].includes(ext)) return 'Word'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image'
  return 'Other'
}

function FileIcon({ type }: { type: string }) {
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

function ExtractionStatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'pending') return null
  if (status === 'processing') return <Badge variant="outline" className="gap-1 text-[10px]"><Loader2 className="h-3 w-3 animate-spin" />Extracting</Badge>
  if (status === 'done') return <Badge variant="success" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" />Extracted</Badge>
  if (status === 'error') return <Badge variant="danger" className="gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Error</Badge>
  return null
}

function flattenExtracted(data: any, prefix = ''): { key: string; value: string }[] {
  if (!data || typeof data !== 'object') return []
  const rows: { key: string; value: string }[] = []
  for (const [k, v] of Object.entries(data)) {
    const label = prefix ? `${prefix} › ${k}` : k
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') {
          rows.push(...flattenExtracted(item, `${label}[${i + 1}]`))
        } else {
          rows.push({ key: `${label}[${i + 1}]`, value: String(item) })
        }
      })
    } else if (v !== null && typeof v === 'object') {
      rows.push(...flattenExtracted(v, label))
    } else if (v !== null && v !== '') {
      rows.push({ key: label, value: String(v) })
    }
  }
  return rows
}

const DESTINATION_OPTIONS = [
  { value: 'rent_roll', label: 'Rent Roll → Bulk import rows' },
  { value: 'debt_tranche', label: 'Debt → Add tranche(s)' },
  { value: 'property_name', label: 'Property → Name' },
  { value: 'property_address', label: 'Property → Address' },
  { value: 'property_purchase_price', label: 'Property → Purchase Price' },
  { value: 'property_noi', label: 'Property → NOI' },
  { value: 'property_gross_rental_income', label: 'Property → Gross Income' },
  { value: 'property_operating_expenses', label: 'Property → Operating Expenses' },
]

export default function DocumentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [reviewDoc, setReviewDoc] = useState<any | null>(null)

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const docs = query.state.data as any[] | undefined
      const processing = docs?.some((d: any) => d.extraction_status === 'processing')
      return processing ? 3000 : false
    },
  })

  // Fetch user profile to check auto_extract preference
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('auto_extract').eq('id', user!.id).single()
      return data
    },
    enabled: !!user,
  })

  const handleExtract = async (doc: any) => {
    setExtracting(doc.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('documents').update({ extraction_status: 'processing' }).eq('id', doc.id)
      qc.invalidateQueries({ queryKey: ['documents'] })
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ document_id: doc.id, storage_path: doc.storage_path, file_type: doc.type }),
      })
      qc.invalidateQueries({ queryKey: ['documents'] })
    } catch {
      await supabase.from('documents').update({ extraction_status: 'error' }).eq('id', doc.id)
      qc.invalidateQueries({ queryKey: ['documents'] })
    } finally {
      setExtracting(null)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    setUploading(true)
    setUploadError(null)
    try {
      const uploadedDocs: any[] = []
      for (const file of files) {
        const path = `${user.id}/${Date.now()}_${file.name}`
        const { error: storageError } = await supabase.storage.from('documents').upload(path, file)
        if (storageError) throw storageError
        const { data: inserted } = await supabase.from('documents').insert({
          user_id: user.id,
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          storage_path: path,
          extraction_status: 'pending',
        }).select().single()
        if (inserted) uploadedDocs.push(inserted)
      }
      qc.invalidateQueries({ queryKey: ['documents'] })

      // Auto-extract if user preference is set
      if (profile?.auto_extract) {
        for (const doc of uploadedDocs) {
          if (doc.type === 'PDF' || doc.type === 'Word') {
            handleExtract(doc)
          }
        }
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (doc: any) => {
    if (doc.storage_path) await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    qc.invalidateQueries({ queryKey: ['documents'] })
  }

  const allDocs = (documents ?? []).filter((d: any) =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load documents: {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">Upload, extract, and direct data from your investment documents</p>
        </div>
        <div className="flex items-center gap-2">
          {profile?.auto_extract && (
            <Badge variant="teal" className="text-[10px]">Auto-extract ON</Badge>
          )}
          <Button variant="brand" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      <Input
        placeholder="Search documents..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {allDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileX className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a PDF, Excel, or Word file to get started</p>
          <Button variant="brand" className="mt-4 gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {allDocs.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-4 rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors">
              <FileIcon type={doc.type ?? 'Other'} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.size ? formatBytes(doc.size) : '—'} · {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-xs">{doc.type ?? 'Other'}</Badge>
                <ExtractionStatusBadge status={doc.extraction_status} />
                {(doc.type === 'PDF' || doc.type === 'Word') && doc.extraction_status !== 'processing' && (
                  <Button
                    variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                    onClick={() => handleExtract(doc)}
                    disabled={extracting === doc.id}
                  >
                    {extracting === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-brand-teal-light" />}
                    {doc.extraction_status === 'done' ? 'Re-extract' : 'Extract'}
                  </Button>
                )}
                {doc.extraction_status === 'done' && doc.extracted_data && (
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 h-7 text-xs text-brand-teal-light border-brand-teal/30 hover:bg-brand-teal/10"
                    onClick={() => setReviewDoc(doc)}
                  >
                    <ArrowRight className="h-3 w-3" /> Review &amp; Direct
                  </Button>
                )}
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReviewDirectDialog doc={reviewDoc} open={!!reviewDoc} onClose={() => setReviewDoc(null)} />
    </div>
  )
}

function ReviewDirectDialog({ doc, open, onClose }: { doc: any; open: boolean; onClose: () => void }) {
  const [destination, setDestination] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<string[]>([])
  const [trustAI, setTrustAI] = useState(false)
  const [currentProp, setCurrentProp] = useState<any>(null)
  const [overrideMap, setOverrideMap] = useState<Record<string, boolean>>({})
  const [showConflictStep, setShowConflictStep] = useState(false)

  const { data: properties } = useQuery({
    queryKey: ['properties-for-direct'],
    queryFn: async () => { const { data } = await supabase.from('properties').select('id, name, address, purchase_price, noi, gross_rental_income, operating_expenses').order('name'); return data ?? [] },
    enabled: open,
  })
  const { data: deals } = useQuery({
    queryKey: ['deals-for-direct'],
    queryFn: async () => { const { data } = await supabase.from('deals').select('id, name, property_id').order('name'); return data ?? [] },
    enabled: open,
  })

  // Fetch current property values when property_* destination selected
  useEffect(() => {
    if (!destination.startsWith('property_') || !properties?.[0]?.id) {
      setCurrentProp(null)
      return
    }
    supabase.from('properties').select('*').eq('id', properties[0].id).single()
      .then(({ data }) => setCurrentProp(data))
  }, [destination, properties])

  // Reset state when dialog opens/closes or destination changes
  useEffect(() => {
    setShowConflictStep(false)
  }, [destination, open])

  if (!doc) return null
  const rows = flattenExtracted(doc.extracted_data).filter(r => r.key !== 'summary')
  const extractedObj = doc.extracted_data ?? {}

  // Compute conflicts: fields where DB already has a different value
  const conflicts = useMemo<Record<string, { extracted: string; current: string }>>(() => {
    if (!destination.startsWith('property_') || !currentProp || !extractedObj.property) return {}
    const result: Record<string, { extracted: string; current: string }> = {}
    const field = destination.replace('property_', '')
    const extracted = extractedObj.property?.[field]
    const current = currentProp?.[field]
    if (current != null && current !== '' && extracted != null && String(current) !== String(extracted)) {
      result[field] = { extracted: String(extracted), current: String(current) }
    }
    return result
  }, [destination, currentProp, extractedObj])

  const hasConflicts = Object.keys(conflicts).length > 0

  // Initialize override map when conflicts change
  useEffect(() => {
    const init: Record<string, boolean> = {}
    for (const k of Object.keys(conflicts)) init[k] = true
    setOverrideMap(init)
  }, [conflicts])

  // Build a conflict key map for left panel highlighting
  const conflictFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const field of Object.keys(conflicts)) {
      keys.add(`property › ${field}`)
      keys.add(field)
    }
    return keys
  }, [conflicts])

  const handleApplyClick = () => {
    if (!trustAI && hasConflicts && !showConflictStep) {
      setShowConflictStep(true)
      return
    }
    applyData()
  }

  const applyData = async () => {
    if (!destination) return
    setApplying(true)
    setShowConflictStep(false)
    try {
      if (destination === 'rent_roll' && extractedObj.rent_roll?.length) {
        const propertyId = deals?.[0]?.property_id ?? properties?.[0]?.id
        const dealId = deals?.[0]?.id ?? null
        if (propertyId) {
          await supabase.from('rent_roll').insert(
            extractedObj.rent_roll.map((r: any) => ({
              property_id: propertyId, deal_id: dealId,
              unit_number: r.unit_number ?? '', unit_type: r.unit_type ?? '',
              tenant_name: r.tenant_name ?? '', monthly_rent: r.monthly_rent ?? null,
              sf: r.sf ?? null, lease_start: r.lease_start || null,
              lease_end: r.lease_end || null, status: r.status ?? 'occupied',
            }))
          )
          setApplied(p => [...p, destination])
        }
      } else if (destination === 'debt_tranche' && extractedObj.debt?.length) {
        const dealId = deals?.[0]?.id
        if (dealId) {
          await supabase.from('debt_tranches').insert(
            extractedObj.debt.map((d: any) => ({
              deal_id: dealId, tranche_name: d.tranche_name ?? 'Senior',
              loan_amount: d.loan_amount ?? null, interest_rate: d.interest_rate ?? null,
              amort_years: d.amort_years ?? null, term_months: d.term_months ?? null,
              tranche_type: d.tranche_type ?? 'senior',
            }))
          )
          setApplied(p => [...p, destination])
        }
      } else if (destination.startsWith('property_') && extractedObj.property) {
        const field = destination.replace('property_', '')
        const propertyId = properties?.[0]?.id
        if (propertyId && extractedObj.property[field] != null) {
          // Respect override map: if there's a conflict and user unchecked it, skip
          const shouldApply = trustAI || !conflicts[field] || overrideMap[field]
          if (shouldApply) {
            await supabase.from('properties').update({ [field]: extractedObj.property[field] }).eq('id', propertyId)
            setApplied(p => [...p, destination])
          }
        }
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle>Review &amp; Direct — {doc.name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">AI extracted the fields below. Choose where to send data in your deals or properties.</p>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: extracted fields */}
          <div className="w-1/2 border-r border-border overflow-y-auto p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Extracted Fields</p>
            {doc.extracted_data?.summary && (
              <div className="mb-3 rounded-lg bg-brand-teal/10 border border-brand-teal/20 p-3">
                <p className="text-xs font-medium text-brand-teal-light mb-1">Summary</p>
                <p className="text-sm">{doc.extracted_data.summary}</p>
              </div>
            )}
            {rows.map(row => {
              const isConflict = conflictFieldKeys.has(row.key)
              const fieldKey = row.key.split(' › ').pop() ?? row.key
              const conflictInfo = isConflict ? conflicts[fieldKey] : null
              return (
                <div key={row.key} className={cn(
                  'rounded px-3 py-2 text-sm',
                  isConflict ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-secondary/30'
                )}>
                  <div className="flex items-center gap-1.5">
                    {isConflict && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{row.key}</p>
                  </div>
                  <p className="font-medium truncate">{row.value}</p>
                  {conflictInfo && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Current: {conflictInfo.current}</p>
                  )}
                </div>
              )
            })}
            {rows.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No structured data extracted</p>}
          </div>

          {/* Right: destination + apply */}
          <div className="w-1/2 overflow-y-auto p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direct to App</p>

            {/* Trust AI toggle */}
            <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
              <div>
                <p className="text-sm font-medium">Trust AI</p>
                <p className="text-xs text-muted-foreground">Skip conflict review and apply all extracted data</p>
              </div>
              <button
                onClick={() => setTrustAI(t => !t)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                  trustAI ? 'bg-brand-teal' : 'bg-secondary'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  trustAI ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">Choose what to do with the extracted data. Each action saves it directly into your deal or property.</p>
            <div className="space-y-2">
              <Label>Send To</Label>
              <Select value={destination} onValueChange={v => { setDestination(v); setShowConflictStep(false) }}>
                <SelectTrigger><SelectValue placeholder="Choose a destination..." /></SelectTrigger>
                <SelectContent>
                  {DESTINATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {destination && !showConflictStep && (
              <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                {destination === 'rent_roll' && <>Will bulk-insert <strong>{extractedObj.rent_roll?.length ?? 0} rent roll rows</strong> into the first matching property.</>}
                {destination === 'debt_tranche' && <>Will add <strong>{extractedObj.debt?.length ?? 0} debt tranche(s)</strong> to the most recent deal.</>}
                {destination.startsWith('property_') && <>Will update <strong>{destination.replace('property_', '')}</strong> on the first property.</>}
                {hasConflicts && !trustAI && (
                  <p className="mt-2 text-amber-400 flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    This field already has a value. You'll be asked to confirm before overwriting.
                  </p>
                )}
              </div>
            )}

            {/* Conflict resolution step */}
            {showConflictStep && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                <p className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Conflict detected
                </p>
                {Object.entries(conflicts).map(([field, info]) => (
                  <label key={field} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideMap[field] ?? true}
                      onChange={e => setOverrideMap(m => ({ ...m, [field]: e.target.checked }))}
                      className="mt-0.5 accent-brand-teal"
                    />
                    <div className="text-xs">
                      <p className="font-medium">{field}</p>
                      <p className="text-muted-foreground">Current: <span className="text-foreground">{info.current}</span></p>
                      <p className="text-muted-foreground">AI extracted: <span className="text-brand-teal-light">{info.extracted}</span></p>
                    </div>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">Checked fields will be overwritten. Uncheck to keep the current value.</p>
              </div>
            )}

            <Button
              variant="brand" className="w-full gap-2"
              onClick={showConflictStep ? applyData : handleApplyClick}
              disabled={!destination || applying || applied.includes(destination)}
            >
              {applying ? <><Loader2 className="h-4 w-4 animate-spin" />Applying...</>
                : applied.includes(destination) ? <><CheckCircle2 className="h-4 w-4" />Applied</>
                : showConflictStep ? 'Confirm & Apply'
                : <><ArrowRight className="h-4 w-4" />Apply to App</>}
            </Button>
            {showConflictStep && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowConflictStep(false)}>
                Cancel
              </Button>
            )}
            {applied.map(a => (
              <p key={a} className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {DESTINATION_OPTIONS.find(o => o.value === a)?.label ?? a} applied
              </p>
            ))}
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
