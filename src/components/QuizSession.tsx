import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { buildQuizQuestion, checkTypedAnswer, mainWord } from "@/lib/quizEngine"
import { cardTranslation, getCardBack } from "@/lib/cardTranslation"
import { StudyProgressBar, useProgressFlash } from "@/components/StudyProgressBar"
import { ExitStudyDialog } from "@/components/ExitStudyDialog"
import { useStudyVibrate } from "@/hooks/useStudyVibrate"
import { Vibrate, VibrateOff } from "lucide-react"
import type { CardWithMarks, MarkStatus } from "@/types/db"

interface QuizSessionProps {
  cards: CardWithMarks[]
  onFinish: (result: { correct: CardWithMarks[]; wrong: CardWithMarks[] }) => void
  onExit: () => void
  /** Persist marks only after the student finishes the whole lesson. */
  onMark?: (cardId: string, status: MarkStatus) => void
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function QuizSession({ cards, onFinish, onExit, onMark }: QuizSessionProps) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const languageTo = profile?.language_to || "de"

  const initialTotal = cards.length
  const [queue, setQueue] = React.useState(() => shuffle(cards))
  const [known, setKnown] = React.useState<CardWithMarks[]>([])
  const [missedIds, setMissedIds] = React.useState<Set<string>>(() => new Set())
  const [answered, setAnswered] = React.useState(false)
  const [chosenLabel, setChosenLabel] = React.useState<string | null>(null)
  const [typedValue, setTypedValue] = React.useState("")
  const [lastResult, setLastResult] = React.useState<boolean | null>(null)
  const [exitOpen, setExitOpen] = React.useState(false)
  const [finishing, setFinishing] = React.useState(false)
  const { flash, trigger: triggerFlash } = useProgressFlash()
  const { enabled: vibrateOn, setEnabled: setVibrateOn, buzzIfEnabled } = useStudyVibrate()

  const current = queue[0]
  const question = React.useMemo(
    () => (current ? buildQuizQuestion(current, [...known, ...queue], 0, languageTo) : null),
    [current, known, queue, languageTo]
  )

  const progressPct = initialTotal > 0 ? Math.round((known.length / initialTotal) * 100) : 0
  const learningCount = queue.filter((c) => missedIds.has(c.id)).length
  const dirty = known.length > 0 || missedIds.size > 0 || answered

  React.useEffect(() => {
    if (finishing || queue.length > 0 || known.length === 0) return
    setFinishing(true)
    for (const c of known) onMark?.(c.id, "known")
    const wrong = known.filter((c) => missedIds.has(c.id))
    onFinish({ correct: known, wrong })
  }, [queue.length, known, missedIds, onFinish, onMark, finishing])

  if (!current || !question || finishing) return null

  const registerAnswer = (ok: boolean) => {
    setLastResult(ok)
    if (ok) {
      triggerFlash("success")
      buzzIfEnabled()
    } else {
      triggerFlash("destructive")
      setMissedIds((prev) => new Set(prev).add(current.id))
    }
  }

  const pickOption = (label: string, isCorrect: boolean) => {
    if (answered) return
    setAnswered(true)
    setChosenLabel(label)
    registerAnswer(isCorrect)
  }

  const submitTyped = () => {
    if (answered || !typedValue.trim()) return
    const ok = checkTypedAnswer(typedValue, question.card, languageTo)
    setAnswered(true)
    registerAnswer(ok)
  }

  const next = () => {
    if (lastResult) {
      setKnown((k) => [...k, current])
      setQueue((q) => q.slice(1))
    } else {
      setQueue((q) => [...q.slice(1), current])
    }
    setAnswered(false)
    setChosenLabel(null)
    setTypedValue("")
    setLastResult(null)
  }

  const typeLabel =
    question.type === "multi"
      ? t("quiz.chooseTranslation")
      : question.type === "spelling"
        ? t("quiz.findSpelling")
        : t("quiz.typeGerman")

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => (dirty ? setExitOpen(true) : onExit())}>
          {t("common.back")}
        </Button>
        <StudyProgressBar value={progressPct} flash={flash} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {known.length} / {initialTotal}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          title={vibrateOn ? t("study.vibrateOn") : t("study.vibrateOff")}
          aria-label={vibrateOn ? t("study.vibrateOn") : t("study.vibrateOff")}
          onClick={() => void setVibrateOn(!vibrateOn)}
        >
          {vibrateOn ? <Vibrate className="h-4 w-4" /> : <VibrateOff className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatBox label={t("stats.correct")} value={known.length} tone="success" />
        <StatBox label={t("stats.remaining")} value={queue.length} />
        <StatBox label={t("stats.errors")} value={learningCount} tone="destructive" />
      </div>

      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border p-7 text-center">
        <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">{typeLabel}</div>
        <div className="text-xl font-medium">{cardTranslation(question.card, i18n.language)}</div>
        {question.type === "spelling" && (
          <div className="mt-2 text-xs text-muted-foreground">{t("quiz.spellingHint")}</div>
        )}
        {question.type === "typein" && (
          <div className="mt-2 text-xs text-muted-foreground">{t("quiz.typeinHint")}</div>
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
            placeholder={t("quiz.typeinPlaceholder")}
            className={cn(
              answered && lastResult && "border-success bg-success/10",
              answered && lastResult === false && "border-destructive bg-destructive/10"
            )}
          />
          <Button onClick={submitTyped} disabled={answered}>
            {t("quiz.check")}
          </Button>
        </div>
      )}

      {answered && (
        <div className={cn("text-center text-sm", lastResult ? "text-success" : "text-destructive")}>
          {lastResult ? t("quiz.correct") : t("quiz.correctAnswerIs", { word: mainWord(getCardBack(question.card, languageTo)) })}
        </div>
      )}

      {answered && (
        <Button className="w-full" onClick={next}>
          {t("quiz.next")}
        </Button>
      )}

      <ExitStudyDialog open={exitOpen} onOpenChange={setExitOpen} onConfirm={onExit} />
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
