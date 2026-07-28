import * as React from "react"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES } from "@/i18n"
import type { Language } from "@/types/db"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface LanguagePairSelectorProps {
  from: Language
  to: Language
  onFromChange: (lang: Language) => void
  onToChange: (lang: Language) => void
  onSave?: () => void | Promise<void>
  isSaving?: boolean
}

export function LanguagePairSelector({
  from,
  to,
  onFromChange,
  onToChange,
  onSave,
  isSaving = false,
}: LanguagePairSelectorProps) {
  const { t } = useTranslation()

  const getLanguageName = (code: Language) => {
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

  return (
    <div className="space-y-3 rounded-lg border px-2.5 py-2">
      <div className="text-xs font-medium text-muted-foreground">
        {t("languagePair.title")}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t("languagePair.subtitle")}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="mb-1 text-xs text-muted-foreground">{t("languagePair.from")}</div>
          <Select value={from} onValueChange={(value) => onFromChange(value as Language)}>
            <SelectTrigger className="h-8 text-xs">
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

        <div className="pt-5 text-xs text-muted-foreground">→</div>

        <div className="flex-1">
          <div className="mb-1 text-xs text-muted-foreground">{t("languagePair.to")}</div>
          <Select value={to} onValueChange={(value) => onToChange(value as Language)}>
            <SelectTrigger className="h-8 text-xs">
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

      {onSave && (
        <Button
          size="sm"
          className="w-full"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? t("languagePair.saving") : t("languagePair.save")}
        </Button>
      )}
    </div>
  )
}
