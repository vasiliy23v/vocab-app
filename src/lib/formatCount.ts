/**
 * Large decks (hundreds/thousands of cards) don't need an exact count
 * everywhere in the UI — past a point it's just visual noise. Cap the
 * displayed number and show "1000+" instead.
 */
const COUNT_CAP = 1000

export function formatCount(n: number): string {
  return n >= COUNT_CAP ? `${COUNT_CAP}+` : String(n)
}
