import type { ParsedCardRow } from "@/types/db"

function splitLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t").map((c) => c.replace(/^"|"$/g, ""))
  const cols: string[] = []
  const re = /(".*?"|[^,]+)(?=,|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) cols.push(m[1].replace(/^"|"$/g, ""))
  return cols
}

export interface ParseResult {
  cards: ParsedCardRow[]
  error: string | null
}

export function parseVocabText(raw: string): ParseResult {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { cards: [], error: "Нужно минимум 2 строки (заголовок + данные)" }

  const sep = lines[0].includes("\t") ? "\t" : ","
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""))

  const wi = headers.indexOf("word")
  const ti = headers.indexOf("translation")
  if (wi < 0 || ti < 0) {
    return { cards: [], error: "Не найдены обязательные столбцы: word, translation" }
  }

  const gi = headers.indexOf("group")
  const tgi = headers.indexOf("tags")
  const di = headers.indexOf("description")
  const ei = headers.indexOf("example_de")
  const eri = headers.indexOf("example_ru")

  const cards: ParsedCardRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    const de = cols[wi]?.trim()
    const ru = cols[ti]?.trim()
    if (!de || !ru) continue
    cards.push({
      word_de: de,
      translation_ru: ru,
      group: gi >= 0 ? cols[gi]?.trim() ?? "" : "",
      tags: tgi >= 0 ? (cols[tgi]?.trim() ?? "").split(";").map((t) => t.trim()).filter(Boolean) : [],
      description: di >= 0 ? cols[di]?.trim() ?? "" : "",
      example_de: ei >= 0 ? cols[ei]?.trim() ?? "" : "",
      example_ru: eri >= 0 ? cols[eri]?.trim() ?? "" : "",
    })
  }

  if (!cards.length) return { cards: [], error: "Не удалось распознать ни одной карточки" }
  return { cards, error: null }
}
