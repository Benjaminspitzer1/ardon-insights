import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthPage() {
  const { session } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'microsoft' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const qParams = new URLSearchParams(window.location.search)
    let err = qParams.get('error_description')
    if (!err && window.location.hash) {
      const hParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      err = hParams.get('error_description')
    }
    if (err) setError(decodeURIComponent(err.replace(/\+/g, ' ')))
  }, [])

  if (session) return <Navigate to="/" replace />

  const clearState = () => { setError(null); setMessage(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    clearState()

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (data.session) {
        // email confirmation disabled — already signed in, redirect happens via useAuth
      } else {
        setMessage('Check your email — we sent you a confirmation link to activate your account.')
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setMessage('Password reset link sent — check your email.')
    }
    setLoading(false)
  }

  const handleOAuth = async (provider: 'google' | 'azure', label: 'google' | 'microsoft') => {
    clearState()
    setOauthLoading(label)
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
    setOauthLoading(null)
  }

  const isReset = mode === 'reset'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-9">
              <path d="M10 3L17 16H12.5L10 11L7.5 16H3L10 3Z" fill="white" opacity="0.9"/>
              <path d="M7 13H13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-widest">ARDON</h1>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Insights</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-0">
            {!isReset && (
              <div className="flex rounded-lg border border-border bg-muted p-1 mb-4">
                <button
                  type="button"
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    mode === 'signin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { setMode('signin'); clearState() }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { setMode('signup'); clearState() }}
                >
                  Create account
                </button>
              </div>
            )}
            <CardTitle className="sr-only">
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
            </CardTitle>
            <CardDescription>
              {mode === 'signin' && 'Access your investment portal'}
              {mode === 'signup' && 'Start your 14-day free trial'}
              {mode === 'reset' && 'Enter your email and we\'ll send a reset link'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* OAuth buttons — hidden on reset screen */}
            {!isReset && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {/* Google */}
                  <button
                    type="button"
                    onClick={() => handleOAuth('google', 'google')}
                    disabled={oauthLoading !== null}
                    className="flex items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                  >
                    {oauthLoading === 'google' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    Google
                  </button>

                  {/* Microsoft */}
                  <button
                    type="button"
                    onClick={() => handleOAuth('azure', 'microsoft')}
                    disabled={oauthLoading !== null}
                    className="flex items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                  >
                    {oauthLoading === 'microsoft' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                        <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/>
                        <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/>
                        <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
                        <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
                      </svg>
                    )}
                    Microsoft
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>
              </>
            )}

            {/* Email / password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {!isReset && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setMode('reset'); clearState() }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-emerald-400">{message}</p>}

              <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                {loading
                  ? 'Loading...'
                  : mode === 'signin'
                  ? 'Sign in'
                  : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
              </Button>

              {isReset && (
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setMode('signin'); clearState() }}
                >
                  Back to sign in
                </button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
