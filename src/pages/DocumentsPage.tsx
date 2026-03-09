import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, FileSpreadsheet, Image, File, FileX, Upload, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const TYPE_OPTIONS = ['All Types', 'PDF', 'Excel', 'Word', 'Image', 'Other']

export default function DocumentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All Types')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: documents } = useQuery({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of files) {
        const path = `${user.id}/${Date.now()}_${file.name}`
        const { error: storageError } = await supabase.storage
          .from('documents')
          .upload(path, file)
        if (storageError) throw storageError
        await supabase.from('documents').insert({
          user_id: user.id,
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          storage_path: path,
        })
      }
      qc.invalidateQueries({ queryKey: ['documents'] })
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (doc: any) => {
    if (doc.storage_path) {
      await supabase.storage.from('documents').remove([doc.storage_path])
    }
    await supabase.from('documents').delete().eq('id', doc.id)
    qc.invalidateQueries({ queryKey: ['documents'] })
  }

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  function filterDocs(docs: any[], tab: string) {
    return docs.filter((d: any) => {
      const matchesSearch = !search || d.name?.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'All Types' || d.type === typeFilter
      const matchesTab =
        tab === 'all' ||
        (tab === 'recent' && new Date(d.created_at).getTime() > sevenDaysAgo) ||
        (tab === 'extracted' && d.type === 'extracted')
      return matchesSearch && matchesType && matchesTab
    })
  }

  const allDocs = documents ?? []

  function DocList({ docs }: { docs: any[] }) {
    if (docs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileX className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium">No documents found</p>
          <p className="mt-1 text-sm text-muted-foreground">Get started by uploading your first document</p>
          <Button variant="brand" className="mt-4 gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {docs.map((doc: any) => (
          <div
            key={doc.id}
            className="flex items-center gap-4 rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors"
          >
            <FileIcon type={doc.type ?? 'Other'} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{doc.name}</p>
              <p className="text-xs text-muted-foreground">
                {doc.size ? formatBytes(doc.size) : '—'} · {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">{doc.type ?? 'Other'}</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(doc)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">Store and manage your investment documents</p>
        </div>
        <Button variant="brand" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      <div className="flex gap-3">
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Documents ({allDocs.length})</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="extracted">AI Extracted</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <DocList docs={filterDocs(allDocs, 'all')} />
        </TabsContent>
        <TabsContent value="recent" className="mt-4">
          <DocList docs={filterDocs(allDocs, 'recent')} />
        </TabsContent>
        <TabsContent value="extracted" className="mt-4">
          <DocList docs={filterDocs(allDocs, 'extracted')} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
