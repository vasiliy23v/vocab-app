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
 * Column lookup that accepts several aliases for the same field —
 * lets the parser understand both the narrow legacy header set
 * (word, translation, example_ru, ...) and the wide multilingual one
 * (word_de, translation_ru, example_ua, ...) without two code paths.
 * "ua" is accepted as an alias for "uk" (Ukrainian) since that's what
 * some source spreadsheets use.
 */
function findCol(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const i = headers.indexOf(name)
    if (i >= 0) return i
  }
  return -1
}

/**
 * Parser for vocabulary CSV/TSV uploads. Supports two header layouts:
 * - narrow (legacy): word, translation, translation_en, group, group_en,
 *   tags, description, description_en, example_de, example_ru, example_en
 * - wide (multilingual export): word_de, translation_ru, translation_en,
 *   translation_uk/translation_ua, group_ru/group, group_en, group_uk/ua,
 *   tags_ru/tags, description_ru/description, description_en,
 *   description_uk/ua, example_de, example_ru, example_en, example_uk/ua
 */
export function parseVocabText(raw: string): ParseResult {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { cards: [], error: "min_lines" }

  const sep = lines[0].includes("\t") ? "\t" : ","
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""))

  const wi = findCol(headers, "word_de", "word")
  const ti = findCol(headers, "translation_ru", "translation")
  if (wi < 0 || ti < 0) {
    return { cards: [], error: "missing_columns" }
  }

  const tei = findCol(headers, "translation_en")
  const tui = findCol(headers, "translation_uk", "translation_ua")
  const gi = findCol(headers, "group_ru", "group")
  const gei = findCol(headers, "group_en")
  const gui = findCol(headers, "group_uk", "group_ua")
  const tgi = findCol(headers, "tags_ru", "tags")
  const di = findCol(headers, "description_ru", "description")
  const dei = findCol(headers, "description_en")
  const dui = findCol(headers, "description_uk", "description_ua")
  const ei = findCol(headers, "example_de")
  const eri = findCol(headers, "example_ru")
  const eei = findCol(headers, "example_en")
  const eui = findCol(headers, "example_uk", "example_ua")

  const col = (cols: string[], idx: number) => (idx >= 0 ? cols[idx]?.trim() ?? "" : "")

  const cards: ParsedCardRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    const de = col(cols, wi)
    const ru = col(cols, ti)
    if (!de || !ru) continue
    cards.push({
      word_de: de,
      translation_ru: ru,
      translation_en: col(cols, tei),
      translation_uk: col(cols, tui),
      group: col(cols, gi),
      group_en: col(cols, gei),
      group_uk: col(cols, gui),
      tags: col(cols, tgi).split(";").map((t) => t.trim()).filter(Boolean),
      description: col(cols, di),
      description_en: col(cols, dei),
      description_uk: col(cols, dui),
      example_de: col(cols, ei),
      example_ru: col(cols, eri),
      example_en: col(cols, eei),
      example_uk: col(cols, eui),
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
      word: { de: word },
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
