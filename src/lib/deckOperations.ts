import { supabase } from "@/lib/supabase"
import type { Deck } from "@/types/db"

export async function createDeck(
  name: string,
  ownerId: string,
  nameEn?: string
): Promise<{ deck: Deck | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser()
  const createdBy = userData.user?.id ?? ownerId

  const { data, error } = await supabase
    .from("decks")
    .insert({ name, name_en: nameEn ?? "", owner_id: ownerId, created_by: createdBy })
    .select()
    .single()

  if (error) return { deck: null, error: error.message }
  return { deck: data as Deck, error: null }
}

export async function deleteDeck(deckId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("decks").delete().eq("id", deckId)
  return { error: error?.message ?? null }
}
