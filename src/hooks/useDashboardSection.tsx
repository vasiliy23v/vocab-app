import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useAllStudentCards } from "@/hooks/useCards"
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
  reviewQueue: CardWithMarks[]
  masteredCards: CardWithMarks[]
  loading: boolean
  setOwnMark: (cardId: string, status: MarkStatus) => Promise<{ error: string | null }>
}

const DashboardSectionContext = React.createContext<DashboardSectionContextValue | null>(null)

export function DashboardSectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { cards, reviewQueue, masteredCards, loading, setOwnMark } = useAllStudentCards(user?.id ?? null)
  const [section, setSection] = React.useState<DashboardSection>("decks")

  const value = React.useMemo(
    () => ({ section, setSection, cards, reviewQueue, masteredCards, loading, setOwnMark }),
    [section, cards, reviewQueue, masteredCards, loading] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return <DashboardSectionContext.Provider value={value}>{children}</DashboardSectionContext.Provider>
}

export function useDashboardSection(): DashboardSectionContextValue {
  const ctx = React.useContext(DashboardSectionContext)
  if (!ctx) throw new Error("useDashboardSection must be used within a DashboardSectionProvider")
  return ctx
}
