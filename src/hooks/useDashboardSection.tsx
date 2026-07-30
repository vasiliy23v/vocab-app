import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useDashboardData, useDerivedCardSets } from "@/hooks/useDashboardData"
import type { CardWithMarks, Deck, MarkStatus } from "@/types/db"

/**
 * Which "page" of the student dashboard is showing. Backed by the URL
 * (/, /review, /mastered, /table) rather than local state, so the
 * sidebar can render these as plain <Link>s with real active-route
 * highlighting and the browser back/forward buttons work — while the
 * data fetching below stays here in the provider (mounted once above
 * the route outlet), so switching sections never re-fetches.
 */
export type DashboardSection = "decks" | "review" | "mastered" | "table"

const SECTION_PATHS: Record<DashboardSection, string> = {
  decks: "/",
  review: "/review",
  mastered: "/mastered",
  table: "/table",
}

function sectionFromPath(pathname: string): DashboardSection {
  if (pathname === "/review") return "review"
  if (pathname === "/mastered") return "mastered"
  if (pathname === "/table") return "table"
  return "decks"
}

interface DashboardSectionContextValue {
  section: DashboardSection
  setSection: (s: DashboardSection) => void
  decks: Deck[]
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
  const location = useLocation()
  const navigate = useNavigate()
  const { decks, cards, loading } = useDashboardData(user?.id ?? null)
  const { newCards, reviewQueue, masteredCards } = useDerivedCardSets(cards)
  const section = sectionFromPath(location.pathname)
  const setSection = React.useCallback(
    (s: DashboardSection) => navigate(SECTION_PATHS[s]),
    [navigate]
  )
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
      decks,
      cards,
      newCards,
      reviewQueue,
      masteredCards,
      loading,
      setOwnMark,
      goalDialogOpen,
      setGoalDialogOpen,
    }),
    [section, decks, cards, newCards, reviewQueue, masteredCards, loading, setOwnMark, goalDialogOpen]
  )

  return <DashboardSectionContext.Provider value={value}>{children}</DashboardSectionContext.Provider>
}

export function useDashboardSection(): DashboardSectionContextValue {
  const ctx = React.useContext(DashboardSectionContext)
  if (!ctx) throw new Error("useDashboardSection must be used within a DashboardSectionProvider")
  return ctx
}
