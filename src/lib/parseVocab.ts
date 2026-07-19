import type { ParsedCardRow } from "@/types/db"

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
