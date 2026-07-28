import { useAuth } from "@/hooks/useAuth"

/** Fixed level size for the leveled study path — a persistent "words per
 *  day" goal instead of a per-session choice. null until the student
 *  picks one for the first time. */
export function useDailyGoal() {
  const { profile, updateProfile } = useAuth()
  const wordsPerDay = profile?.words_per_day ?? null

  const setWordsPerDay = async (n: number) => {
    return await updateProfile({ words_per_day: n })
  }

  return { wordsPerDay, setWordsPerDay }
}
