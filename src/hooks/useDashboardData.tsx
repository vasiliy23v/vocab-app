import * as React from "react"
import { supabase } from "@/lib/supabase"
import { effectiveMarkStatus } from "@/lib/cardStatus"
import type { CardWithMarks, Deck } from "@/types/db"

interface DashboardData {
  decks: Deck[]
  cards: CardWithMarks[]
  loading: boolean
}

export function useDashboardData(studentId: string | null): DashboardData {
  const [data, setData] = React.useState<{
    decks: Deck[]
    cards: CardWithMarks[]
  }>({ decks: [], cards: [] })
  const [loading, setLoading] = React.useState(true)

  // Load data - memoized to never recreate
  const load = React.useMemo(() => {
    return async () => {
      if (!studentId) {
        setData({ decks: [], cards: [] })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const [decksRes, cardsRes] = await Promise.all([
          supabase
            .from("decks")
            .select("*")
            .eq("owner_id", studentId)
            .eq("is_template", false)
            .order("created_at", { ascending: false }),
          supabase
            .from("cards_with_marks")
            .select("*")
            .eq("owner_id", studentId)
            .eq("deck_is_template", false)
            .order("sort_order", { ascending: true }),
        ])

        setData({
          decks: (decksRes.data as Deck[]) ?? [],
          cards: (cardsRes.data as CardWithMarks[]) ?? [],
        })
      } finally {
        setLoading(false)
      }
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cards" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "card_marks" },
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
