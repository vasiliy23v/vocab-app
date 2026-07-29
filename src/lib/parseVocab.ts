import type { ParsedCardRow, MultilingualCardRow } from "@/types/db"

function splitLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t").map((c) => c.replace(/^"|"$/g, ""))
  const cols: string[] = []
  const re = /(".*?"|[^,]+)(?=,|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) cols.push(m[1].replace(/^"|"$/g, ""))
  return cols
}

export type ParseErrorCode = "min_lines" | "missing_columns" | "no_cards"

export interface ParseResult {
  cards: ParsedCardRow[]
  error: ParseErrorCode | null
}

export interface MultilingualParseResult {
  cards: MultilingualCardRow[]
  error: ParseErrorCode | null
  detectedLanguages: string[]
}

/**
 * Legacy parser for backward compatibility (DE→RU/EN format)
 */
export function parseVocabText(raw: string): ParseResult {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { cards: [], error: "min_lines" }

  const sep = lines[0].includes("\t") ? "\t" : ","
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""))

  const wi = headers.indexOf("word")
  const ti = headers.indexOf("translation")
  if (wi < 0 || ti < 0) {
    return { cards: [], error: "missing_columns" }
  }

  const tei = headers.indexOf("translation_en")
  const gi = headers.indexOf("group")
  const gei = headers.indexOf("group_en")
  const tgi = headers.indexOf("tags")
  const di = headers.indexOf("description")
  const dei = headers.indexOf("description_en")
  const ei = headers.indexOf("example_de")
  const eri = headers.indexOf("example_ru")
  const eei = headers.indexOf("example_en")

  const cards: ParsedCardRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    const de = cols[wi]?.trim()
    const ru = cols[ti]?.trim()
    if (!de || !ru) continue
    cards.push({
      word_de: de,
      translation_ru: ru,
      translation_en: tei >= 0 ? cols[tei]?.trim() ?? "" : "",
      group: gi >= 0 ? cols[gi]?.trim() ?? "" : "",
      group_en: gei >= 0 ? cols[gei]?.trim() ?? "" : "",
      tags: tgi >= 0 ? (cols[tgi]?.trim() ?? "").split(";").map((t) => t.trim()).filter(Boolean) : [],
      description: di >= 0 ? cols[di]?.trim() ?? "" : "",
      description_en: dei >= 0 ? cols[dei]?.trim() ?? "" : "",
      example_de: ei >= 0 ? cols[ei]?.trim() ?? "" : "",
      example_ru: eri >= 0 ? cols[eri]?.trim() ?? "" : "",
      example_en: eei >= 0 ? cols[eei]?.trim() ?? "" : "",
    })
  }

  if (!cards.length) return { cards: [], error: "no_cards" }
  return { cards, error: null }
}

/**
 * Multilingual parser supporting unlimited languages
 * Detects columns like: word, translation, translation_en, translation_uk, etc
 * Also supports: example_de, example_ru, example_uk, description_de, description_ru, etc
 */
export function parseMultilingualVocab(raw: string): MultilingualParseResult {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { cards: [], error: "min_lines", detectedLanguages: [] }

  const sep = lines[0].includes("\t") ? "\t" : ","
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""))

  const wi = headers.indexOf("word")
  if (wi < 0) {
    return { cards: [], error: "missing_columns", detectedLanguages: [] }
  }

  // Detect language columns: translation_XX, example_XX, description_XX
  const languageMap = new Map<string, { translation?: number; example?: number; description?: number; group?: number }>()

  headers.forEach((h, idx) => {
    // translation -> ru, translation_en -> en, translation_uk -> uk
    if (h.startsWith("translation_")) {
      const lang = h.replace("translation_", "")
      if (!languageMap.has(lang)) languageMap.set(lang, {})
      languageMap.get(lang)!.translation = idx
    } else if (h === "translation") {
      if (!languageMap.has("ru")) languageMap.set("ru", {})
      languageMap.get("ru")!.translation = idx
    }

    // example_de, example_ru, example_en, example_uk
    if (h.startsWith("example_")) {
      const lang = h.replace("example_", "")
      if (!languageMap.has(lang)) languageMap.set(lang, {})
      languageMap.get(lang)!.example = idx
    }

    // description_de, description_ru, description_en, description_uk
    if (h.startsWith("description_")) {
      const lang = h.replace("description_", "")
      if (!languageMap.has(lang)) languageMap.set(lang, {})
      languageMap.get(lang)!.description = idx
    }

    // group_en, group_uk
    if (h.startsWith("group_")) {
      const lang = h.replace("group_", "")
      if (!languageMap.has(lang)) languageMap.set(lang, {})
      languageMap.get(lang)!.group = idx
    }
  })

  const gi = headers.indexOf("group")
  const tgi = headers.indexOf("tags")
  const detectedLanguages = Array.from(languageMap.keys())

  const cards: MultilingualCardRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    const word = cols[wi]?.trim()
    if (!word) continue

    const card: MultilingualCardRow = {
      word: { de: word } as any,
      translations: {},
      examples: { de: "" },
      descriptions: { de: "" },
      group: { de: gi >= 0 ? cols[gi]?.trim() ?? "" : "" },
      tags: tgi >= 0 ? (cols[tgi]?.trim() ?? "").split(";").map((t) => t.trim()).filter(Boolean) : [],
    }

    // Extract translations and examples for each detected language
    languageMap.forEach((indices, lang) => {
      if (indices.translation !== undefined) {
        const text = cols[indices.translation]?.trim()
        if (text) card.translations[lang] = text
      }
      if (indices.example !== undefined) {
        const text = cols[indices.example]?.trim()
        if (text) card.examples[lang] = text
      }
      if (indices.description !== undefined) {
        const text = cols[indices.description]?.trim()
        if (text) card.descriptions[lang] = text
      }
      if (indices.group !== undefined) {
        const text = cols[indices.group]?.trim()
        if (text) card.group[lang] = text
      }
    })

    // Must have at least one translation
    if (Object.keys(card.translations).length > 0) {
      cards.push(card)
    }
  }

  if (!cards.length) return { cards: [], error: "no_cards", detectedLanguages }
  return { cards, error: null, detectedLanguages }
}
