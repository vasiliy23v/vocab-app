import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { SUPPORTED_LANGUAGES } from "@/i18n"

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()

  return (
    <div
      className={cn("flex items-center gap-1 rounded-full border bg-background p-0.5 shadow-sm", className)}
      role="group"
      aria-label={t("language.label")}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => i18n.changeLanguage(lng)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium uppercase transition-colors",
            i18n.language.startsWith(lng)
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={i18n.language.startsWith(lng)}
        >
          {lng}
        </button>
      ))}
    </div>
  )
}
