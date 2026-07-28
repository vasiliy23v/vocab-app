import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { splitIntoLevels } from "@/lib/levels"
import { formatCount } from "@/lib/formatCount"
import { Check, Lock } from "lucide-react"

interface LevelPickerProps<T> {
  items: T[]
  levelSize: number
  /** Renders the default 20/25/30 size chips. Omit together with
   *  `renderSizeControl` when the level size is fixed elsewhere (the
   *  student's daily-goal setting) rather than chosen ad hoc per session. */
  onLevelSizeChange?: (n: number) => void
  onSelectLevel: (levelItems: T[], levelIndex: number) => void
  onSelectAll: () => void
  selectedLevel?: number
  /** A level is cleared once every card in it counts as "known" — drives
   *  the lock/checkmark path below. Without it every level is open
   *  (used for review/mastered, where gating a fixed order makes no sense,
   *  and for the teacher's read-only view of a student's levels). */
  isLevelComplete?: (levelItems: T[]) => boolean
  /** optional: render a small badge/info per level, e.g. % known */
  renderLevelExtra?: (levelItems: T[], levelIndex: number) => React.ReactNode
  /** Replaces the default 20/25/30 chip row entirely — e.g. the student's
   *  fixed daily-goal summary with a "change" link into settings. */
  renderSizeControl?: () => React.ReactNode
}

export function LevelPicker<T>({
  items,
  levelSize,
  onLevelSizeChange,
  onSelectLevel,
  onSelectAll,
  selectedLevel,
  isLevelComplete,
  renderLevelExtra,
  renderSizeControl,
}: LevelPickerProps<T>) {
  const { t } = useTranslation()
  const levels = React.useMemo(() => splitIntoLevels(items, levelSize), [items, levelSize])

  const cleared = React.useMemo(
    () => levels.map((lvl) => isLevelComplete?.(lvl) ?? false),
    [levels, isLevelComplete]
  )
  const unlocked = React.useMemo(
    () => levels.map((_, i) => !isLevelComplete || i === 0 || cleared[i - 1]),
    [levels, cleared, isLevelComplete]
  )
  const currentIndex = unlocked.findIndex((u, i) => u && !cleared[i])
  const currentRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [currentIndex])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {renderSizeControl ? (
          renderSizeControl()
        ) : (
          <>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("levelPicker.wordsPerLevel")}</span>
            {[20, 25, 30].map((n) => (
              <button
                key={n}
                onClick={() => onLevelSizeChange?.(n)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  levelSize === n
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground hover:border-foreground/40"
                )}
              >
                {n}
              </button>
            ))}
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {t("levelPicker.levelsCount", { count: levels.length })} ·{" "}
          {t("common.wordsCount", { count: formatCount(items.length) })}
        </span>
      </div>

      <div className="relative space-y-2">
        {levels.length > 1 && (
          <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border" aria-hidden />
        )}
        {levels.map((lvl, i) => {
          const start = i * levelSize + 1
          const end = Math.min((i + 1) * levelSize, items.length)
          const isCleared = cleared[i]
          const isUnlocked = unlocked[i]
          const isCurrent = i === currentIndex
          return (
            <button
              key={i}
              ref={isCurrent ? currentRef : undefined}
              onClick={() => isUnlocked && onSelectLevel(lvl, i)}
              disabled={!isUnlocked}
              title={!isUnlocked ? t("levelPicker.locked", { n: i }) : undefined}
              className={cn(
                "relative z-10 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                isUnlocked
                  ? "hover:border-foreground/40 hover:bg-muted/40"
                  : "cursor-not-allowed opacity-50",
                selectedLevel === i && "border-foreground bg-muted/40",
                isCurrent && "border-primary/50 bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  isCleared && "border-success bg-success text-success-foreground",
                  !isCleared && isUnlocked && "border-foreground bg-foreground text-background",
                  !isUnlocked && "border-border bg-muted text-muted-foreground"
                )}
              >
                {isCleared ? <Check className="h-5 w-5" /> : !isUnlocked ? <Lock className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t("levelPicker.levelLabel", { n: i + 1 })}</div>
                <div className="text-xs text-muted-foreground">
                  {start}–{end} · {t("common.wordsCount", { count: formatCount(lvl.length) })}
                </div>
                {renderLevelExtra?.(lvl, i)}
              </span>
              {isCleared && (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-success">
                  {t("levelPicker.cleared")}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Button variant="outline" className="w-full" onClick={onSelectAll}>
        {t("levelPicker.studyAll")}
      </Button>
    </div>
  )
}
