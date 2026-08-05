import * as React from "react"
import { useTranslation } from "react-i18next"
import type { Language } from "@/types/db"
import { SUPPORTED_LANGUAGES } from "@/i18n"
import { languageName } from "@/lib/languageLabel"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface LanguageOnboardingDialogProps {
  open: boolean
  onComplete: (from: Language, to: Language) => Promise<void>
}

export function LanguageOnboardingDialog({ open, onComplete }: LanguageOnboardingDialogProps) {
  const { t, i18n } = useTranslation()
  // Source language is not asked for — it follows the interface language.
  const from = (i18n.language?.split("-")[0] || "en") as Language
  const [to, setTo] = React.useState<Language>(from === "de" ? "en" : "de")
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (to === from) {
      const next = SUPPORTED_LANGUAGES.find((lang) => lang !== from)
      if (next) setTo(next as Language)
    }
  }, [from, to])

  const getLanguageName = (code: Language) => {
    switch (code) {
      case "ru":
        return t("language.ru")
      case "en":
        return t("language.en")
      case "de":
        return t("language.de")
      case "uk":
        return t("language.uk")
      default:
        return code
    }
  }

  const handleSave = async () => {
    if (from === to) return
    setIsSaving(true)
    try {
      await onComplete(from, to)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("languagePair.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("languagePair.subtitle")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Select value={to} onValueChange={(value) => setTo(value as Language)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.filter((lang) => lang !== from).map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {getLanguageName(lang as Language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("languagePair.fromInterface", { language: languageName(t, from) })}
          </p>
        </div>

        <AlertDialogFooter>
          <Button
            onClick={handleSave}
            disabled={isSaving || from === to}
            className="w-full"
          >
            {isSaving ? t("languagePair.saving") : t("common.save")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
