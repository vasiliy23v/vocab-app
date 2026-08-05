import * as React from "react"
import { supabase } from "@/lib/supabase"
import { fetchAllRows } from "@/lib/fetchAllRows"
import { effectiveMarkStatus } from "@/lib/cardStatus"
import type { CardWithMarks, Deck } from "@/types/db"

interface DashboardData {
  decks: Deck[]
  cards: CardWithMarks[]
  loading: boolean
}

type Snapshot = { decks: Deck[]; cards: CardWithMarks[] }

const EMPTY: Snapshot = { decks: [], cards: [] }

/** Last known data per student, kept outside React so a remount (or a
 *  second consumer) starts from what we already fetched instead of an
 *  empty list plus a loading spinner. Realtime keeps entries fresh. */
const cache = new Map<string, Snapshot>()

export function useDashboardData(studentId: string | null): DashboardData {
  const [data, setData] = React.useState<Snapshot>(
    () => (studentId && cache.get(studentId)) || EMPTY
  )
  // Only a first-ever load blocks on a spinner; refetches trigged by
  // realtime updates swap the data in silently, so a card mark or an
  // import doesn't flash the whole page back to skeletons.
  const [loading, setLoading] = React.useState(() => !(studentId && cache.has(studentId)))

  // Load data - memoized to never recreate
  const load = React.useMemo(() => {
    return async () => {
      if (!studentId) {
        setData(EMPTY)
        setLoading(false)
        return
      }

      if (!cache.has(studentId)) setLoading(true)
      try {
        const [decksRes, cardsRes] = await Promise.all([
          supabase
            .from("decks")
            .select("*")
            .eq("owner_id", studentId)
            .eq("is_template", false)
            .order("created_at", { ascending: false }),
          // Paged: past 1000 words the sidebar counts described only the
          // first page, which is why they never matched the flame balance.
          fetchAllRows<CardWithMarks>((from, to) =>
            supabase
              .from("cards_with_marks")
              .select("*")
              .eq("owner_id", studentId)
              .eq("deck_is_template", false)
              .order("sort_order", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to)
          ),
        ])

        const next: Snapshot = {
          decks: (decksRes.data as Deck[]) ?? [],
          cards: cardsRes.data,
        }
        cache.set(studentId, next)
        setData(next)
      } finally {
        setLoading(false)
      }
    }
  }, [studentId])

  // Adopt another consumer's cached data when switching students.
  React.useEffect(() => {
    const cached = studentId ? cache.get(studentId) : undefined
    if (cached) {
      setData(cached)
      setLoading(false)
    }
  }, [studentId])

  // Initial load
  React.useEffect(() => {
    void load()
  }, [load])

  // Realtime subscriptions - only depends on studentId
  React.useEffect(() => {
    if (!studentId) return

    const channel = supabase.channel(`dashboard_${studentId}`)

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decks", filter: `owner_id=eq.${studentId}` },
        () => load()
      )
      // "*", not INSERT/UPDATE: a card being deleted, and — more often — a
      // word being marked for the very first time (an INSERT into
      // card_marks, since set_card_mark upserts) both change these counts,
      // and neither used to reach the sidebar/bottom-nav badges.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_marks" },
        () => load()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [studentId, load])

  return { decks: data.decks, cards: data.cards, loading }
}

export function useDerivedCardSets(cards: CardWithMarks[]) {
  return React.useMemo(() => {
    return {
      newCards: cards.filter((c) => effectiveMarkStatus(c) === null),
      reviewQueue: cards.filter((c) => {
        const s = effectiveMarkStatus(c)
        return s === "unknown" || s === "repeat"
      }),
      masteredCards: cards.filter((c) => effectiveMarkStatus(c) === "known"),
    }
  }, [cards])
}
