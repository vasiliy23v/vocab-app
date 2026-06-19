import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { buildQuizQuestion, checkTypedAnswer, mainWord } from "@/lib/quizEngine"
import type { CardWithMarks } from "@/types/db"

interface QuizSessionProps {
  cards: CardWithMarks[]
  onFinish: (result: { correct: CardWithMarks[]; wrong: CardWithMarks[] }) => void
  onExit: () => void
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function QuizSession({ cards, onFinish, onExit }: QuizSessionProps) {
  const [deck] = React.useState(() => shuffle(cards))
  const [cur, setCur] = React.useState(0)
  const [correct, setCorrect] = React.useState<CardWithMarks[]>([])
  const [wrong, setWrong] = React.useState<CardWithMarks[]>([])
  const [answered, setAnswered] = React.useState(false)
  const [chosenLabel, setChosenLabel] = React.useState<string | null>(null)
  const [typedValue, setTypedValue] = React.useState("")
  const [lastResult, setLastResult] = React.useState<boolean | null>(null)

  const question = React.useMemo(() => buildQuizQuestion(deck[cur], deck, cur), [deck, cur])
  const total = deck.length

  React.useEffect(() => {
    if (cur >= total) {
      onFinish({ correct, wrong })
    }
  }, [cur, total, correct, wrong, onFinish])

  if (cur >= total) return null

  const registerAnswer = (ok: boolean) => {
    setLastResult(ok)
    if (ok) setCorrect((c) => [...c, question.card])
    else setWrong((w) => [...w, question.card])
  }

  const pickOption = (label: string, isCorrect: boolean) => {
    if (answered) return
    setAnswered(true)
    setChosenLabel(label)
    registerAnswer(isCorrect)
  }

  const submitTyped = () => {
    if (answered || !typedValue.trim()) return
    const ok = checkTypedAnswer(typedValue, question.card)
    setAnswered(true)
    registerAnswer(ok)
  }

  const next = () => {
    setAnswered(false)
    setChosenLabel(null)
    setTypedValue("")
    setLastResult(null)
    setCur((c) => c + 1)
  }

  const typeLabel =
    question.type === "multi" ? "Выбери перевод" : question.type === "spelling" ? "Найди правильное написание" : "Напиши по-немецки"

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          ← Назад
        </Button>
        <Progress value={Math.round((cur / total) * 100)} className="flex-1" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {cur + 1} / {total}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Верно" value={correct.length} tone="success" />
        <StatBox label="Осталось" value={total - cur} />
        <StatBox label="Ошибок" value={wrong.length} tone="destructive" />
      </div>

      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border p-7 text-center">
        <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">{typeLabel}</div>
        <div className="text-xl font-medium">{question.card.translation_ru}</div>
        {question.type === "spelling" && (
          <div className="mt-2 text-xs text-muted-foreground">Одно из слов написано правильно — какое?</div>
        )}
        {question.type === "typein" && (
          <div className="mt-2 text-xs text-muted-foreground">Введи немецкое слово или фразу</div>
        )}
      </div>

      {(question.type === "multi" || question.type === "spelling") && question.options && (
        <div className="grid grid-cols-2 gap-2">
          {question.options.map((opt) => {
            const isChosen = chosenLabel === opt.label
            const showCorrect = answered && opt.isCorrect
            const showWrong = answered && isChosen && !opt.isCorrect
            return (
              <button
                key={opt.label}
                disabled={answered}
                onClick={() => pickOption(opt.label, opt.isCorrect)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  !answered && "hover:border-foreground/40 hover:bg-muted/40",
                  showCorrect && "border-success bg-success/10 text-success",
                  showWrong && "border-destructive bg-destructive/10 text-destructive"
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {question.type === "typein" && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitTyped()}
            disabled={answered}
            placeholder="Немецкое слово…"
            className={cn(
              answered && lastResult && "border-success bg-success/10",
              answered && lastResult === false && "border-destructive bg-destructive/10"
            )}
          />
          <Button onClick={submitTyped} disabled={answered}>
            Проверить
          </Button>
        </div>
      )}

      {answered && (
        <div className={cn("text-center text-sm", lastResult ? "text-success" : "text-destructive")}>
          {lastResult ? "Верно!" : `Правильно: ${mainWord(question.card.word_de)}`}
        </div>
      )}

      {answered && (
        <Button className="w-full" onClick={next}>
          Далее →
        </Button>
      )}
    </div>
  )
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <div
        className={cn(
          "text-lg font-medium",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive"
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
