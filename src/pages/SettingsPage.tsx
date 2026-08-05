import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useDailyGoal } from "@/hooks/useDailyGoal"
import { useDashboardSection } from "@/hooks/useDashboardSection"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import { useNavigate } from "react-router-dom"
import type { Language } from "@/types/db"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SUPPORTED_LANGUAGES } from "@/i18n"
import { languageName } from "@/lib/languageLabel"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"
import { IosInstallDialog } from "@/components/IosInstallDialog"

const DAILY_GOAL_OPTIONS = [10, 15, 20, 25, 30, 50]

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { profile, updateProfile } = useAuth()
  const { wordsPerDay } = useDailyGoal()
  const { setGoalDialogOpen } = useDashboardSection()
  const { canInstall, isIos, promptInstall } = usePwaInstall()
  const [iosDialogOpen, setIosDialogOpen] = React.useState(false)

  // Unsaved changes tracking
  const [hasChanges, setHasChanges] = React.useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = React.useState(false)
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  // Form state
  const [displayName, setDisplayName] = React.useState(profile?.display_name ?? "")
  const [vibrateOn, setVibrateOn] = React.useState(profile?.vibrate_on_correct ?? true)
  const [showOnLeaderboard, setShowOnLeaderboard] = React.useState(
    profile?.show_on_leaderboard ?? false
  )
  const [languageToTemp, setLanguageToTemp] = React.useState<Language>(
    (profile?.language_to || "de") as Language
  )
  const [dailyGoalTemp, setDailyGoalTemp] = React.useState<number | null>(wordsPerDay)

  const [resetDialogOpen, setResetDialogOpen] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)

  // The source language is not picked separately — it always follows the
  // interface language chosen above.
  const languageFrom = (i18n.language?.split("-")[0] || "en") as Language

  // Learning a language into itself makes no sense: if the interface language
  // catches up with the target, move the target to the next supported one.
  React.useEffect(() => {
    if (languageToTemp === languageFrom) {
      const next = SUPPORTED_LANGUAGES.find((lang) => lang !== languageFrom)
      if (next) setLanguageToTemp(next as Language)
    }
  }, [languageFrom, languageToTemp])

  // Track if anything changed
  React.useEffect(() => {
    const changed =
      displayName !== (profile?.display_name ?? "") ||
      vibrateOn !== (profile?.vibrate_on_correct ?? true) ||
      showOnLeaderboard !== (profile?.show_on_leaderboard ?? false) ||
      languageFrom !== (profile?.language_from || "en") ||
      languageToTemp !== (profile?.language_to || "de")

    setHasChanges(changed)
  }, [displayName, vibrateOn, showOnLeaderboard, languageFrom, languageToTemp, profile])

  // Handle unsaved changes when leaving
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasChanges])

  const handleSaveAll = async () => {
    if (!profile) return
    setIsSaving(true)
    try {
      await updateProfile({
        display_name: displayName || null,
        vibrate_on_correct: vibrateOn,
        show_on_leaderboard: showOnLeaderboard,
        language_from: languageFrom,
        language_to: languageToTemp,
      })

      if (dailyGoalTemp !== wordsPerDay && dailyGoalTemp) {
        await supabase.from("user_settings").upsert(
          { user_id: profile.id, words_per_day: dailyGoalTemp },
          { onConflict: "user_id" }
        )
      }

      toast.success(t("settings.changesSaved", "Changes saved!"))
      setHasChanges(false)

      if (pendingNavigation) {
        navigate(pendingNavigation)
        setPendingNavigation(null)
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error(t("settings.saveError", "Failed to save changes"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetProgress = async () => {
    if (!profile) return
    setResetting(true)
    try {
      const { error } = await supabase
        .from("card_marks")
        .delete()
        .eq("student_id", profile.id)

      if (error) throw error

      toast.success(t("settings.progressReset", "Progress reset!"))
      setResetDialogOpen(false)
    } catch (error) {
      console.error("Error resetting progress:", error)
      toast.error(t("settings.resetError", "Failed to reset progress"))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t("nav.settings")}</h2>

        {/* Language Selection */}
        <div className="space-y-2">
          <Label>{t("language.label")}</Label>
          <Select value={i18n.language} onValueChange={(lng) => i18n.changeLanguage(lng)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uk">🇺🇦 Українська</SelectItem>
              <SelectItem value="ru">🇷🇺 Русский</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
              <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Language being learned */}
        <div className="space-y-3">
          <h3 className="font-semibold">{t("languagePair.title")}</h3>

          <div className="space-y-2">
            <Select value={languageToTemp} onValueChange={(v) => setLanguageToTemp(v as Language)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.filter((lang) => lang !== languageFrom).map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {t(`language.${lang}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("languagePair.fromInterface", {
                language: languageName(t, languageFrom),
              })}
            </p>
          </div>
        </div>

        <Separator />

        {/* Daily Goal */}
        <div className="space-y-2">
          <Label>{t("dailyGoal.sidebarLabel")}</Label>
          <Select
            value={dailyGoalTemp?.toString() || "20"}
            onValueChange={(v) => setDailyGoalTemp(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAILY_GOAL_OPTIONS.map((goal) => (
                <SelectItem key={goal} value={goal.toString()}>
                  {t("common.wordsCount", { count: goal })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Profile Name */}
        <div className="space-y-2">
          <Label htmlFor="display-name">{t("common.name")}</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("settings.namePlaceholder")}
          />
        </div>

        <Separator />

        {/* Vibrate Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{t("study.vibrateLabel")}</div>
            <p className="text-sm text-muted-foreground">{t("study.vibrateOn")}</p>
          </div>
          <Switch checked={vibrateOn} onCheckedChange={setVibrateOn} />
        </div>

        <Separator />

        {/* Leaderboard Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">🔥 {t("leaderboard.title")}</div>
            <p className="text-sm text-muted-foreground">{t("settings.showOnLeaderboard")}</p>
          </div>
          <Switch checked={showOnLeaderboard} onCheckedChange={setShowOnLeaderboard} />
        </div>

        <Separator />

        {/* Danger Zone - Reset Progress */}
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">{t("settings.dangerZone")}</h3>
              <p className="text-sm text-red-800 mt-1">{t("settings.resetDesc")}</p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setResetDialogOpen(true)}
            className="w-full"
          >
            {t("settings.resetProgress")}
          </Button>
        </div>

        {/* Reset Confirmation Dialog */}
        {resetDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md space-y-4 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">{t("settings.confirmReset")}</h2>
              <p className="text-sm text-muted-foreground">{t("settings.resetWarning")}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
                  {t("common.cancel")}
                </Button>
                <Button variant="destructive" onClick={handleResetProgress} disabled={resetting}>
                  {resetting ? t("common.loading") : t("settings.resetProgress")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Install App */}
        {(canInstall || isIos) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold">{t("pwa.settingsTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("pwa.settingsDesc")}</p>
              <Button
                className="w-full"
                onClick={() => {
                  if (isIos) {
                    setIosDialogOpen(true)
                  } else {
                    void promptInstall()
                  }
                }}
              >
                {t("pwa.installLink")}
              </Button>
              {isIos && <IosInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />}
            </div>
          </>
        )}
      </div>

      {/* Save/Discard Changes Dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md space-y-4 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">{t("settings.unsavedChanges", "Unsaved Changes")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.unsavedDesc", "Do you want to save your changes?")}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnsavedDialog(false)
                  if (pendingNavigation) {
                    navigate(pendingNavigation)
                    setPendingNavigation(null)
                  }
                  setHasChanges(false)
                }}
                disabled={isSaving}
              >
                {t("settings.discard", "Discard")}
              </Button>
              <Button onClick={handleSaveAll} disabled={isSaving}>
                {isSaving ? t("common.loading") : t("settings.saveChanges", "Save Changes")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Save Button */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg dark:bg-slate-900 dark:border-slate-700">
          <div className="max-w-2xl mx-auto flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setDisplayName(profile?.display_name ?? "")
                setVibrateOn(profile?.vibrate_on_correct ?? true)
                setShowOnLeaderboard(profile?.show_on_leaderboard ?? false)
                setLanguageToTemp((profile?.language_to || "de") as Language)
                setHasChanges(false)
              }}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </div>
      )}

      {hasChanges && <div className="h-20" />}
    </div>
  )
}
