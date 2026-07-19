import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { insertInBatches } from "@/lib/batchInsert"
import type { AdminProfileRow, Deck, ParsedCardRow, UserRole } from "@/types/db"

export function useIsSuperadmin(): boolean {
  const { profile } = useAuth()
  return profile?.role === "superadmin"
}

export function useAdminUsers() {
  const [users, setUsers] = React.useState<AdminProfileRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc("admin_list_profiles")
    if (error) {
      console.error(error)
    }
    setUsers((data as AdminProfileRow[]) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const setRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  return { users, loading, setRole, deleteUser, refresh: load }
}

export function useAdminTemplates(adminId: string | null) {
  const [templates, setTemplates] = React.useState<Deck[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("is_template", true)
      .order("created_at", { ascending: false })
    if (error) {
      console.error(error)
    }
    setTemplates((data as Deck[]) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const createTemplate = async (
    name: string,
    rows: ParsedCardRow[],
    onProgress?: (done: number, total: number) => void,
    nameEn?: string
  ) => {
    if (!adminId) return { error: "Not authenticated" }
    const { data: deck, error } = await supabase
      .from("decks")
      .insert({ name, name_en: nameEn ?? "", owner_id: adminId, created_by: adminId, is_template: true })
      .select()
      .single()
    if (error || !deck) return { error: error?.message ?? "Failed to create template" }

    const payload = rows.map((r, i) => ({
      deck_id: deck.id,
      owner_id: adminId,
      word_de: r.word_de,
      translation_ru: r.translation_ru,
      translation_en: r.translation_en,
      group: r.group,
      group_en: r.group_en,
      tags: r.tags,
      description: r.description,
      description_en: r.description_en,
      example_de: r.example_de,
      example_ru: r.example_ru,
      example_en: r.example_en,
      created_by: adminId,
      sort_order: i,
    }))
    const { error: cardsError } = await insertInBatches(supabase, "cards", payload, { onProgress })
    if (cardsError) return { error: cardsError }
    await load()
    return { error: null }
  }

  const deleteTemplate = async (deckId: string) => {
    await supabase.from("decks").delete().eq("id", deckId)
    await load()
  }

  const assignToStudents = async (templateDeckId: string, studentIds: string[]) => {
    const { error } = await supabase.rpc("admin_assign_deck", {
      p_template_deck_id: templateDeckId,
      p_student_ids: studentIds,
    })
    return { error: error?.message ?? null }
  }

  // Goes through admin_update_deck_name (security definer) rather than a
  // plain client-side update, so any superadmin can rename a template —
  // not just whoever originally created it (RLS's owner-only update
  // policy would otherwise block that).
  const renameTemplate = async (deckId: string, name: string, nameEn: string) => {
    const { error } = await supabase.rpc("admin_update_deck_name", {
      p_deck_id: deckId,
      p_name: name,
      p_name_en: nameEn,
    })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  return { templates, loading, createTemplate, deleteTemplate, assignToStudents, renameTemplate, refresh: load }
}
