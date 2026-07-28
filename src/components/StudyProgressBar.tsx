import * as React from "react"
import { cn } from "@/lib/utils"

export type ProgressFlash = "success" | "destructive" | null

/** Progress bar that briefly flashes green/red when the student answers. */
export function StudyProgressBar({
  value,
  flash,
  className,
}: {
  value: number
  flash: ProgressFlash
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn(
        "relative h-2.5 flex-1 overflow-hidden rounded-full bg-secondary",
        flash === "success" && "study-progress-track-success",
        flash === "destructive" && "study-progress-track-fail",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          flash === "success" && "bg-success study-progress-fill-success",
          flash === "destructive" && "bg-destructive study-progress-fill-fail",
          !flash && "bg-primary"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

/** Short-lived flash state helper for study sessions. */
export function useProgressFlash(ms = 520) {
  const [flash, setFlash] = React.useState<ProgressFlash>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = React.useCallback(
    (tone: Exclude<ProgressFlash, null>) => {
      if (timer.current) clearTimeout(timer.current)
      setFlash(tone)
      timer.current = setTimeout(() => setFlash(null), ms)
    },
    [ms]
  )

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return { flash, trigger }
}
