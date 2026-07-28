import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export type ParsedAuthCallback = {
  accessToken: string | null
  refreshToken: string | null
  expiresIn: string | null
  type: string | null
  error: string | null
}

export function parseAuthCallbackFromUrl(): ParsedAuthCallback {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, expiresIn: null, type: null, error: null }
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const search = new URLSearchParams(window.location.search)

  const rawError =
    hash.get("error_description") ??
    search.get("error_description") ??
    hash.get("error") ??
    search.get("error")

  return {
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    expiresIn: hash.get("expires_in"),
    type: hash.get("type") ?? search.get("type"),
    error: rawError ? rawError.replace(/\+/g, " ") : null,
  }
}

export function hasAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined") return false
  const parsed = parseAuthCallbackFromUrl()
  const code = new URLSearchParams(window.location.search).get("code")
  return Boolean(parsed.accessToken || parsed.refreshToken || parsed.error || code)
}

export function clearAuthCallbackFromUrl(): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.hash = ""
  for (const key of ["code", "error", "error_description", "error_code", "type"]) {
    url.searchParams.delete(key)
  }
  window.history.replaceState(window.history.state, "", url.pathname + url.search)
}

export function needsPasswordSetup(type: string | null, authEvent?: string | null): boolean {
  if (authEvent === "PASSWORD_RECOVERY") return true
  // "invite" links land the user with no password set yet (admin-created
  // account); "recovery" is an explicit reset request. "signup" must NOT be
  // here — that's just confirming an email the user already chose a
  // password for, so routing it to /reset-password would force them
  // through a redundant "set a new password" screen right after signing up.
  return type === "invite" || type === "recovery"
}

function authStorageKey(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  try {
    const ref = new URL(url).hostname.split(".")[0]
    return `sb-${ref}-auth-token`
  } catch {
    return "sb-auth-token"
  }
}

function userFromAccessToken(accessToken: string): User {
  const payloadPart = accessToken.split(".")[1]
  const json = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"))
  const payload = JSON.parse(json) as {
    sub: string
    email?: string
    aud?: string | string[]
    role?: string
    app_metadata?: User["app_metadata"]
    user_metadata?: User["user_metadata"]
    phone?: string
  }

  return {
    id: payload.sub,
    aud: Array.isArray(payload.aud) ? payload.aud[0] ?? "authenticated" : payload.aud ?? "authenticated",
    role: payload.role ?? "authenticated",
    email: payload.email,
    phone: payload.phone ?? "",
    app_metadata: payload.app_metadata ?? {},
    user_metadata: payload.user_metadata ?? {},
    identities: [],
    created_at: "",
    updated_at: "",
    is_anonymous: false,
  }
}

/**
 * Consume invite/magic/recovery tokens from the URL.
 * Prefers refresh_token exchange — invite access tokens often 403 on GET /auth/v1/user.
 */
export async function consumeAuthCallbackFromUrl(): Promise<{
  session: Session | null
  type: string | null
  error: string | null
  /** Full navigation already triggered (caller should stop). */
  redirected: boolean
}> {
  if (typeof window === "undefined") {
    return { session: null, type: null, error: null, redirected: false }
  }

  const parsed = parseAuthCallbackFromUrl()
  const code = new URLSearchParams(window.location.search).get("code")

  if (!parsed.accessToken && !parsed.refreshToken && !parsed.error && !code) {
    return { session: null, type: null, error: null, redirected: false }
  }

  const type = parsed.type

  if (parsed.error) {
    clearAuthCallbackFromUrl()
    return { session: null, type, error: parsed.error, redirected: false }
  }

  clearAuthCallbackFromUrl()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    return {
      session: data.session,
      type,
      error: error?.message ?? null,
      redirected: false,
    }
  }

  if (parsed.refreshToken) {
    const refreshed = await supabase.auth.refreshSession({
      refresh_token: parsed.refreshToken,
    })
    if (!refreshed.error && refreshed.data.session) {
      return { session: refreshed.data.session, type, error: null, redirected: false }
    }
  }

  if (parsed.accessToken && parsed.refreshToken) {
    const set = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    })
    if (!set.error && set.data.session) {
      return { session: set.data.session, type, error: null, redirected: false }
    }

    // /auth/v1/user rejected the invite token (403). Persist JWT session and hard-reload
    // so the client picks it up from storage without calling /user again.
    try {
      const now = Math.floor(Date.now() / 1000)
      const expiresIn = Number(parsed.expiresIn ?? 3600)
      const session: Session = {
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
        token_type: "bearer",
        expires_in: expiresIn,
        expires_at: now + expiresIn,
        user: userFromAccessToken(parsed.accessToken),
      }
      localStorage.setItem(authStorageKey(), JSON.stringify(session))
      const target = needsPasswordSetup(type) ? "/reset-password" : "/"
      window.location.replace(target)
      return { session, type, error: null, redirected: true }
    } catch {
      return {
        session: null,
        type,
        error: set.error?.message ?? "Не удалось войти по ссылке",
        redirected: false,
      }
    }
  }

  return { session: null, type, error: "Неполная auth-ссылка", redirected: false }
}
