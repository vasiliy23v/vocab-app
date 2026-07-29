import * as React from "react"
import { supabase } from "@/lib/supabase"
import type { LanguageInfo, LanguagePair, WordTranslation, WordExample, WordDescription } from "@/types/db"

export function useLanguages() {
  const [languages, setLanguages] = React.useState<LanguageInfo[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("languages")
      .select("*")
      .order("name")
    if (error) console.error(error)
    setLanguages((data as LanguageInfo[]) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return { languages, loading, refresh: load }
}

export function useLanguagePairs() {
  const [pairs, setPairs] = React.useState<LanguagePair[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc("list_language_pairs")
    if (error) console.error(error)
    // Note: returned data has different structure, transform it
    setPairs((data as any) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return { pairs, loading, refresh: load }
}

export function useWordTranslations(cardId: string | null) {
  const [translations, setTranslations] = React.useState<Map<string, WordTranslation>>(new Map())
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!cardId) {
      setTranslations(new Map())
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("word_translations")
      .select("*")
      .eq("card_id", cardId)
    if (error) console.error(error)
    const map = new Map((data as WordTranslation[])?.map((t) => [t.language, t]) ?? [])
    setTranslations(map)
    setLoading(false)
  }, [cardId])

  React.useEffect(() => {
    load()
  }, [load])

  const addTranslation = async (language: string, text: string) => {
    if (!cardId) return { error: "No card selected" }
    const { error } = await supabase
      .from("word_translations")
      .insert({
        card_id: cardId,
        language,
        text,
      })
      .select()
      .single()
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const updateTranslation = async (language: string, text: string) => {
    if (!cardId) return { error: "No card selected" }
    const existing = translations.get(language)
    if (!existing) return addTranslation(language, text)

    const { error } = await supabase
      .from("word_translations")
      .update({ text })
      .eq("id", existing.id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const deleteTranslation = async (language: string) => {
    const existing = translations.get(language)
    if (!existing) return { error: null }
    const { error } = await supabase.from("word_translations").delete().eq("id", existing.id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  return {
    translations,
    loading,
    addTranslation,
    updateTranslation,
    deleteTranslation,
    refresh: load,
  }
}

export function useWordExamples(cardId: string | null) {
  const [examples, setExamples] = React.useState<Map<string, WordExample>>(new Map())
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!cardId) {
      setExamples(new Map())
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("word_examples")
      .select("*")
      .eq("card_id", cardId)
    if (error) console.error(error)
    const map = new Map((data as WordExample[])?.map((e) => [e.language, e]) ?? [])
    setExamples(map)
    setLoading(false)
  }, [cardId])

  React.useEffect(() => {
    load()
  }, [load])

  const addExample = async (language: string, text: string) => {
    if (!cardId) return { error: "No card selected" }
    const { error } = await supabase.from("word_examples").insert({
      card_id: cardId,
      language,
      text,
    })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const updateExample = async (language: string, text: string) => {
    if (!cardId) return { error: "No card selected" }
    const existing = examples.get(language)
    if (!existing) return addExample(language, text)

    const { error } = await supabase
      .from("word_examples")
      .update({ text })
      .eq("id", existing.id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const deleteExample = async (language: string) => {
    const existing = examples.get(language)
    if (!existing) return { error: null }
    const { error } = await supabase.from("word_examples").delete().eq("id", existing.id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  return {
    examples,
    loading,
    addExample,
    updateExample,
    deleteExample,
    refresh: load,
  }
}

export function useWordDescriptions(cardId: string | null) {
  const [descriptions, setDescriptions] = React.useState<Map<string, WordDescription>>(new Map())
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!cardId) {
      setDescriptions(new Map())
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("word_descriptions")
      .select("*")
      .eq("card_id", cardId)
    if (error) console.error(error)
    const map = new Map((data as WordDescription[])?.map((d) => [d.language, d]) ?? [])
    setDescriptions(map)
    setLoading(false)
  }, [cardId])

  React.useEffect(() => {
    load()
  }, [load])

  const addDescription = async (language: string, text: string) => {
    if (!cardId) return { error: "No card selected" }
    const { error } = await supabase.from("word_descriptions").insert({
      card_id: cardId,
      language,
      text,
    })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const updateDescription = async (language: string, text: string) => {
    if (!cardId) return { error: "No card selected" }
    const existing = descriptions.get(language)
    if (!existing) return addDescription(language, text)

    const { error } = await supabase
      .from("word_descriptions")
      .update({ text })
      .eq("id", existing.id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  const deleteDescription = async (language: string) => {
    const existing = descriptions.get(language)
    if (!existing) return { error: null }
    const { error } = await supabase.from("word_descriptions").delete().eq("id", existing.id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  return {
    descriptions,
    loading,
    addDescription,
    updateDescription,
    deleteDescription,
    refresh: load,
  }
}
