import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useDecks, useCards, useAllStudentCards } from "@/hooks/useCards"
import { UploadDialog } from "@/components/UploadDialog"
import { Flashcard } from "@/components/Flashcard"
import { LevelPicker } from "@/components/LevelPicker"
import { QuizSession } from "@/components/QuizSession"
import { WordTable } from "@/components/WordTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { CardWithMarks, MarkStatus } from "@/types/db"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type View =
  | { kind: "deck-list" }
  | { kind: "mode-pick"; deckId: string; deckName: string; cards: CardWithMarks[] }
  | { kind: "review-mode-pick" }
  | { kind: "level-pick"; mode: "cards" | "quiz"; cards: CardWithMarks[]; label: string }
  | { kind: "study"; mode: "cards" | "quiz"; cards: CardWithMarks[]; label: string }
  | { kind: "done"; mode: "cards" | "quiz"; good: CardWithMarks[]; bad: CardWithMarks[]; label: string }

export default function StudentDashboard() {
  const { user } = useAuth()
  const { decks, createDeck, deleteDeck } = useDecks(user?.id ?? null)
  const { cards, reviewQueue, masteredCards, loading: allLoading } = useAllStudentCards(user?.id ?? null)
  const [view, setView] = React.useState<View>({ kind: "deck-list" })
  const [levelSize, setLevelSize] = React.useState(20)
  const [activeDeckId, setActiveDeckId] = React.useState<string | null>(null)
  const [tableDeckId, setTableDeckId] = React.useState<string>("all")

  const tableCards = React.useMemo(
    () => (tableDeckId === "all" ? cards : cards.filter((c) => c.deck_id === tableDeckId)),
    [cards, tableDeckId]
  )

  const { cards: deckCards, addCards } = useCards(activeDeckId)

  if (!user) return null

  const handleCreateDeckUpload = async (rows: any, deckName?: string) => {
    const { deck, error } = await createDeck(deckName || "Новый набор", user.id)
    if (error || !deck) {
      toast.error(error || "Не удалось создать набор")
      return
    }
    const { error: addErr } = await addCardsToDeck(deck.id, rows)
    if (addErr) toast.error(addErr)
  }

  const addCardsToDeck = async (deckId: string, rows: any) => {
    setActiveDeckId(deckId)
    return await addCards(rows, user.id, deckId)
  }

  // ── DECK LIST ──
  if (view.kind === "deck-list") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Мои карточки</h1>
          <UploadDialog askDeckName onUpload={handleCreateDeckUpload} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Повторение
              {!allLoading && (
                <Badge variant={reviewQueue.length > 0 ? "destructive" : "success"}>
                  {reviewQueue.length} слов
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Слова, которые учитель отметил «не знает» / «повторить», а также слова без пометки учителя.
            </p>
            <div className="flex gap-2">
              <Button
                disabled={reviewQueue.length === 0}
                onClick={() => setView({ kind: "level-pick", mode: "cards", cards: reviewQueue, label: "Повторение" })}
              >
                Карточки ({reviewQueue.length})
              </Button>
              <Button
                variant="outline"
                disabled={reviewQueue.length === 0}
                onClick={() => setView({ kind: "level-pick", mode: "quiz", cards: reviewQueue, label: "Повторение" })}
              >
                Тест
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Выучено
              {!allLoading && <Badge variant="success">{masteredCards.length} слов</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Слова, отмеченные учителем как «знает».</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={masteredCards.length === 0}
                onClick={() => setView({ kind: "level-pick", mode: "cards", cards: masteredCards, label: "Выучено" })}
              >
                Карточки ({masteredCards.length})
              </Button>
              <Button
                variant="outline"
                disabled={masteredCards.length === 0}
                onClick={() => setView({ kind: "level-pick", mode: "quiz", cards: masteredCards, label: "Выучено" })}
              >
                Тест
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              Таблица слов
              {!allLoading && (
                <span className="text-sm font-normal text-muted-foreground">{tableCards.length} слов</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decks.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                <DeckFilterButton
                  active={tableDeckId === "all"}
                  onClick={() => setTableDeckId("all")}
                  label="Все наборы"
                />
                {decks.map((d) => (
                  <DeckFilterButton
                    key={d.id}
                    active={tableDeckId === d.id}
                    onClick={() => setTableDeckId(d.id)}
                    label={d.name}
                  />
                ))}
              </div>
            )}
            {allLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : (
              <WordTable cards={tableCards} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Наборы карточек</h2>
          {decks.length === 0 && (
            <p className="text-sm text-muted-foreground">Пока нет наборов — загрузите первый!</p>
          )}
          {decks.map((d) => (
            <DeckRow
              key={d.id}
              deckId={d.id}
              name={d.name}
              onOpen={async (cards) =>
                setView({ kind: "mode-pick", deckId: d.id, deckName: d.name, cards })
              }
              onDelete={() => deleteDeck(d.id)}
              onAddCards={(rows) => addCardsToDeck(d.id, rows)}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── MODE PICK (cards vs quiz) for a specific deck ──
  if (view.kind === "mode-pick") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView({ kind: "deck-list" })}>
          ← Наборы
        </Button>
        <h1 className="text-lg font-semibold">{view.deckName}</h1>
        <p className="text-sm text-muted-foreground">{view.cards.length} карточек загружено</p>
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            icon="🃏"
            title="Карточки"
            desc="Смотри русский, вспоминай немецкий"
            onClick={() => setView({ kind: "level-pick", mode: "cards", cards: view.cards, label: view.deckName })}
          />
          <ModeCard
            icon="✏️"
            title="Тест"
            desc="Выбор, ввод и анаграммы"
            onClick={() => setView({ kind: "level-pick", mode: "quiz", cards: view.cards, label: view.deckName })}
          />
        </div>
      </div>
    )
  }

  // ── LEVEL PICK ──
  if (view.kind === "level-pick") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView({ kind: "deck-list" })}>
          ← Назад
        </Button>
        <h1 className="text-lg font-semibold">
          {view.label} — {view.mode === "cards" ? "Карточки" : "Тест"}
        </h1>
        <LevelPicker
          items={view.cards}
          levelSize={levelSize}
          onLevelSizeChange={setLevelSize}
          onSelectLevel={(lvl, i) =>
            setView({ kind: "study", mode: view.mode, cards: lvl, label: `${view.label} · Уровень ${i + 1}` })
          }
          onSelectAll={() => setView({ kind: "study", mode: view.mode, cards: view.cards, label: view.label })}
        />
      </div>
    )
  }

  // ── STUDY (flashcards) ──
  if (view.kind === "study" && view.mode === "cards") {
    return (
      <FlashcardStudy
        cards={view.cards}
        label={view.label}
        onExit={() => setView({ kind: "deck-list" })}
        onFinish={(good, bad) => setView({ kind: "done", mode: "cards", good, bad, label: view.label })}
      />
    )
  }

  // ── STUDY (quiz) ──
  if (view.kind === "study" && view.mode === "quiz") {
    return (
      <QuizSession
        cards={view.cards}
        onExit={() => setView({ kind: "deck-list" })}
        onFinish={({ correct, wrong }) =>
          setView({ kind: "done", mode: "quiz", good: correct, bad: wrong, label: view.label })
        }
      />
    )
  }

  // ── DONE ──
  if (view.kind === "done") {
    const total = view.good.length + view.bad.length
    const pct = total > 0 ? Math.round((view.good.length / total) * 100) : 0
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center py-8">
        <div className="text-4xl">🏆</div>
        <h1 className="text-xl font-semibold">{pct === 100 ? "Все карточки знаешь!" : "Раунд завершён!"}</h1>
        <p className="text-sm text-muted-foreground">
          {view.label} · {pct}% {view.mode === "cards" ? "" : "верно"}
        </p>
        <div className="flex justify-center gap-3">
          <StatPill label={view.mode === "cards" ? "Знаю" : "Верно"} value={view.good.length} tone="success" />
          <StatPill label={view.mode === "cards" ? "Учу" : "Ошибок"} value={view.bad.length} tone="destructive" />
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => setView({ kind: "deck-list" })}>
            ← Наборы
          </Button>
          {view.bad.length > 0 && (
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => setView({ kind: "study", mode: view.mode, cards: view.bad, label: "Повтор ошибок" })}
            >
              Повторить ошибки
            </Button>
          )}
        </div>
      </div>
    )
  }

  return null
}

function DeckFilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs",
        active ? "bg-foreground text-background border-foreground" : "text-muted-foreground"
      )}
    >
      {label}
    </button>
  )
}

function ModeCard({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border p-4 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40"
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  )
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "success" | "destructive" }) {
  return (
    <div className="rounded-lg border px-4 py-2">
      <div className={tone === "success" ? "text-2xl font-medium text-success" : "text-2xl font-medium text-destructive"}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function DeckRow({
  deckId,
  name,
  onOpen,
  onDelete,
  onAddCards,
}: {
  deckId: string
  name: string
  onOpen: (cards: CardWithMarks[]) => void
  onDelete: () => void
  onAddCards: (rows: any) => Promise<{ error: string | null }>
}) {
  const { cards } = useCards(deckId)
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <button className="flex-1 text-left" onClick={() => onOpen(cards)}>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{cards.length} слов</div>
      </button>
      <div className="flex items-center gap-1">
        <UploadDialog
          onUpload={async (rows) => {
            await onAddCards(rows)
          }}
          trigger={
            <Button size="sm" variant="ghost">
              + Слова
            </Button>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              Удалить
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить набор «{name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Все {cards.length} карточек и пометки учителя будут удалены без возможности восстановления.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function FlashcardStudy({
  cards,
  label,
  onExit,
  onFinish,
}: {
  cards: CardWithMarks[]
  label: string
  onExit: () => void
  onFinish: (good: CardWithMarks[], bad: CardWithMarks[]) => void
}) {
  const [deck] = React.useState(() => [...cards].sort(() => Math.random() - 0.5))
  const [cur, setCur] = React.useState(0)
  const [flipped, setFlipped] = React.useState(false)
  const [good, setGood] = React.useState<CardWithMarks[]>([])
  const [bad, setBad] = React.useState<CardWithMarks[]>([])

  const total = deck.length

  React.useEffect(() => {
    if (cur >= total) onFinish(good, bad)
  }, [cur, total]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cur >= total) return null

  const card = deck[cur]

  const answer = (know: boolean) => {
    if (know) setGood((g) => [...g, card])
    else setBad((b) => [...b, card])
    setFlipped(false)
    setCur((c) => c + 1)
  }

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
        <StatPill label="Знаю" value={good.length} tone="success" />
        <div className="rounded-lg bg-muted/50 p-2.5 text-center">
          <div className="text-lg font-medium">{total - cur}</div>
          <div className="text-[10px] text-muted-foreground">Осталось</div>
        </div>
        <StatPill label="Учу" value={bad.length} tone="destructive" />
      </div>

      <Flashcard card={card} flipped={flipped} onToggle={() => setFlipped((f) => !f)} />

      <p className="text-center text-xs text-muted-foreground">
        {flipped ? "Нажмите ещё раз чтобы вернуть" : "Нажмите на карточку чтобы увидеть немецкий"}
      </p>

      {flipped && (
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => answer(false)}
          >
            ↺ Ещё учу
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-success/40 text-success hover:bg-success/10"
            onClick={() => answer(true)}
          >
            ✓ Знаю!
          </Button>
        </div>
      )}
    </div>
  )
}
