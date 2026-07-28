import * as React from "react"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { authRedirectTo } from "@/lib/appUrl"
import { consumeAuthCallbackFromUrl } from "@/lib/authCallback"
import { supabase } from "@/lib/supabase"
import { STARTER_DECK_NAME, STARTER_DECK_NAME_EN, STARTER_DECK_CARDS } from "@/lib/starterDeck"
import type { Profile } from "@/types/db"

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  authEvent: AuthChangeEvent | null
  /** Callback link type: invite | recovery | magiclink | … */
  callbackType: string | null
  callbackError: string | null
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (
    patch: Partial<
      Pick<
        Profile,
        | "display_name"
        | "vibrate_on_correct"
        | "current_streak"
        | "longest_streak"
        | "last_study_date"
        | "words_per_day"
        | "language_from"
        | "language_to"
      >
    >
  ) => Promise<{ error: string | null }>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

/** One-time welcome deck for a brand-new profile — just something to
 *  click through, not a curriculum. Best-effort: a brand-new account
 *  with no decks yet is still fully usable, so failures here are only
 *  logged, never surfaced to the student. */
async function seedStarterDeck(userId: string) {
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({ name: STARTER_DECK_NAME, name_en: STARTER_DECK_NAME_EN, owner_id: userId, created_by: userId })
    .select()
    .maybeSingle()
  if (deckError || !deck) {
    console.error("Failed to seed starter deck", deckError)
    return
  }

  const payload = STARTER_DECK_CARDS.map((r, i) => ({
    deck_id: deck.id,
    owner_id: userId,
    created_by: userId,
    sort_order: i,
    ...r,
  }))
  const { error: cardsError } = await supabase.from("cards").insert(payload)
  if (cardsError) console.error("Failed to seed starter deck cards", cardsError)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [authEvent, setAuthEvent] = React.useState<AuthChangeEvent | null>(null)
  const [callbackType, setCallbackType] = React.useState<string | null>(null)
  const [callbackError, setCallbackError] = React.useState<string | null>(null)

  const fetchProfile = React.useCallback(async (user: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (error) return

    if (data) {
      const row = data as Profile
      setProfile({ ...row, vibrate_on_correct: row.vibrate_on_correct ?? true })
      return
    }

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

    if (!insertError && created) {
      setProfile(created as Profile)
      void seedStarterDeck(user.id)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      setAuthEvent(event)
      setSession(newSession)
      if (newSession?.user) {
        void fetchProfile(newSession.user)
      } else {
        setProfile(null)
      }
    })

    void (async () => {
      const consumed = await consumeAuthCallbackFromUrl()
      if (cancelled || consumed.redirected) return

      if (consumed.type) setCallbackType(consumed.type)
      if (consumed.error) setCallbackError(consumed.error)

      if (consumed.session) {
        setSession(consumed.session)
        void fetchProfile(consumed.session.user)
        setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session)
      if (data.session?.user) void fetchProfile(data.session.user)
      setLoading(false)
    })()

    return () => {
      cancelled = true
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
    if (!error) return { error: null }
    // GoTrue returns a generic English string; map the common code for the UI.
    if (error.message === "Invalid login credentials" || (error as { code?: string }).code === "invalid_credentials") {
      return { error: "invalid_credentials" }
    }
    return { error: error.message }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user)
  }

  const updateProfile = async (
    patch: Partial<
      Pick<
        Profile,
        | "display_name"
        | "vibrate_on_correct"
        | "current_streak"
        | "longest_streak"
        | "last_study_date"
        | "words_per_day"
        | "language_from"
        | "language_to"
      >
    >
  ) => {
    if (!session?.user) return { error: "Not signed in" }
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev))
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", session.user.id)
      .select()
      .maybeSingle()
    if (error) {
      await fetchProfile(session.user)
      return { error: error.message }
    }
    if (data) setProfile({ ...(data as Profile), vibrate_on_correct: (data as Profile).vibrate_on_correct ?? true })
    return { error: null }
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
    callbackType,
    callbackError,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updateProfile,
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
