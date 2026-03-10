import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange fires with INITIAL_SESSION first — this handles both
    // normal loads AND OAuth redirects with #access_token in the URL hash.
    // We move setLoading(false) here so the app waits until Supabase has
    // fully processed the URL token before deciding the user is logged out.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, user: session?.user ?? null }
}
