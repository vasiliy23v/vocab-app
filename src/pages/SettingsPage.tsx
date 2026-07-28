import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { LanguagePairSelector } from "@/components/LanguagePairSelector"
import type { Language } from "@/types/db"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  const { t } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const [languageFromTemp, setLanguageFromTemp] = React.useState<Language | undefined>(undefined)
  const [languageToTemp, setLanguageToTemp] = React.useState<Language | undefined>(undefined)
  const [isSavingLanguagePair, setIsSavingLanguagePair] = React.useState(false)

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
      <div>
        <h1 className="text-2xl font-bold">{t("nav.settings")}</h1>
      </div>

      <div className="space-y-4">
        {/* Language Pair Section */}
        {languageFromTemp && languageToTemp && (
          <div className="rounded-lg border p-4">
            <h2 className="mb-4 font-semibold">{t("languagePair.title")}</h2>
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

        {/* Vibration Section */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <label className="text-sm font-medium cursor-pointer">{t("study.vibrateLabel")}</label>
          <Switch
            checked={vibrateOn}
            onCheckedChange={(checked) => {
              void updateProfile({ vibrate_on_correct: checked })
            }}
          />
        </div>
      </div>
    </div>
  )
}
