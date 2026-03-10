import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'

export default function PortfoliosPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { data: portfolios, isLoading } = useQuery({
    queryKey: ['portfolios', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('property_groups')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  const { data: allProperties } = useQuery({
    queryKey: ['properties-for-groups', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, group_id, noi')
      return data ?? []
    },
    enabled: !!user,
  })

  const groupStats = useMemo(() => {
    const map: Record<string, { count: number; noi: number }> = {}
    for (const p of allProperties ?? []) {
      if (!p.group_id) continue
      const s = map[p.group_id] ?? { count: 0, noi: 0 }
      s.count += 1
      s.noi += (p.noi as number) ?? 0
      map[p.group_id] = s
    }
    return map
  }, [allProperties])

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Portfolio name is required.')
      const { error } = await supabase.from('property_groups').insert({
        user_id: user!.id,
        name: name.trim(),
        description: description.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] })
      setOpen(false)
      setName('')
      setDescription('')
      setFormError(null)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const openDialog = () => {
    setName('')
    setDescription('')
    setFormError(null)
    setOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolios</h1>
          <p className="text-sm text-muted-foreground">Organize your properties into investment portfolios</p>
        </div>
        <Button variant="brand" className="gap-2" onClick={openDialog}>
          <Plus className="h-4 w-4" />
          New Portfolio
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
        </div>
      ) : (portfolios ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium">No portfolios yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Group your properties into named portfolios</p>
          <Button variant="brand" className="mt-4 gap-2" onClick={openDialog}>
            <Plus className="h-4 w-4" />
            Create Your First Portfolio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(portfolios ?? []).map((p: any) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
                {p.description && (
                  <CardDescription className="text-xs">{p.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-1 text-sm text-muted-foreground">
                <p>Properties: {groupStats[p.id]?.count ?? 0}</p>
                <p>Total NOI: {formatCurrency(groupStats[p.id]?.noi ?? 0)}</p>
                <p>Created: {new Date(p.created_at).toLocaleDateString()}</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/properties?group=${p.id}`}>View Properties →</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Portfolio Name *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sun Belt Multifamily"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional notes about this portfolio..."
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Creating...' : 'Create Portfolio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
