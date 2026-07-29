import * as React from "react"
import { supabase } from "@/lib/supabase"
import type { ParsedCardRow, MultilingualCardRow } from "@/types/db"

export interface UserDeck {
  id: string
  owner_id: string
  name: string
  name_en: string
  is_template: boolean
  created_at: string
  card_count: bigint
  created_by: string
}

export function useAdminUserDecks(userId: string | null) {
  const [decks, setDecks] = React.useState<UserDeck[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!userId) {
      setDecks([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc("admin_list_user_decks", { p_user_id: userId })
    if (error) {
      console.error(error)
    }
    setDecks((data as UserDeck[]) ?? [])
    setLoading(false)
  }, [userId])

  React.useEffect(() => {
    load()
  }, [load])

  const createDeck = async (name: string, nameEn: string) => {
    if (!userId) return { error: "No user selected" }
    const { data, error } = await supabase.rpc("admin_create_deck_for_user", {
      p_user_id: userId,
      p_name: name,
      p_name_en: nameEn,
    })
    if (!error) await load()
    return { deckId: data as string | null, error: error?.message ?? null }
  }

  const addCards = async (
    deckId: string,
    rows: ParsedCardRow[],
    onProgress?: (done: number, total: number) => void
  ) => {
    // Insert/update in batches to handle large uploads (1000+).
    // Upserts by (deck_id, word_de) — re-uploading a CSV to refresh an
    // existing deck updates matching words instead of duplicating them.
    const BATCH_SIZE = 250
    let totalInserted = 0
    let totalUpdated = 0

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const payload = batch.map((r) => ({
        word_de: r.word_de,
        translation_ru: r.translation_ru,
        translation_en: r.translation_en,
        translation_uk: r.translation_uk,
        group: r.group,
        group_en: r.group_en,
        group_uk: r.group_uk,
        tags: r.tags,
        description: r.description,
        description_en: r.description_en,
        description_uk: r.description_uk,
        example_de: r.example_de,
        example_ru: r.example_ru,
        example_en: r.example_en,
        example_uk: r.example_uk,
      }))

      const { data, error } = await supabase.rpc("admin_upsert_cards_to_deck", {
        p_deck_id: deckId,
        p_cards: payload,
      })

      if (error) {
        return {
          error: `${error.message} (${totalInserted + totalUpdated} cards processed)`,
          insertedCount: totalInserted,
          updatedCount: totalUpdated,
        }
      }

      if (data && data.length > 0) {
        const result = data[0]
        if (result.error_message) {
          return {
            error: `${result.error_message} (${totalInserted + totalUpdated + result.inserted_count + result.updated_count} cards processed)`,
            insertedCount: totalInserted + result.inserted_count,
            updatedCount: totalUpdated + result.updated_count,
          }
        }
        totalInserted += result.inserted_count
        totalUpdated += result.updated_count
      }

      onProgress?.(totalInserted + totalUpdated, rows.length)
    }

    await load()
    return { error: null, insertedCount: totalInserted, updatedCount: totalUpdated }
  }

  const addMultilingualCards = async (
    deckId: string,
    rows: MultilingualCardRow[],
    languageFrom: string = "de",
    languageTo: string = "ru",
    onProgress?: (done: number, total: number) => void
  ) => {
    // Convert to JSON format for RPC
    const payload = rows.map((r) => ({
      word_de: r.word.de || "",
      translations: r.translations,
      examples: r.examples,
      descriptions: r.descriptions,
      group: r.group.de || "",
      tags: r.tags,
    }))

    const { data, error } = await supabase.rpc("import_multilingual_cards", {
      p_deck_id: deckId,
      p_cards: payload,
      p_language_from: languageFrom,
      p_language_to: languageTo,
    })

    if (error) {
      return {
        error: error.message,
        insertedCount: 0,
      }
    }

    if (data && data.length > 0) {
      const result = data[0]
      if (result.error_message) {
        return {
          error: result.error_message,
          insertedCount: result.inserted_count,
        }
      }
      onProgress?.(result.inserted_count, rows.length)
      await load()
      return { error: null, insertedCount: result.inserted_count }
    }

    return { error: "Unknown error", insertedCount: 0 }
  }

  return { decks, loading, createDeck, addCards, addMultilingualCards, refresh: load }
}
