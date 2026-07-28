import * as React from "react"
import { useTranslation } from "react-i18next"
import { useDailyGoal } from "@/hooks/useDailyGoal"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"

const PRESETS = [10, 20, 30, 50]

/** Asks for a daily word goal (once — sets the level size for the whole
 *  study path) and lets it be changed later from settings.
 *  Pass no `onOpenChange` for the mandatory first-time ask: with `open`
 *  driven by "no goal set yet", it can only close itself once a value is
 *  saved — there is nothing to cancel back to, so no X/escape/outside-click
 *  dismiss either (see Modal). */
export function DailyGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { wordsPerDay, setWordsPerDay } = useDailyGoal()
  const [value, setValue] = React.useState(wordsPerDay ?? 20)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) setValue(wordsPerDay ?? 20)
  }, [open, wordsPerDay])

  const save = async () => {
    setSaving(true)
    await setWordsPerDay(value)
    setSaving(false)
    onOpenChange?.(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("dailyGoal.title")}
      description={t("dailyGoal.desc")}
      footer={
        <Button className="w-full" disabled={saving} onClick={() => void save()}>
          {saving ? t("dailyGoal.saving") : t("dailyGoal.save")}
        </Button>
      }
    >
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium transition-colors",
              value === n
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:border-foreground/40"
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="daily-goal-custom" className="shrink-0 text-xs text-muted-foreground">
          {t("dailyGoal.customLabel")}
        </Label>
        <Input
          id="daily-goal-custom"
          type="number"
          min={5}
          max={300}
          value={value}
          onChange={(e) => setValue(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
        />
      </div>
    </Modal>
  )
}
