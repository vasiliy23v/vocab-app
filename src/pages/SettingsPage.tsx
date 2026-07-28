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
import { Separator } from "@/components/ui/separator"
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
    <div className="max-w-2xl space-y-6">
      {/* UI Language Section */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">{t("language.label")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
        </div>
        <LanguageSwitcher />
      </div>

      <Separator />

      {/* Learning Language Pair Section */}
      {languageFromTemp && languageToTemp && (
        <>
          <div className="space-y-3">
            <h3 className="font-semibold">{t("languagePair.title")}</h3>
            <LanguagePairSelector
              from={languageFromTemp}
              to={languageToTemp}
              onFromChange={setLanguageFromTemp}
              onToChange={setLanguageToTemp}
              onSave={handleSaveLanguagePair}
              isSaving={isSavingLanguagePair}
            />
          </div>
          <Separator />
        </>
      )}

      {/* Daily Goal Section */}
      <button
        type="button"
        onClick={() => setGoalDialogOpen(true)}
        className="w-full text-left transition-colors hover:opacity-70"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{t("dailyGoal.sidebarLabel")}</div>
            <p className="text-sm text-muted-foreground">{t("dailyGoal.desc")}</p>
          </div>
          <div className="text-right text-sm font-semibold">
            {wordsPerDay !== null ? t("dailyGoal.perLevel", { n: wordsPerDay }) : t("dailyGoal.change")}
          </div>
        </div>
      </button>

      <Separator />

      {/* Vibration Section */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{t("study.vibrateLabel")}</div>
        </div>
        <Switch
          checked={vibrateOn}
          onCheckedChange={(checked) => {
            void updateProfile({ vibrate_on_correct: checked })
          }}
        />
      </div>

      {(canInstall || isIos) && (
        <>
          <Separator />
          {/* Install App Section */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
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
        </>
      )}
    </div>
  )
}
