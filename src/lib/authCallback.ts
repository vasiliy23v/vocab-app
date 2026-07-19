/** True when the URL still carries a Supabase auth callback (magic link, invite, recovery). */
export function hasAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined") return false

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const search = new URLSearchParams(window.location.search)

  return (
    hash.has("access_token") ||
    hash.has("refresh_token") ||
    hash.has("error") ||
    search.has("code") ||
    search.has("error") ||
    search.has("error_description")
  )
}

export function getAuthCallbackType(): string | null {
  if (typeof window === "undefined") return null
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const search = new URLSearchParams(window.location.search)
  return hash.get("type") ?? search.get("type")
}

export function getAuthCallbackError(): string | null {
  if (typeof window === "undefined") return null
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const search = new URLSearchParams(window.location.search)
  const raw =
    hash.get("error_description") ??
    search.get("error_description") ??
    hash.get("error") ??
    search.get("error")
  return raw ? raw.replace(/\+/g, " ") : null
}

/** Paths where invite / recovery should land to set a password. */
export function passwordSetupTypes(): Set<string> {
  return new Set(["invite", "recovery", "signup"])
}
