import * as React from "react"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { authRedirectTo } from "@/lib/appUrl"
import { getAuthCallbackError, hasAuthCallbackInUrl } from "@/lib/authCallback"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types/db"

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  authEvent: AuthChangeEvent | null
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [authEvent, setAuthEvent] = React.useState<AuthChangeEvent | null>(null)

  const fetchProfile = React.useCallback(async (user: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (error) return

    if (data) {
      setProfile(data as Profile)
      return
    }

    // Профиль не создан (регистрация до миграции или сбой триггера)
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "User"

    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email ?? "",
        display_name: displayName,
      })
      .select()
      .maybeSingle()

    if (!insertError && created) setProfile(created as Profile)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const awaitingCallback = hasAuthCallbackInUrl()
    const callbackError = getAuthCallbackError()

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      setAuthEvent(event)
      setSession(newSession)
      if (newSession?.user) {
        void fetchProfile(newSession.user)
      } else {
        setProfile(null)
      }

      // INITIAL_SESSION fires after URL hash/code is parsed — safe to stop loading.
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "PASSWORD_RECOVERY"
      ) {
        setLoading(false)
      }
    })

    // Fallback if INITIAL_SESSION is delayed or missing (older clients / edge cases).
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) {
        setSession(data.session)
        void fetchProfile(data.session.user)
        setLoading(false)
        return
      }
      if (!awaitingCallback || callbackError) {
        setLoading(false)
      }
    })

    const timeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      listener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: authRedirectTo("/"),
      },
    })
    return { error: error?.message ?? null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user)
  }

  const requestPasswordReset = async (email: string) => {
    const redirectTo = authRedirectTo("/reset-password")
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    return { error: error?.message ?? null }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    authEvent,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    requestPasswordReset,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
