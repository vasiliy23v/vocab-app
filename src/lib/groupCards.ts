import { cardGroupName } from "@/lib/cardTranslation"
import type { CardWithMarks } from "@/types/db"

export interface CardGroup {
  /** raw group value (Russian) — stable identity, independent of interface language */
  key: string
  /** name to display, translated for the current interface language */
  name: string
  cards: CardWithMarks[]
}

/**
 * Groups cards by their `group` field (the topic column from the
 * TSV/CSV upload, e.g. "Жильё и дом"), preserving the order topics
 * first appear in. Cards with a blank group are bucketed together
 * under an empty-string key, rendered as "(no topic)" in the UI.
 *
 * Grouping always keys off the raw (Russian) `group` value so a topic
 * stays a single bucket regardless of language — only the displayed
 * `name` changes, via `group_en` when the interface is in English.
 */
export function groupCardsByTopic(cards: CardWithMarks[], language: string): CardGroup[] {
  const order: string[] = []
  const map = new Map<string, CardWithMarks[]>()
  for (const c of cards) {
    const key = c.group?.trim() || ""
    if (!map.has(key)) {
      order.push(key)
      map.set(key, [])
    }
    map.get(key)!.push(c)
  }
  return order.map((key) => {
    const groupCards = map.get(key) ?? []
    const name = groupCards[0] ? cardGroupName(groupCards[0], language) : key
    return { key, name, cards: groupCards }
  })
}

/** Is it worth showing a topic picker for this card set at all? Independent of language — it's about how many distinct topics exist, not what they're called. */
export function hasMultipleTopics(cards: CardWithMarks[]): boolean {
  const keys = new Set(cards.map((c) => c.group?.trim() || ""))
  return keys.size > 1
}
