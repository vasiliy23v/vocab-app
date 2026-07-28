import * as React from "react"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY } from "@/i18n"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface UILanguageOnboardingDialogProps {
  open: boolean
  onComplete: () => void
}

export function UILanguageOnboardingDialog({ open, onComplete }: UILanguageOnboardingDialogProps) {
  const { t, i18n } = useTranslation()

  const getLanguageName = (code: string) => {
    switch (code) {
      case "ru":
        return "Русский"
      case "en":
        return "English"
      case "de":
        return "Deutsch"
      default:
        return code
    }
  }

  const handleSelectLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    }
    onComplete()
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("language.label")}</AlertDialogTitle>
          <AlertDialogDescription>{t("settings.languageDesc")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-3 gap-3">
          {(SUPPORTED_LANGUAGES as readonly string[]).map((lang) => (
            <Button
              key={lang}
              variant={i18n.language === lang ? "default" : "outline"}
              onClick={() => handleSelectLanguage(lang)}
              className="h-auto flex-col py-4"
            >
              {getLanguageName(lang)}
            </Button>
          ))}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
