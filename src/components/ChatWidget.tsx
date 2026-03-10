import { useState, useRef, useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

type Message = { role: 'user' | 'assistant'; content: string }

function getContext(pathname: string): { type: string; id?: string } {
  const dealMatch = pathname.match(/^\/deal-flow\/([^/]+)/)
  if (dealMatch) return { type: 'deal', id: dealMatch[1] }
  const propMatch = pathname.match(/^\/properties\/([^/]+)/)
  if (propMatch) return { type: 'property', id: propMatch[1] }
  if (pathname.startsWith('/documents')) return { type: 'documents' }
  return { type: 'general' }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const STARTERS = [
  'What is a good cap rate for multifamily?',
  'Explain DSCR and what lenders look for.',
  'How do I calculate IRR for a deal?',
  "Summarize this deal's rent roll.",
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const { session } = useAuth()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    // Add placeholder for assistant
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const context = getContext(location.pathname)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.text()
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err}` }
          return copy
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assembled = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const { text } = JSON.parse(data)
            assembled += text
            setMessages(prev => {
              const copy = [...prev]
              copy[copy.length - 1] = { role: 'assistant', content: assembled }
              return copy
            })
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err.message}` }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  const context = getContext(location.pathname)
  const contextLabel =
    context.type === 'deal' ? 'Deal context active' :
    context.type === 'property' ? 'Property context active' :
    context.type === 'documents' ? 'Documents context active' : null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all',
          open ? 'bg-brand-teal rotate-90' : 'bg-brand-teal hover:bg-brand-teal/90'
        )}
        aria-label="AI Assistant"
      >
        {open ? <X className="h-5 w-5 text-white" /> : <MessageCircle className="h-5 w-5 text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-22 right-6 z-50 flex w-[360px] flex-col rounded-xl border border-border bg-card shadow-2xl"
          style={{ height: '520px' }}>
          {/* Header */}
          <div className="flex items-center gap-2 rounded-t-xl border-b border-border bg-brand-teal/10 px-4 py-3">
            <Bot className="h-4 w-4 text-brand-teal-light" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Ardon AI Analyst</p>
              {contextLabel && (
                <p className="text-[10px] text-brand-teal-light">{contextLabel}</p>
              )}
            </div>
            <button onClick={() => setMessages([])} className="text-[10px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-center text-xs text-muted-foreground pt-4">
                  Ask me anything about your deals, properties, or CRE metrics.
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {STARTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-brand-teal/40 hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-brand-teal text-white'
                        : 'bg-secondary text-foreground'
                    )}
                  >
                    {m.content || (streaming && i === messages.length - 1 ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : '')}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={e => { e.preventDefault(); send() }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about a deal, metric, or doc..."
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-teal"
                disabled={streaming}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || streaming}
                className="h-8 w-8 p-0 bg-brand-teal hover:bg-brand-teal/90"
              >
                {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
