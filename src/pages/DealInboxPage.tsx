import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Inbox, Star, Archive, RefreshCw, Brain } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const AI_CATEGORY_COLOR: Record<string, string> = {
  deal: 'teal',
  lender: 'purple',
  broker: 'warning',
  spam: 'danger',
  unknown: 'outline',
}

function getPriority(score: number | null): { label: string; variant: string } {
  if (score === null) return { label: 'Unscored', variant: 'outline' }
  if (score >= 8) return { label: 'High', variant: 'danger' }
  if (score >= 5) return { label: 'Medium', variant: 'warning' }
  return { label: 'Low', variant: 'outline' }
}

function bodyPreview(text: string | null, maxLen = 80): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean
}

export default function DealInboxPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [provider, setProvider] = useState<'gmail' | 'outlook'>('gmail')

  const { data: connections } = useQuery({
    queryKey: ['email-connections', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('email_connections').select('*').eq('user_id', user!.id)
      return data ?? []
    },
    enabled: !!user,
  })

  const { data: emails, refetch, isLoading } = useQuery({
    queryKey: ['email-inbox', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_inbox')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100)
      return data ?? []
    },
    enabled: !!user,
  })

  const processEmail = useMutation({
    mutationFn: async (emailId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deal-processor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email_id: emailId }),
      })
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-inbox'] }),
  })

  const connectEmail = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-callback?provider=${provider}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      const { url } = await res.json()
      window.location.href = url
    },
  })

  const selectedEmail = emails?.find(e => e.id === selected)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Inbox</h1>
          <p className="text-sm text-muted-foreground">AI-powered email triage for inbound deals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="brand" size="sm" className="gap-2" onClick={() => setShowConnect(true)}>
            <Plus className="h-4 w-4" /> Connect Email
          </Button>
        </div>
      </div>

      {/* Connected accounts */}
      {connections && connections.length > 0 && (
        <div className="flex gap-2">
          {connections.map(c => (
            <Badge key={c.id} variant={c.is_active ? 'success' : 'outline'} className="gap-1">
              <Mail className="h-3 w-3" /> {c.email}
            </Badge>
          ))}
        </div>
      )}

      {connections && connections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Inbox className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="font-medium">No email accounts connected</p>
              <p className="text-sm text-muted-foreground">Connect Gmail or Outlook to start receiving deals</p>
            </div>
            <Button variant="brand" onClick={() => setShowConnect(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Connect Email Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Email list + detail */}
      {emails && emails.length > 0 && (
        <div className="flex gap-4 h-[calc(100vh-280px)]">
          {/* List */}
          <div className="w-96 shrink-0 overflow-y-auto space-y-1">
            {emails.map(email => (
              <button
                key={email.id}
                onClick={() => setSelected(email.id)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selected === email.id ? 'border-brand-teal bg-brand-teal/10' : 'border-border hover:border-brand-teal/30 hover:bg-secondary/50',
                  !email.processed && 'border-l-2 border-l-brand-teal'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{email.from_name ?? email.from_email}</p>
                    <p className="truncate text-xs text-muted-foreground">{email.subject}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {email.ai_category && (
                      <Badge variant={(AI_CATEGORY_COLOR[email.ai_category] ?? 'outline') as any} className="text-[10px]">
                        {email.ai_category}
                      </Badge>
                    )}
                    {(() => {
                      const p = getPriority(email.ai_score)
                      return (
                        <Badge variant={p.variant as any} className="text-[10px]">
                          {p.label}
                        </Badge>
                      )
                    })()}
                  </div>
                </div>
                {email.body_text && (
                  <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                    {bodyPreview(email.body_text)}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(email.received_at).toLocaleDateString()}</p>
              </button>
            ))}
          </div>

          {/* Detail */}
          <Card className="flex-1 overflow-hidden">
            {!selectedEmail ? (
              <CardContent className="flex h-full items-center justify-center text-muted-foreground">
                Select an email to view
              </CardContent>
            ) : (
              <div className="flex flex-col h-full">
                <CardHeader className="border-b border-border shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedEmail.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        From: {selectedEmail.from_name} &lt;{selectedEmail.from_email}&gt;
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {selectedEmail.ai_category && (
                          <Badge variant={AI_CATEGORY_COLOR[selectedEmail.ai_category] as any} className="text-xs">
                            Source: {selectedEmail.ai_category}
                          </Badge>
                        )}
                        {(() => {
                          const p = getPriority(selectedEmail.ai_score)
                          return (
                            <Badge variant={p.variant as any} className="text-xs">
                              Priority: {p.label}
                            </Badge>
                          )
                        })()}
                        {selectedEmail.ai_score !== null && (
                          <span className="text-xs font-mono text-brand-teal-light">Score: {selectedEmail.ai_score}/10</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => processEmail.mutate(selectedEmail.id)}
                      disabled={processEmail.isPending || selectedEmail.processed}
                    >
                      <Brain className="h-4 w-4" />
                      {selectedEmail.processed ? 'Processed' : 'Process with AI'}
                    </Button>
                  </div>
                  {selectedEmail.ai_summary && (
                    <div className="mt-3 rounded-lg bg-brand-teal/10 border border-brand-teal/20 p-3">
                      <p className="text-xs font-semibold text-brand-teal-light mb-1">AI Summary</p>
                      <p className="text-sm">{selectedEmail.ai_summary}</p>
                    </div>
                  )}
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-6">
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
                    {selectedEmail.body_text ?? 'No plain text body'}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Connect email dialog */}
      <Dialog open={showConnect} onOpenChange={setShowConnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Email Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <Select value={provider} onValueChange={v => setProvider(v as 'gmail' | 'outlook')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Microsoft Outlook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              You'll be redirected to authorize ARDON Insights to read your inbox. Only deal-related emails are processed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnect(false)}>Cancel</Button>
            <Button variant="brand" onClick={() => connectEmail.mutate()} disabled={connectEmail.isPending}>
              {connectEmail.isPending ? 'Connecting...' : 'Authorize Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
