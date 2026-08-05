import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useCards } from "@/hooks/useCards"
import { useDashboardSection } from "@/hooks/useDashboardSection"
import { createDeck, deleteDeck } from "@/lib/deckOperations"
import { UploadDialog } from "@/components/UploadDialog"
import { Flashcard } from "@/components/Flashcard"
import { LevelPicker } from "@/components/LevelPicker"
import { QuizSession } from "@/components/QuizSession"
import { WordTable } from "@/components/WordTable"
import { Fireworks } from "@/components/Fireworks"
import { StudyProgressBar, useProgressFlash } from "@/components/StudyProgressBar"
import { ExitStudyDialog } from "@/components/ExitStudyDialog"
import { useStudyVibrate } from "@/hooks/useStudyVibrate"
import { useStudyStreak } from "@/hooks/useStudyStreak"
import { useDailyGoal } from "@/hooks/useDailyGoal"
import { formatCount } from "@/lib/formatCount"
import { isLevelCleared, effectiveMarkStatus } from "@/lib/cardStatus"
import { useLastDeck } from "@/hooks/useLastDeck"
import { cardTranslation, cardDescription, deckName as deckDisplayName } from "@/lib/cardTranslation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { CardWithMarks, Deck, MarkStatus } from "@/types/db"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CalendarCheck, Vibrate, VibrateOff } from "lucide-react"

type View =
  | { kind: "deck-list" }
  | { kind: "mode-pick"; deck: Deck; cards: CardWithMarks[] }
  | { kind: "review-mode-pick" }
  | { kind: "level-pick"; mode: "cards" | "quiz"; cards: CardWithMarks[]; label: string }
  | { kind: "study"; mode: "cards" | "quiz"; cards: CardWithMarks[]; label: string }
  | { kind: "done"; mode: "cards" | "quiz"; good: CardWithMarks[]; bad: CardWithMarks[]; label: string }

