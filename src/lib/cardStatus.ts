import type { CardWithMarks, MarkStatus } from "@/types/db"

/** A teacher's mark always wins; without one, the student's own
 *  self-assessment counts instead (many students study solo with no
 *  teacher linked at all, so relying on teacher_status alone would
 *  mean nothing ever leaves the review queue for them). */
export function effectiveMarkStatus(c: CardWithMarks): MarkStatus | null {
  return c.teacher_status ?? c.own_status ?? null
}

/** A level is "cleared" once every card in it has been marked known —
 *  drives the Duolingo-style locked/unlocked level path. */
export function isLevelCleared(cards: CardWithMarks[]): boolean {
  return cards.length > 0 && cards.every((c) => effectiveMarkStatus(c) === "known")
}
