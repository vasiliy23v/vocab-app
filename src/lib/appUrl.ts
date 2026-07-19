/** Canonical app origin for auth redirects (email confirm, password reset). */
export function getAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

export function authRedirectTo(path: string): string {
  const origin = getAppOrigin()
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${origin}${normalized}`
}