export default function StudentDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { decks, section, cards, loading: allLoading, setOwnMark, setGoalDialogOpen } =
    useDashboardSection()
  const { streak, bump: bumpStreak } = useStudyStreak()
  const { wordsPerDay } = useDailyGoal()
  const [view, setView] = React.useState<View>({ kind: "deck-list" })
  /** Flashcards or quiz, picked once above the level path instead of in a
   *  separate mode-pick screen between the path and the session. */
  const [studyMode, setStudyMode] = React.useState<"cards" | "quiz">("cards")
  const [activeDeckId, setActiveDeckId] = React.useState<string | null>(null)
  const [tableDeckId, setTableDeckId] = React.useState<string>("all")
  const [tableSearch, setTableSearch] = React.useState("")

  const tableCards = React.useMemo(
    () => (tableDeckId === "all" ? cards : cards.filter((c) => c.deck_id === tableDeckId)),
    [cards, tableDeckId]
  )

  const filteredTableCards = React.useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return tableCards
    return tableCards.filter((c) => {
      const translation = cardTranslation(c, i18n.language).toLowerCase()
      const description = cardDescription(c, i18n.language).toLowerCase()
      return (
        c.word_de.toLowerCase().includes(q) ||
        translation.includes(q) ||
        description.includes(q)
      )
    })
  }, [tableCards, tableSearch, i18n.language])

  /** Cards grouped by deck, so each deck row can read its own slice out of
   *  the one already-loaded set instead of fetching for itself. */
  const cardsByDeck = React.useMemo(() => {
    const map = new Map<string, CardWithMarks[]>()
    for (const c of cards) {
      const list = map.get(c.deck_id)
      if (list) list.push(c)
      else map.set(c.deck_id, [c])
    }
    return map
  }, [cards])

  const { addCards } = useCards(activeDeckId)

  /** The deck whose course the level path shows. Remembered per account,
   *  falling back to the first deck when the remembered one is gone. */
  const deckIds = React.useMemo(() => decks.map((d) => d.id), [decks])
  const { selectedDeckId, selectDeck } = useLastDeck(user?.id ?? null, deckIds)
  const pathCards = React.useMemo(
    () => (selectedDeckId ? (cardsByDeck.get(selectedDeckId) ?? []) : []),
    [cardsByDeck, selectedDeckId]
  )
  const pathMastered = React.useMemo(
    () => pathCards.filter((c) => effectiveMarkStatus(c) === "known"),
    [pathCards]
  )
  const pathLabel = React.useMemo(() => {
    const deck = decks.find((d) => d.id === selectedDeckId)
    return deck ? deckDisplayName(deck, i18n.language) : t("dashboard.title")
  }, [decks, selectedDeckId, i18n.language, t])

  // Clicking Review/Mastered/Word table/decks in the sidebar only updates
  // `section` (it lives above this component, in DashboardSectionProvider).
  // Without this, picking e.g. "Word table" while mid-way through browsing
  // a deck (mode-pick/level-pick/study/...) left the dashboard stuck on
  // that deep view, since nothing here ever reset it back to the
  // section-driven "deck-list" view — the sidebar tab would highlight but
  // the content never showed. Snap back whenever the section changes
  // (adjusting state during render, per React's guidance, instead of an
  // effect — avoids an extra render and the cascading-setState lint rule).
  const [prevSection, setPrevSection] = React.useState(section)
  if (section !== prevSection) {
    setPrevSection(section)
    setView({ kind: "deck-list" })
  }

  if (!user) return null

  const handleCreateDeckUpload = async (
    rows: any,
    deckName?: string,
    onProgress?: (done: number, total: number) => void,
    deckNameEn?: string
  ) => {
    const { deck, error } = await createDeck(deckName || t("dashboard.defaultDeckName"), user.id, deckNameEn)
    if (error || !deck) {
      const msg = error || t("dashboard.createDeckError")
      toast.error(msg)
      return { error: msg }
    }
    const { error: addErr } = await addCardsToDeck(deck.id, rows, onProgress)
    if (addErr) toast.error(addErr)
    return { error: addErr }
  }

  const addCardsToDeck = async (
    deckId: string,
    rows: any,
    onProgress?: (done: number, total: number) => void
  ) => {
    setActiveDeckId(deckId)
    return await addCards(rows, user.id, deckId, onProgress)
  }

  /** Cards/Quiz was picked for some set of cards — go straight to the
   *  leveled path, no extra topic-picking step in between. */
  const goToStudySetup = (mode: "cards" | "quiz", cardsToStudy: CardWithMarks[], label: string) => {
    setView({ kind: "level-pick", mode, cards: cardsToStudy, label })
  }

  // ── DECK LIST (the dashboard's default/home section) ──
  if (view.kind === "deck-list") {
    // Nothing uploaded yet at all — skip the counters entirely (they'd all
    // read "0" and just make the page feel broken) and show one clear next
    // step instead. Only replaces the default "decks" section; Review/
    // Mastered/Table (reached via the sidebar) still show their own
    // section-specific empty messages.
    if (!allLoading && decks.length === 0 && section === "decks") {
      return (
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
          </div>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
            <div className="text-4xl">📚</div>
            <div className="space-y-1">
              <h2 className="text-base font-medium">{t("dashboard.emptyStateTitle")}</h2>
              <p className="max-w-xs text-sm text-muted-foreground">{t("dashboard.emptyStateDesc")}</p>
            </div>
            <UploadDialog askDeckName onUpload={handleCreateDeckUpload} />
          </div>
        </div>
      )
    }

    const sectionTitle =
      section === "table" ? t("dashboard.wordTableHeading") : t("dashboard.title")

    const levelSize = wordsPerDay ?? 20

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{sectionTitle}</h1>
          <UploadDialog askDeckName onUpload={handleCreateDeckUpload} />
        </div>

        {/* One screen, one path. Review and Mastered used to be separate
            routes whose entire content was a pair of buttons, and the level
            path — the actual shape of the course — was buried two clicks
            deep behind them. It leads now: cleared levels stay open for
            re-runs (they cost nothing to replay, since a flame counts a word
            that is currently known, not a session), unfinished ones are
            where new and half-learned words live, and the decks that hold
            them sit underneath as management. */}
        {section === "decks" && (
          <div className="space-y-8">
            {allLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.reviewEmptyNoCards")}</p>
            ) : (
              <div className="space-y-4">
                {/* The path is one deck's course, not the whole library:
                    spanning every deck turned 4600 words into 231 levels in
                    a single scroll, with no way to tell where one book ended
                    and the next began. The choice is remembered, so coming
                    back lands on what you were actually studying. */}
                {decks.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {decks.map((d) => (
                      <DeckFilterButton
                        key={d.id}
                        active={d.id === selectedDeckId}
                        onClick={() => selectDeck(d.id)}
                        label={deckDisplayName(d, i18n.language)}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("dashboard.studyModeLabel")}</span>
                  {(["cards", "quiz"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setStudyMode(m)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        studyMode === m
                          ? "border-foreground bg-foreground text-background"
                          : "text-muted-foreground hover:border-foreground/40"
                      )}
                    >
                      {m === "cards" ? t("dashboard.modeCardsTitle") : t("dashboard.modeQuizTitle")}
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("dashboard.masteredOf", {
                      known: formatCount(pathMastered.length),
                      total: formatCount(pathCards.length),
                    })}
                  </span>
                </div>

                {pathCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboard.emptyDeckHint")}</p>
                ) : (
                <LevelPicker
                  /* Remount on deck change: LevelPicker measures the current
                     row to place the warrior sprite, and reusing the instance
                     left it parked on the previous deck's offset. */
                  key={selectedDeckId ?? "none"}
                  items={pathCards}
                  levelSize={levelSize}
                  isLevelComplete={isLevelCleared}
                  renderSizeControl={() => (
                    <span className="text-xs text-muted-foreground">
                      {t("dailyGoal.perLevel", { n: levelSize })} ·{" "}
                      <button
                        type="button"
                        onClick={() => setGoalDialogOpen(true)}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {t("dailyGoal.change")}
                      </button>
                    </span>
                  )}
                  onSelectLevel={(lvl, i) =>
                    setView({
                      kind: "study",
                      mode: studyMode,
                      cards: lvl,
                      label: t("levelPicker.levelLabel", { n: i + 1 }),
                    })
                  }
                  onSelectAll={() =>
                    setView({ kind: "study", mode: studyMode, cards: pathCards, label: pathLabel })
                  }
                />
                )}
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-medium">{t("dashboard.decksHeading")}</h2>
              <div className="space-y-2">
                {decks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboard.noDecks")}</p>
                ) : (
                  decks.map((d) => (
                    <DeckRow
                      key={d.id}
                      name={deckDisplayName(d, i18n.language)}
                      cards={cardsByDeck.get(d.id) ?? []}
                      loading={allLoading}
                      onOpen={async (cards) => setView({ kind: "mode-pick", deck: d, cards })}
                      onDelete={() => deleteDeck(d.id)}
                      onAddCards={(rows, onProgress) => addCardsToDeck(d.id, rows, onProgress)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {section === "table" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={t("wordTable.searchPlaceholder")}
                className="sm:max-w-xs"
              />
              {decks.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  <DeckFilterButton
                    active={tableDeckId === "all"}
                    onClick={() => setTableDeckId("all")}
                    label={t("dashboard.allDecks")}
                  />
                  {decks.map((d) => (
                    <DeckFilterButton
                      key={d.id}
                      active={tableDeckId === d.id}
                      onClick={() => setTableDeckId(d.id)}
                      label={deckDisplayName(d, i18n.language)}
                    />
                  ))}
                </div>
              )}
            </div>
            {allLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : filteredTableCards.length === 0 && tableSearch.trim() ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("wordTable.noResults")}</p>
            ) : (
              <WordTable cards={filteredTableCards} onMark={setOwnMark} markBasis="own" />
            )}
          </div>
        )}
      </div>
    )
  }

  // ── MODE PICK (cards vs quiz) for a specific deck ──
  if (view.kind === "mode-pick") {
    const deckLabel = deckDisplayName(view.deck, i18n.language)
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView({ kind: "deck-list" })}>
          {t("dashboard.backToDecks")}
        </Button>
        <h1 className="text-lg font-semibold">{deckLabel}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.cardsLoaded", { count: formatCount(view.cards.length) })}</p>
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            icon="🃏"
            title={t("dashboard.modeCardsTitle")}
            desc={t("dashboard.modeCardsDesc")}
            onClick={() => goToStudySetup("cards", view.cards, deckLabel)}
          />
          <ModeCard
            icon="✏️"
            title={t("dashboard.modeQuizTitle")}
            desc={t("dashboard.modeQuizDesc")}
            onClick={() => goToStudySetup("quiz", view.cards, deckLabel)}
          />
        </div>
      </div>
    )
  }

  // ── LEVEL PICK ──
  if (view.kind === "level-pick") {
    const levelSize = wordsPerDay ?? 20
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView({ kind: "deck-list" })}>
          {t("common.back")}
        </Button>
        <h1 className="text-lg font-semibold">
          {view.label} — {view.mode === "cards" ? t("dashboard.modeCardsTitle") : t("dashboard.modeQuizTitle")}
        </h1>
        <LevelPicker
          items={view.cards}
          levelSize={levelSize}
          isLevelComplete={isLevelCleared}
          renderSizeControl={() => (
            <span className="text-xs text-muted-foreground">
              {t("dailyGoal.perLevel", { n: levelSize })} ·{" "}
              <button
                type="button"
                onClick={() => setGoalDialogOpen(true)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t("dailyGoal.change")}
              </button>
            </span>
          )}
          onSelectLevel={(lvl, i) =>
            setView({
              kind: "study",
              mode: view.mode,
              cards: lvl,
              label: `${view.label} · ${t("levelPicker.levelLabel", { n: i + 1 })}`,
            })
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
        onMark={(cardId, status) => {
          void setOwnMark(cardId, status)
        }}
        onFinish={(good, bad) => {
          void bumpStreak()
          setView({ kind: "done", mode: "cards", good, bad, label: view.label })
        }}
      />
    )
  }

  // ── STUDY (quiz) ──
  if (view.kind === "study" && view.mode === "quiz") {
    return (
      <QuizSession
        cards={view.cards}
        onExit={() => setView({ kind: "deck-list" })}
        onMark={(cardId, status) => {
          void setOwnMark(cardId, status)
        }}
        onFinish={({ correct, wrong }) => {
          void bumpStreak()
          setView({ kind: "done", mode: "quiz", good: correct, bad: wrong, label: view.label })
        }}
      />
    )
  }

  // ── DONE ──
  if (view.kind === "done") {
    const total = view.good.length
    const hadMistakes = view.bad.length
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center py-8">
        <Fireworks />
        <div className="text-4xl">🏆</div>
        <h1 className="text-xl font-semibold">{t("dashboard.allKnown")}</h1>
        <p className="text-sm text-muted-foreground">
          {hadMistakes > 0
            ? t("study.doneWithMistakes", { label: view.label, mistakes: hadMistakes, total })
            : t("study.donePerfect", { label: view.label, total })}
        </p>
        <div className="flex justify-center gap-3">
          <StatPill label={t("stats.know")} value={view.good.length} tone="success" />
          {hadMistakes > 0 && (
            <StatPill label={t("stats.learning")} value={hadMistakes} tone="destructive" />
          )}
        </div>
        {/* Emerald + calendar, matching the sidebar badge — the flame is the
            shop balance's icon and only its icon. */}
        {streak > 0 && (
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <CalendarCheck className="h-4 w-4" aria-hidden />
            <span>{t("study.streakDays", { count: streak })}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("study.streakNudge")}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => setView({ kind: "deck-list" })}>
            {t("dashboard.backToDecks")}
          </Button>
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

/** `cards` comes from the dashboard's already-loaded set (all decks at
 *  once, in DashboardSectionProvider) rather than a per-row fetch. Each
 *  row used to call useCards(deckId) itself, which meant N extra requests
 *  and — because a row renders as "empty" until its own request lands —
 *  buttons visibly flipping from the empty state to the real one, one row
 *  at a time. */
function DeckRow({
  name,
  cards,
  loading,
  onOpen,
  onDelete,
  onAddCards,
}: {
  name: string
  cards: CardWithMarks[]
  loading: boolean
  onOpen: (cards: CardWithMarks[]) => void
  onDelete: () => void
  onAddCards: (
    rows: any,
    onProgress?: (done: number, total: number) => void
  ) => Promise<{ error: string | null }>
}) {
  const { t } = useTranslation()
  const isEmpty = !loading && cards.length === 0
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <button className="flex-1 text-left" onClick={() => onOpen(cards)} disabled={loading || isEmpty}>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {loading ? (
            <Skeleton className="h-3 w-20" />
          ) : isEmpty ? (
            t("dashboard.emptyDeckHint")
          ) : (
            t("common.wordsCount", { count: formatCount(cards.length) })
          )}
        </div>
      </button>
      <div className="flex items-center gap-1">
        <UploadDialog
          onUpload={async (rows, _deckName, onProgress) => {
            return await onAddCards(rows, onProgress)
          }}
          trigger={
            <Button size="sm" variant={isEmpty ? "default" : "ghost"}>
              {isEmpty ? t("dashboard.addFirstWords") : t("dashboard.addWords")}
            </Button>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              {t("common.delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dashboard.deleteDeckTitle", { name })}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dashboard.deleteDeckDesc", { count: formatCount(cards.length) })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("common.delete")}
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
  label: _label,
  onExit,
  onMark,
  onFinish,
}: {
  cards: CardWithMarks[]
  label: string
  onExit: () => void
  onMark?: (cardId: string, status: MarkStatus) => void
  onFinish: (good: CardWithMarks[], bad: CardWithMarks[]) => void
}) {
  const { t } = useTranslation()
  const initialTotal = cards.length
  const [queue, setQueue] = React.useState(() => [...cards].sort(() => Math.random() - 0.5))
  const [known, setKnown] = React.useState<CardWithMarks[]>([])
  const [missedIds, setMissedIds] = React.useState<Set<string>>(() => new Set())
  const [flipped, setFlipped] = React.useState(false)
  const [exitOpen, setExitOpen] = React.useState(false)
  const [finishing, setFinishing] = React.useState(false)
  const { flash, trigger: triggerFlash } = useProgressFlash()
  const { enabled: vibrateOn, setEnabled: setVibrateOn, buzzIfEnabled } = useStudyVibrate()

  const card = queue[0]
  const progressPct = initialTotal > 0 ? Math.round((known.length / initialTotal) * 100) : 0
  const learningCount = queue.filter((c) => missedIds.has(c.id)).length
  const dirty = known.length > 0 || missedIds.size > 0 || flipped

  React.useEffect(() => {
    if (finishing || queue.length > 0 || known.length === 0) return
    setFinishing(true)
    for (const c of known) onMark?.(c.id, "known")
    const hadMistakes = known.filter((c) => missedIds.has(c.id))
    onFinish(known, hadMistakes)
  }, [queue.length, known, missedIds, onFinish, onMark, finishing])

  if (!card || finishing) return null

  const answer = (know: boolean) => {
    if (know) {
      triggerFlash("success")
      buzzIfEnabled()
      setKnown((k) => [...k, card])
      setQueue((q) => q.slice(1))
    } else {
      triggerFlash("destructive")
      setMissedIds((prev) => new Set(prev).add(card.id))
      setQueue((q) => [...q.slice(1), card])
    }
    setFlipped(false)
  }

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
        <StatPill label={t("stats.know")} value={known.length} tone="success" />
        <div className="rounded-lg bg-muted/50 p-2.5 text-center">
          <div className="text-lg font-medium">{queue.length}</div>
          <div className="text-[10px] text-muted-foreground">{t("stats.remaining")}</div>
        </div>
        <StatPill label={t("stats.learning")} value={learningCount} tone="destructive" />
      </div>

      <Flashcard card={card} flipped={flipped} onToggle={() => setFlipped((f) => !f)} />

      <p className="text-center text-xs text-muted-foreground">
        {flipped ? t("dashboard.flipBack") : t("dashboard.flipForward")}
      </p>

      <div className="flex gap-2.5">
        <Button
          variant="outline"
          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => answer(false)}
        >
          {t("dashboard.stillLearning")}
        </Button>
        <Button
          variant="outline"
          className="flex-1 border-success/40 text-success hover:bg-success/10"
          onClick={() => answer(true)}
        >
          {t("dashboard.know")}
        </Button>
      </div>

      <ExitStudyDialog open={exitOpen} onOpenChange={setExitOpen} onConfirm={onExit} />
    </div>
  )
}
