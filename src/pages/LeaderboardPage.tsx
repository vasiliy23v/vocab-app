import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface LeaderboardEntry {
  id: string
  display_name: string | null
  flames_count: number
  rank: number
}

export default function LeaderboardPage() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userRank, setUserRank] = React.useState<LeaderboardEntry | null>(null)
  const [joiningLoading, setJoiningLoading] = React.useState(false)

  React.useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true)
      const { data, error } = await supabase.from("leaderboard").select("*").limit(100)

      if (!error && data) {
        setEntries((data as LeaderboardEntry[]) || [])

        if (profile) {
          const userEntry = (data as LeaderboardEntry[]).find((e) => e.id === profile.id)
          if (userEntry) {
            setUserRank(userEntry)
          }
        }
      }
      setLoading(false)
    }

    loadLeaderboard()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel("leaderboard_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          loadLeaderboard()
        }
      )
      .subscribe()

    return () => {
      void subscription.unsubscribe()
    }
  }, [profile])

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return "🥇"
    if (rank === 2) return "🥈"
    if (rank === 3) return "🥉"
    return `#${rank}`
  }

  const handleJoinLeaderboard = async () => {
    if (!profile) return
    setJoiningLoading(true)
    try {
      await updateProfile({ show_on_leaderboard: true })
    } catch (error) {
      console.error("Error joining leaderboard:", error)
    } finally {
      setJoiningLoading(false)
    }
  }

  // Show join prompt if user hasn't joined
  if (!profile?.show_on_leaderboard) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
        <div className="text-center space-y-3">
          <div className="text-6xl">🔥</div>
          <h1 className="text-3xl font-bold">{t("leaderboard.title")}</h1>
          <p className="text-lg text-muted-foreground max-w-md">
            {t("leaderboard.desc")}
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 p-6 max-w-md space-y-3">
          <div className="font-semibold text-amber-900">✨ {t("leaderboard.earnFlames")}</div>
          <ul className="space-y-2 text-sm text-amber-800">
            <li>✓ {t("leaderboard.flame1")}</li>
            <li>✓ {t("leaderboard.flame2")}</li>
          </ul>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 text-sm max-w-md text-blue-800">
          {t("leaderboard.info")}
        </div>

        <Button onClick={handleJoinLeaderboard} disabled={joiningLoading} size="lg" className="mt-4">
          {joiningLoading ? t("common.loading") : t("leaderboard.joinNow")}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">🔥 {t("leaderboard.title", "Leaderboard")}</h1>
        <p className="text-muted-foreground">{t("leaderboard.subtitle", "Top performers mastering German words")}</p>
      </div>

      {/* User's Rank (if on leaderboard) */}
      {userRank && (
        <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{getMedalEmoji(userRank.rank)}</div>
              <div>
                <div className="font-semibold">{userRank.display_name || t("common.noName", "No name")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("leaderboard.yourRank", "Your rank:")} #{userRank.rank}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">🔥 {userRank.flames_count}</div>
              <div className="text-xs text-muted-foreground">{t("leaderboard.flames", "flames")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t("leaderboard.topPlayers", "Top Players")}</h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground p-8 text-center">
            <div className="text-2xl mb-2">🦗</div>
            <p className="text-muted-foreground">{t("leaderboard.empty", "No one on the leaderboard yet")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("leaderboard.emptyHint", "Be the first to join and start earning flames!")}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-lg p-3 ${
                  entry.id === profile?.id ? "bg-blue-50 border-2 border-blue-200" : "bg-muted/30 hover:bg-muted/50"
                } transition-colors`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 text-center font-semibold text-lg">{getMedalEmoji(entry.rank)}</div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {entry.display_name || t("common.noName", "No name")}
                      {entry.id === profile?.id && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {t("leaderboard.you", "You")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">🔥 {entry.flames_count}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-blue-50 p-4 text-sm">
        <div className="font-semibold text-blue-900">💡 {t("leaderboard.howItWorks", "How it works:")}</div>
        <ul className="mt-2 space-y-1 text-blue-800">
          <li>✓ {t("leaderboard.info1", "Earn 1 flame for each word you master")}</li>
          <li>✓ {t("leaderboard.info2", "Only appears on the leaderboard if you opted in")}</li>
          <li>✓ {t("leaderboard.info3", "Updates in real-time as you learn")}</li>
          <li>✓ {t("leaderboard.info4", "You can opt-out anytime in Settings")}</li>
        </ul>
      </div>
    </div>
  )
}
