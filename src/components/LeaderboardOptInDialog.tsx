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
          <DialogTitle>{t("leaderboard.title")}</DialogTitle>
          <DialogDescription>{t("leaderboard.desc")}</DialogDescription>
        </DialogHeader>

        {/* Same wording as the leaderboard page's rules block — one set of
            keys, so the promise made here and the rule enforced there
            cannot drift apart. */}
        <div className="space-y-3 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground">{t("leaderboard.rulesTitle")}</p>
            <ul className="space-y-1">
              <li>{t("leaderboard.rule1")}</li>
              <li>{t("leaderboard.rule2")}</li>
              <li>{t("leaderboard.rule3")}</li>
              <li>{t("leaderboard.rule4")}</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">{t("leaderboard.info")}</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkip} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleOptIn} disabled={loading}>
            {t("leaderboard.joinNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
