import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useDashboardData, useDerivedCardSets } from "@/hooks/useDashboardData"
import type { CardWithMarks, MarkStatus } from "@/types/db"

/**
 * Which "page" of the student dashboard is showing. This lives above
 * StudentDashboard (in the route tree, alongside AppLayout) so the
 * sidebar can render Review/Mastered/Word table as real navigation
 * items — clicking one swaps the dashboard's main content without
 * either component needing to reach into the other's local state.
 */
export type DashboardSection = "decks" | "review" | "mastered" | "table"

interface DashboardSectionContextValue {
  section: DashboardSection
  setSection: (s: DashboardSection) => void
  cards: CardWithMarks[]
  newCards: CardWithMarks[]
  reviewQueue: CardWithMarks[]
  masteredCards: CardWithMarks[]
  loading: boolean
  setOwnMark: (cardId: string, status: MarkStatus) => Promise<{ error: string | null }>
  /** Shared with AppLayout, which mounts the actual DailyGoalDialog —
   *  lets the level-picker's "change" link open the same instance. */
  goalDialogOpen: boolean
  setGoalDialogOpen: (open: boolean) => void
}

const DashboardSectionContext = React.createContext<DashboardSectionContextValue | null>(null)

export function DashboardSectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { cards, loading } = useDashboardData(user?.id ?? null)
  const { newCards, reviewQueue, masteredCards } = useDerivedCardSets(cards)
  const [section, setSection] = React.useState<DashboardSection>("decks")
  const [goalDialogOpen, setGoalDialogOpen] = React.useState(false)

  const setOwnMark = React.useCallback(
    async (cardId: string, status: MarkStatus) => {
      // Optimistic update
      // No need to actually update the global cards array here - let realtime do it
      const { error } = await supabase.rpc("set_card_mark", {
        p_card_id: cardId,
        p_status: status,
      })
      return { error: error?.message ?? null }
    },
    []
  )

  const value = React.useMemo(
    () => ({
      section,
      setSection,
      cards,
      newCards,
      reviewQueue,
      masteredCards,
      loading,
      setOwnMark,
      goalDialogOpen,
      setGoalDialogOpen,
    }),
    [section, cards, newCards, reviewQueue, masteredCards, loading, setOwnMark, goalDialogOpen]
  )

  return <DashboardSectionContext.Provider value={value}>{children}</DashboardSectionContext.Provider>
}

export function useDashboardSection(): DashboardSectionContextValue {
  const ctx = React.useContext(DashboardSectionContext)
  if (!ctx) throw new Error("useDashboardSection must be used within a DashboardSectionProvider")
  return ctx
}
