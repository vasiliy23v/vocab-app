import * as React from "react"
import { useTranslation } from "react-i18next"
import { Flame } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LeaderboardEntry {
  id: string
  display_name: string | null
  flames_count: number
  rank: number
}

/** Own standing straight from the DB, so it stays right for students who
 *  sit below the top-100 the list itself fetches. */
interface OwnStanding {
  rank: number
  flames_count: number
  total: number
}

const TOP_LIMIT = 100

export default function LeaderboardPage() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([])
  const [standing, setStanding] = React.useState<OwnStanding | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [joining, setJoining] = React.useState(false)

  const optedIn = profile?.show_on_leaderboard ?? false
  const profileId = profile?.id ?? null

  React.useEffect(() => {
    if (!optedIn) return
    let cancelled = false

    const load = async () => {
      const [boardRes, rankRes] = await Promise.all([
        supabase.from("leaderboard").select("*").order("rank").limit(TOP_LIMIT),
        supabase.rpc("my_leaderboard_rank"),
      ])
      if (cancelled) return

      setEntries((boardRes.data as LeaderboardEntry[]) ?? [])
      // The RPC returns no row at all for someone who has not earned a
      // flame yet — that is a real state (rank 0), not a failed load, so
      // it has to clear any standing left over from a previous render.
      const own = (rankRes.data as OwnStanding[] | null)?.[0] ?? null
      setStanding(own)
      setLoading(false)
    }

    void load()

    // Own profile updates arrive over realtime (RLS keeps other people's
    // rows out), so a word mastered here refreshes the board immediately;
    // other players' scores land on the next visit or tab focus.
    const channel = profileId
      ? supabase
          .channel(`leaderboard_${profileId}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profileId}` },
            () => void load()
          )
          .subscribe()
      : null

    const onFocus = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onFocus)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onFocus)
      if (channel) supabase.removeChannel(channel)
    }
  }, [optedIn, profileId])

  const handleJoin = async () => {
    setJoining(true)
    try {
      await updateProfile({ show_on_leaderboard: true })
    } finally {
      setJoining(false)
    }
  }

  if (!optedIn) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-10">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{t("leaderboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("leaderboard.desc")}</p>
        </div>

        <EarningRules />

        <p className="text-xs text-muted-foreground">{t("leaderboard.info")}</p>

        <Button onClick={handleJoin} disabled={joining} className="w-full">
          {joining ? t("common.loading") : t("leaderboard.joinNow")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("leaderboard.title")}</h1>
        <span className="text-sm text-muted-foreground">
          {standing
            ? t("leaderboard.standing", { rank: standing.rank, total: standing.total })
            : t("leaderboard.unranked")}
        </span>
      </div>

      {loading ? (
        <div className="space-y-px">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("leaderboard.empty")}</p>
      ) : (
        <ol className="divide-y rounded-lg border">
          {entries.map((entry) => {
            const isYou = entry.id === profileId
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm",
                  isYou && "bg-orange-50/70 dark:bg-orange-950/30"
                )}
              >
                <span
                  className={cn(
                    "w-7 shrink-0 text-right tabular-nums text-muted-foreground",
                    entry.rank <= 3 && "font-semibold text-foreground"
                  )}
                >
                  {entry.rank}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", isYou && "font-medium")}>
                  {entry.display_name || t("common.noName")}
                </span>
                <span className="flex shrink-0 items-center gap-1 tabular-nums">
                  <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                  {entry.flames_count}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <EarningRules />
    </div>
  )
}

/** The one place the earning rules are spelled out, shared by the opt-in
 *  screen and the board itself so the two can never disagree. */
function EarningRules() {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="mb-1.5 font-medium text-foreground">{t("leaderboard.rulesTitle")}</p>
      <ul className="space-y-1">
        <li>{t("leaderboard.rule1")}</li>
        <li>{t("leaderboard.rule2")}</li>
        <li>{t("leaderboard.rule3")}</li>
        <li>{t("leaderboard.rule4")}</li>
      </ul>
    </div>
  )
}
