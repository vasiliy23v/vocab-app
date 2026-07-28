import * as React from "react"
import { useTranslation } from "react-i18next"
import type { Language } from "@/types/db"
import { SUPPORTED_LANGUAGES } from "@/i18n"
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
  const { t } = useTranslation()
  const [from, setFrom] = React.useState<Language>("en")
  const [to, setTo] = React.useState<Language>("de")
  const [isSaving, setIsSaving] = React.useState(false)

  const getLanguageName = (code: Language) => {
    switch (code) {
      case "ru":
        return t("language.ru")
      case "en":
        return t("language.en")
      case "de":
        return t("language.de")
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

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-2 text-sm font-medium text-foreground">{t("languagePair.from")}</div>
              <Select value={from} onValueChange={(value) => setFrom(value as Language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.filter((lang) => lang !== to).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {getLanguageName(lang as Language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6 text-sm text-muted-foreground">→</div>

            <div className="flex-1">
              <div className="mb-2 text-sm font-medium text-foreground">{t("languagePair.to")}</div>
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
            </div>
          </div>
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
