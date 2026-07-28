/**
 * Origin used for auth redirects (confirm email, reset password) and invite links.
 *
 * In the browser we always use the current tab's origin so the same build works
 * in local, Vercel preview, and production without swapping env URLs.
 * VITE_APP_URL is only a fallback when there is no window (tests / SSR).
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  return ""
}

export function authRedirectTo(path: string): string {
  const origin = getAppOrigin()
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${origin}${normalized}`
}
