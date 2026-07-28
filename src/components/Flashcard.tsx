import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { getCardFront, getCardBack, getCardExample, cardGroupName, cardDescription } from "@/lib/cardTranslation"
import type { CardWithMarks } from "@/types/db"

interface FlashcardProps {
  card: CardWithMarks
  flipped: boolean
  onToggle: () => void
}

export function Flashcard({ card, flipped, onToggle }: FlashcardProps) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()

  const languageFrom = profile?.language_from || "en"
  const languageTo = profile?.language_to || "de"
  const frontText = getCardFront(card, languageFrom)
  const backText = getCardBack(card, languageTo)

  return (
    <div className="h-64 cursor-pointer select-none" style={{ perspective: 1200 }} onClick={onToggle}>
      <div className={cn("flip-card-inner", flipped && "flipped")}>
        {/* Front: translation in learning language from */}
        <div className="flip-card-face flex flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
          <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("flashcard.frontLabel")}
          </div>
          {card.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap justify-center gap-1.5">
              {card.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="text-2xl font-medium">{frontText}</div>
        </div>

        {/* Back: word in learning language to + description + examples */}
        <div className="flip-card-face flip-card-back flex flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
          <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">{t("flashcard.backLabel")}</div>
          <div className="mb-2 text-xl font-medium">{backText}</div>
          {card.group && (
            <div className="mb-1.5 text-[11px] text-muted-foreground">{cardGroupName(card, i18n.language)}</div>
          )}
          {card.description && (
            <div className="mb-2 text-xs italic text-muted-foreground">{cardDescription(card, i18n.language)}</div>
          )}
          {getCardExample(card, languageTo) && (
            <div className="text-xs italic text-muted-foreground/90">{getCardExample(card, languageTo)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
