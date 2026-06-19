import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { splitIntoLevels } from "@/lib/levels"

interface LevelPickerProps<T> {
  items: T[]
  levelSize: number
  onLevelSizeChange: (n: number) => void
  onSelectLevel: (levelItems: T[], levelIndex: number) => void
  onSelectAll: () => void
  selectedLevel?: number
  /** optional: render a small badge/info per level, e.g. % known */
  renderLevelExtra?: (levelItems: T[], levelIndex: number) => React.ReactNode
}

export function LevelPicker<T>({
  items,
  levelSize,
  onLevelSizeChange,
  onSelectLevel,
  onSelectAll,
  selectedLevel,
  renderLevelExtra,
}: LevelPickerProps<T>) {
  const levels = React.useMemo(() => splitIntoLevels(items, levelSize), [items, levelSize])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Слов в уровне:</span>
        {[20, 25, 30].map((n) => (
          <button
            key={n}
            onClick={() => onLevelSizeChange(n)}
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
        <span className="ml-auto text-xs text-muted-foreground">
          {levels.length} уровн{levels.length === 1 ? "ь" : levels.length < 5 ? "я" : "ей"} · {items.length} слов
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        {levels.map((lvl, i) => {
          const start = i * levelSize + 1
          const end = Math.min((i + 1) * levelSize, items.length)
          return (
            <button
              key={i}
              onClick={() => onSelectLevel(lvl, i)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40",
                selectedLevel === i && "border-foreground bg-muted/40"
              )}
            >
              <div className="text-[10px] text-muted-foreground">Уровень {i + 1}</div>
              <div className="text-sm font-medium">
                {start}–{end}
              </div>
              <div className="text-xs text-muted-foreground">{lvl.length} слов</div>
              {renderLevelExtra?.(lvl, i)}
            </button>
          )
        })}
      </div>

      <Button variant="outline" className="w-full" onClick={onSelectAll}>
        Учить всё сразу
      </Button>
    </div>
  )
}
