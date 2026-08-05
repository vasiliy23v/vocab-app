import * as React from "react"

/**
 * Which deck the student was last studying, remembered across visits.
 *
 * The level path used to span every deck at once, which turned a 4600-word
 * library into 231 levels in one scroll — the path is meant to be a course,
 * and a course is a deck. Kept in localStorage rather than on the profile:
 * it is a per-device UI preference, it has to be readable before the first
 * render to avoid the path flashing the wrong deck, and it is not worth a
 * column plus a write on every deck switch.
 *
 * Scoped by user id so two accounts on one browser do not inherit each
 * other's choice.
 */
function storageKey(userId: string) {
  return `vocab-app:last-deck:${userId}`
}

export function useLastDeck(userId: string | null, deckIds: string[]) {
  const [stored, setStored] = React.useState<string | null>(() => {
    if (!userId || typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(storageKey(userId))
    } catch {
      return null
    }
  })

  // Re-read when the account changes; the initialiser only runs once.
  const [prevUserId, setPrevUserId] = React.useState(userId)
  if (userId !== prevUserId) {
    setPrevUserId(userId)
    try {
      setStored(userId && typeof window !== "undefined" ? window.localStorage.getItem(storageKey(userId)) : null)
    } catch {
      setStored(null)
    }
  }

  // A remembered deck that has since been deleted (or belongs to another
  // account) must not leave the path empty — fall back to the first deck.
  const selected = stored && deckIds.includes(stored) ? stored : (deckIds[0] ?? null)

  const select = React.useCallback(
    (deckId: string) => {
      setStored(deckId)
      if (!userId || typeof window === "undefined") return
      try {
        window.localStorage.setItem(storageKey(userId), deckId)
      } catch {
        // Private mode / quota — the choice just won't outlive the session.
      }
    },
    [userId]
  )

  return { selectedDeckId: selected, selectDeck: select }
}
