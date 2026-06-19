import * as React from "react"
import { supabase } from "@/lib/supabase"
import type { CardWithMarks, Deck, MarkStatus, ParsedCardRow } from "@/types/db"

export function useDecks(studentId: string | null) {
  const [decks, setDecks] = React.useState<Deck[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    if (!studentId) {
      setDecks([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from("decks")
      .select("*")
      .eq("owner_id", studentId)
      .order("created_at", { ascending: false })
    setDecks((data as Deck[]) ?? [])
    setLoading(false)
  }, [studentId])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!studentId) return
    const channel = supabase
      .channel(`decks_${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decks", filter: `owner_id=eq.${studentId}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [studentId, load])

  const createDeck = async (name: string, ownerId: string) => {
    const { data: userData } = await supabase.auth.getUser()
    const createdBy = userData.user?.id ?? ownerId
    const { data, error } = await supabase
      .from("decks")
      .insert({ name, owner_id: ownerId, created_by: createdBy })
      .select()
      .single()
    if (!error) await load()
    return { deck: data as Deck | null, error: error?.message ?? null }
  }

  const deleteDeck = async (deckId: string) => {
    await supabase.from("decks").delete().eq("id", deckId)
    await load()
  }

  return { decks, loading, createDeck, deleteDeck, refresh: load }
}

export function useCards(deckId: string | null) {
  const [cards, setCards] = React.useState<CardWithMarks[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    if (!deckId) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("cards_with_marks")
      .select("*")
      .eq("deck_id", deckId)
      .order("sort_order", { ascending: true })
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    setCards((data as CardWithMarks[]) ?? [])
    setLoading(false)
  }, [deckId])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!deckId) return
    const channel = supabase
      .channel(`cards_${deckId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards", filter: `deck_id=eq.${deckId}` },
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
  }, [deckId, load])

  const addCards = async (rows: ParsedCardRow[], ownerId: string, deckIdArg: string) => {
    const { data: userData } = await supabase.auth.getUser()
    const createdBy = userData.user?.id ?? null
    const { data: existing } = await supabase
      .from("cards")
      .select("sort_order")
      .eq("deck_id", deckIdArg)
      .order("sort_order", { ascending: false })
      .limit(1)
    const startOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0

    const payload = rows.map((r, i) => ({
      deck_id: deckIdArg,
      owner_id: ownerId,
      word_de: r.word_de,
      translation_ru: r.translation_ru,
      group: r.group,
      tags: r.tags,
      description: r.description,
      example_de: r.example_de,
      example_ru: r.example_ru,
      created_by: createdBy,
      sort_order: startOrder + i,
    }))

    const { error } = await supabase.from("cards").insert(payload)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const deleteCard = async (cardId: string) => {
    await supabase.from("cards").delete().eq("id", cardId)
    await load()
  }

  const setMark = async (cardId: string, status: MarkStatus) => {
    const { error } = await supabase.rpc("set_card_mark", { p_card_id: cardId, p_status: status })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const clearMark = async (cardId: string) => {
    const { error } = await supabase.rpc("clear_card_mark", { p_card_id: cardId })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  return { cards, loading, addCards, deleteCard, setMark, clearMark, refresh: load }
}

/**
 * All cards for a student across all their decks — used to build
 * the "review queue": teacher_status is 'unknown' / 'repeat' / null (unmarked).
 */
export function useAllStudentCards(studentId: string | null) {
  const [cards, setCards] = React.useState<CardWithMarks[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    if (!studentId) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("cards_with_marks")
      .select("*")
      .eq("owner_id", studentId)
      .order("sort_order", { ascending: true })
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    setCards((data as CardWithMarks[]) ?? [])
    setLoading(false)
  }, [studentId])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!studentId) return
    const channel = supabase
      .channel(`all_cards_${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "card_marks" }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [studentId, load])

  /** Words the teacher marked unknown/repeat, OR have no teacher mark at all. */
  const reviewQueue = React.useMemo(
    () => cards.filter((c) => c.teacher_status === "unknown" || c.teacher_status === "repeat" || c.teacher_status === null),
    [cards]
  )

  /** Words the teacher has explicitly marked as known. */
  const masteredCards = React.useMemo(
    () => cards.filter((c) => c.teacher_status === "known"),
    [cards]
  )

  return { cards, reviewQueue, masteredCards, loading, refresh: load }
}
