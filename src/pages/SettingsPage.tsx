import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useDailyGoal } from "@/hooks/useDailyGoal"
import { useDashboardSection } from "@/hooks/useDashboardSection"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import { LanguagePairSelector } from "@/components/LanguagePairSelector"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { IosInstallDialog } from "@/components/IosInstallDialog"
import type { Language } from "@/types/db"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Download } from "lucide-react"

export default function SettingsPage() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const { wordsPerDay } = useDailyGoal()
  const { setGoalDialogOpen } = useDashboardSection()
  const { canInstall, isIos, promptInstall } = usePwaInstall()
  const [languageFromTemp, setLanguageFromTemp] = React.useState<Language | undefined>(undefined)
  const [languageToTemp, setLanguageToTemp] = React.useState<Language | undefined>(undefined)
  const [isSavingLanguagePair, setIsSavingLanguagePair] = React.useState(false)
  const [iosDialogOpen, setIosDialogOpen] = React.useState(false)

  React.useEffect(() => {
    if (profile && !languageFromTemp) {
      setLanguageFromTemp((profile.language_from || "en") as Language)
      setLanguageToTemp((profile.language_to || "de") as Language)
    }
  }, [profile, languageFromTemp])

  const handleSaveLanguagePair = async () => {
    if (!languageFromTemp || !languageToTemp || languageFromTemp === languageToTemp) return
    setIsSavingLanguagePair(true)
    await updateProfile({
      language_from: languageFromTemp,
      language_to: languageToTemp,
    })
    setIsSavingLanguagePair(false)
  }

  const vibrateOn = profile?.vibrate_on_correct ?? true

  return (
    <div className="space-y-4">
      {/* UI Language Section */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">{t("language.label")}</h3>
        <p className="mb-3 text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
        <LanguageSwitcher />
      </div>

      {/* Learning Language Pair Section */}
      {languageFromTemp && languageToTemp && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-4 font-semibold">{t("languagePair.title")}</h3>
          <LanguagePairSelector
            from={languageFromTemp}
            to={languageToTemp}
            onFromChange={setLanguageFromTemp}
            onToChange={setLanguageToTemp}
            onSave={handleSaveLanguagePair}
            isSaving={isSavingLanguagePair}
          />
        </div>
      )}

      {/* Daily Goal Section */}
      <button
        type="button"
        onClick={() => setGoalDialogOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
      >
        <div>
          <div className="text-sm font-medium">{t("dailyGoal.sidebarLabel")}</div>
          <div className="text-xs text-muted-foreground">
            {t("dailyGoal.desc")}
          </div>
        </div>
        <div className="text-sm font-semibold">
          {wordsPerDay !== null ? t("dailyGoal.perLevel", { n: wordsPerDay }) : t("dailyGoal.change")}
        </div>
      </button>

      {/* Vibration Section */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <div className="text-sm font-medium">{t("study.vibrateLabel")}</div>
          <div className="text-xs text-muted-foreground">{t("study.vibrateLabel")}</div>
        </div>
        <Switch
          checked={vibrateOn}
          onCheckedChange={(checked) => {
            void updateProfile({ vibrate_on_correct: checked })
          }}
        />
      </div>

      {/* Install App Section */}
      {(canInstall || isIos) && (
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4" />
            <div>
              <div className="font-semibold">{t("pwa.settingsTitle")}</div>
              <p className="text-sm text-muted-foreground">{t("pwa.settingsDesc")}</p>
            </div>
          </div>
          <Button
            type="button"
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
      )}
    </div>
  )
}
