import type { CardWithMarks } from "@/types/db"

export type QuizType = "multi" | "spelling" | "typein"

export interface QuizOption {
  label: string
  isCorrect: boolean
}

export interface QuizQuestion {
  type: QuizType
  card: CardWithMarks
  options?: QuizOption[]
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

/** "fallen (fällt)" -> "fallen", "der Artikel, -" -> "der Artikel" */
export function mainWord(de: string): string {
  return de.replace(/\s*\(.*?\)/g, "").replace(/,.*$/, "").trim()
}

/** All acceptable typed answers: main word + any parenthesised forms. */
export function acceptedForms(de: string): string[] {
  const forms = [mainWord(de)]
  const matches = de.match(/\(([^)]+)\)/g)
  if (matches) matches.forEach((p) => forms.push(p.replace(/[()]/g, "").trim()))
  return forms
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[(),.\-!?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function makeTypos(word: string, n: number): string[] {
  const res: string[] = []
  const base = mainWord(word)
  const keyboardMap: Record<string, string> = {
    a: "äs", o: "öp", u: "üi", e: "ei", s: "as", r: "er", n: "mn",
    t: "rz", h: "gh", k: "jl", l: "kö", d: "sf", g: "fh", b: "vn",
    m: "nm", f: "vp", w: "vq",
  }
  for (let i = 0; i < n * 2; i++) {
    const a = [...base]
    const op = Math.floor(Math.random() * 3)
    if (op === 0 && a.length > 2) {
      const p = 1 + Math.floor(Math.random() * (a.length - 2))
      ;[a[p], a[p + 1]] = [a[p + 1], a[p]]
    } else if (op === 1) {
      const p = Math.floor(Math.random() * a.length)
      const c = a[p].toLowerCase()
      if (keyboardMap[c]) a[p] = keyboardMap[c][Math.floor(Math.random() * keyboardMap[c].length)]
    } else if (op === 2 && a.length > 3) {
      const p = 1 + Math.floor(Math.random() * (a.length - 2))
      a.splice(p, 1)
    }
    const result = a.join("")
    if (result !== base && result !== word) res.push(result)
  }
  return [...new Set(res)]
}

function makeMultiChoice(card: CardWithMarks, pool: CardWithMarks[]): QuizQuestion {
  const wrong = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, 3)
  const options: QuizOption[] = shuffle(
    [card, ...wrong].map((c) => ({ label: mainWord(c.word_de), isCorrect: c.id === card.id }))
  )
  return { type: "multi", card, options }
}

function makeSpelling(card: CardWithMarks, pool: CardWithMarks[]): QuizQuestion {
  const correct = mainWord(card.word_de)
  const otherWords = shuffle(pool.filter((c) => c.id !== card.id)).map((c) => mainWord(c.word_de))
  const typos = makeTypos(card.word_de, 8)
  const selected: string[] = []
  const seen = new Set([correct])
  for (const w of [...typos, ...otherWords]) {
    if (!seen.has(w) && w.length > 1) {
      seen.add(w)
      selected.push(w)
      if (selected.length === 3) break
    }
  }
  while (selected.length < 3) selected.push(correct + "e")
  const options: QuizOption[] = shuffle(
    [correct, ...selected].map((label) => ({ label, isCorrect: label === correct }))
  )
  return { type: "spelling", card, options }
}

export function buildQuizQuestion(card: CardWithMarks, pool: CardWithMarks[], index: number): QuizQuestion {
  if (pool.length < 4) return { type: "typein", card }
  const t = index % 3
  if (t === 0) return makeMultiChoice(card, pool)
  if (t === 1) return makeSpelling(card, pool)
  return { type: "typein", card }
}

export function checkTypedAnswer(value: string, card: CardWithMarks): boolean {
  const accepted = acceptedForms(card.word_de)
  return accepted.some((f) => normalize(value) === normalize(f))
}
