import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CardWithMarks, MarkStatus } from "@/types/db"
import { toast } from "sonner"

export function StatusBadge({ status }: { status: MarkStatus | null }) {
  if (status === "known") return <Badge variant="success">знает</Badge>
  if (status === "unknown") return <Badge variant="destructive">не знает</Badge>
  if (status === "repeat") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
        повторить
      </Badge>
    )
  }
  return <Badge variant="outline">без отметки</Badge>
}

export function WordTable({
  cards,
  onMark,
}: {
  cards: CardWithMarks[]
  onMark?: (cardId: string, status: MarkStatus) => Promise<{ error: string | null }>
}) {
  if (cards.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Нет слов</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Немецкий</th>
            <th className="px-4 py-2.5 font-medium">Перевод</th>
            <th className="px-4 py-2.5 font-medium min-w-[12rem]">Описание</th>
            <th className="px-4 py-2.5 font-medium">Статус учителя</th>
            {onMark && <th className="px-4 py-2.5 font-medium">Отметить</th>}
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <WordRow key={c.id} card={c} onMark={onMark} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WordRow({
  card,
  onMark,
}: {
  card: CardWithMarks
  onMark?: (cardId: string, status: MarkStatus) => Promise<{ error: string | null }>
}) {
  const [busy, setBusy] = React.useState(false)

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
      <td className="px-4 py-2.5 text-muted-foreground">{card.translation_ru}</td>
      <td className="px-4 py-2.5 text-muted-foreground max-w-xs whitespace-pre-wrap">
        {card.description?.trim() || "—"}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={card.teacher_status} />
      </td>
      {onMark && (
        <td className="px-4 py-2.5">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={card.teacher_status === "known" ? "success" : "outline"}
              disabled={busy}
              onClick={() => mark("known")}
              className="h-7 px-2.5 text-xs"
            >
              Знает
            </Button>
            <Button
              size="sm"
              variant={card.teacher_status === "unknown" ? "destructive" : "outline"}
              disabled={busy}
              onClick={() => mark("unknown")}
              className="h-7 px-2.5 text-xs"
            >
              Не знает
            </Button>
            <Button
              size="sm"
              variant={card.teacher_status === "repeat" ? "secondary" : "outline"}
              disabled={busy}
              onClick={() => mark("repeat")}
              className={cn(
                "h-7 px-2.5 text-xs",
                card.teacher_status === "repeat" && "bg-amber-100 text-amber-800 hover:bg-amber-100"
              )}
            >
              Повторить
            </Button>
          </div>
        </td>
      )}
    </tr>
  )
}
