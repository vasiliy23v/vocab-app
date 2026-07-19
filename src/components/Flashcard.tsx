import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { cardTranslation, cardGroupName, cardExample, cardDescription } from "@/lib/cardTranslation"
import type { CardWithMarks } from "@/types/db"

interface FlashcardProps {
  card: CardWithMarks
  flipped: boolean
  onToggle: () => void
}

export function Flashcard({ card, flipped, onToggle }: FlashcardProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="h-64 cursor-pointer select-none" style={{ perspective: 1200 }} onClick={onToggle}>
      <div className={cn("flip-card-inner", flipped && "flipped")}>
        {/* Front: translation */}
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
          <div className="text-2xl font-medium">{cardTranslation(card, i18n.language)}</div>
        </div>

        {/* Back: German + description + examples */}
        <div className="flip-card-face flip-card-back flex flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
          <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">{t("flashcard.backLabel")}</div>
          <div className="mb-2 text-xl font-medium">{card.word_de}</div>
          {card.group && (
            <div className="mb-1.5 text-[11px] text-muted-foreground">{cardGroupName(card, i18n.language)}</div>
          )}
          {card.description && (
            <div className="mb-2 text-xs italic text-muted-foreground">{cardDescription(card, i18n.language)}</div>
          )}
          {card.example_de && <div className="text-xs italic text-muted-foreground/90">{card.example_de}</div>}
          {(card.example_ru || card.example_en) && (
            <div className="mt-0.5 text-[11px] text-muted-foreground/70">{cardExample(card, i18n.language)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
