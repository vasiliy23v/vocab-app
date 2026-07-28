import * as React from "react"
import { useAuth } from "@/hooks/useAuth"

/** Local calendar date (YYYY-MM-DD) — streaks run on the student's own day, not UTC. */
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / msPerDay)
}

/**
 * Daily study streak, backed by profiles.current_streak/last_study_date.
 * Only bumped when a full study session finishes (matches "known" marks,
 * which are also only saved on finish) — one bump per calendar day.
 */
export function useStudyStreak() {
  const { profile, updateProfile } = useAuth()
  const today = todayLocal()
  const lastStudyDate = profile?.last_study_date ?? null
  const storedStreak = profile?.current_streak ?? 0
  const longestStreak = profile?.longest_streak ?? 0

  // The DB only updates on the next finished session, so a streak that
  // lapsed (missed a day) still reads as its old value until then —
  // recompute "is it actually still alive" from the date instead of
  // trusting the stored count at rest.
  const isAlive = lastStudyDate === today || (lastStudyDate !== null && daysBetween(lastStudyDate, today) === 1)
  const displayStreak = isAlive ? storedStreak : 0
  const studiedToday = lastStudyDate === today

  const bump = React.useCallback(async () => {
    if (lastStudyDate === today) return { streak: storedStreak, extended: false }
    const next = lastStudyDate !== null && daysBetween(lastStudyDate, today) === 1 ? storedStreak + 1 : 1
    const longest = Math.max(longestStreak, next)
    await updateProfile({ current_streak: next, longest_streak: longest, last_study_date: today })
    return { streak: next, extended: true }
  }, [lastStudyDate, storedStreak, longestStreak, today, updateProfile])

  return { streak: displayStreak, longestStreak, studiedToday, bump }
}
