import * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { cardTranslation, cardDescription } from "@/lib/cardTranslation"
import type { CardWithMarks, MarkStatus } from "@/types/db"
import { toast } from "sonner"

export function StatusBadge({ status }: { status: MarkStatus | null }) {
  const { t } = useTranslation()
  if (status === "known") return <Badge variant="success">{t("status.known")}</Badge>
  if (status === "unknown") return <Badge variant="destructive">{t("status.unknown")}</Badge>
  if (status === "repeat") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
        {t("status.repeat")}
      </Badge>
    )
  }
  return <Badge variant="outline">{t("status.none")}</Badge>
}

export function WordTable({
  cards,
  onMark,
  markBasis = "teacher",
}: {
  cards: CardWithMarks[]
  onMark?: (cardId: string, status: MarkStatus) => Promise<{ error: string | null }>
  /** Which status the mark buttons read/write: the teacher's assessment
   *  (default, used when a teacher reviews a student's words) or the
   *  student's own self-assessment (used in the student's own word table). */
  markBasis?: "teacher" | "own"
}) {
  const { t } = useTranslation()

  if (cards.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("wordTable.noWords")}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{t("wordTable.colGerman")}</th>
            <th className="px-4 py-2.5 font-medium">{t("wordTable.colTranslation")}</th>
            <th className="px-4 py-2.5 font-medium min-w-[12rem]">{t("wordTable.colDescription")}</th>
            <th className="px-4 py-2.5 font-medium">
              {markBasis === "own" ? t("wordTable.colYourStatus") : t("wordTable.colTeacherStatus")}
            </th>
            {onMark && <th className="px-4 py-2.5 font-medium">{t("wordTable.colMark")}</th>}
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <WordRow key={c.id} card={c} onMark={onMark} markBasis={markBasis} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WordRow({
  card,
  onMark,
  markBasis,
}: {
  card: CardWithMarks
  onMark?: (cardId: string, status: MarkStatus) => Promise<{ error: string | null }>
  markBasis: "teacher" | "own"
}) {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = React.useState(false)

  const status = markBasis === "own" ? card.own_status : card.teacher_status

  const mark = async (status: MarkStatus) => {
    if (!onMark) return
    setBusy(true)
    const { error } = await onMark(card.id, status)
    setBusy(false)
    if (error) toast.error(error)
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-4 py-2.5 font-medium">{card.word_de}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{cardTranslation(card, i18n.language)}</td>
      <td className="px-4 py-2.5 text-muted-foreground max-w-xs whitespace-pre-wrap">
        {card.description?.trim() ? cardDescription(card, i18n.language) : t("wordTable.empty")}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={status} />
      </td>
      {onMark && (
        <td className="px-4 py-2.5">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={status === "known" ? "success" : "outline"}
              disabled={busy}
              onClick={() => mark("known")}
              className="h-7 px-2.5 text-xs"
            >
              {t("wordTable.markKnown")}
            </Button>
            <Button
              size="sm"
              variant={status === "unknown" ? "destructive" : "outline"}
              disabled={busy}
              onClick={() => mark("unknown")}
              className="h-7 px-2.5 text-xs"
            >
              {t("wordTable.markUnknown")}
            </Button>
            <Button
              size="sm"
              variant={status === "repeat" ? "secondary" : "outline"}
              disabled={busy}
              onClick={() => mark("repeat")}
              className={cn(
                "h-7 px-2.5 text-xs",
                status === "repeat" && "bg-amber-100 text-amber-800 hover:bg-amber-100"
              )}
            >
              {t("wordTable.markRepeat")}
            </Button>
          </div>
        </td>
      )}
    </tr>
  )
}
