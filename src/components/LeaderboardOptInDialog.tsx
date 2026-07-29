import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

export function LeaderboardOptInDialog() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  // Show dialog once per session when user hasn't opted in yet
  React.useEffect(() => {
    if (profile && !profile.show_on_leaderboard) {
      const sessionKey = `leaderboard_prompt_shown_${profile.id}`
      const wasShown = sessionStorage.getItem(sessionKey)
      if (!wasShown) {
        // Show after a small delay for better UX
        const timer = setTimeout(() => {
          setOpen(true)
          sessionStorage.setItem(sessionKey, "true")
        }, 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [profile])

  const handleOptIn = async () => {
    if (!profile) return
    setLoading(true)
    try {
      await updateProfile({ show_on_leaderboard: true })
      setOpen(false)
    } catch (error) {
      console.error("Error opting in to leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            {t("leaderboard.title", "Join the Leaderboard?")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "leaderboard.desc",
              "Show your name on the leaderboard and compete with others. Earn 🔥 flames for each word you master!"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="text-sm text-muted-foreground">
            {t(
              "leaderboard.info",
              "Your progress will be visible to other users. You can change this in Settings anytime."
            )}
          </div>

          <div className="rounded-lg bg-amber-50 p-3 text-sm">
            <div className="font-semibold text-amber-900">🔥 {t("leaderboard.earnFlames", "How to earn flames:")}</div>
            <ul className="mt-1 space-y-1 text-amber-800">
              <li>✓ {t("leaderboard.flame1", "+1 flame for each word you mark as 'known'")}</li>
              <li>✓ {t("leaderboard.flame2", "Flames track your total mastered words")}</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkip} disabled={loading}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleOptIn} disabled={loading}>
            {t("leaderboard.joinNow", "Join Leaderboard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
