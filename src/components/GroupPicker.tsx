import * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { formatCount } from "@/lib/formatCount"
import type { CardGroup } from "@/lib/groupCards"

interface GroupPickerProps {
  groups: CardGroup[]
  onSelectGroup: (group: CardGroup) => void
  onSelectAll: () => void
}

export function GroupPicker({ groups, onSelectGroup, onSelectAll }: GroupPickerProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("groupPicker.hint")}</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {groups.map((g) => (
          <button
            key={g.key || "__none__"}
            onClick={() => onSelectGroup(g)}
            className="flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40"
          >
            <span className="text-sm font-medium">{g.name || t("groupPicker.noGroup")}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatCount(g.cards.length)}</span>
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={onSelectAll}>
        {t("groupPicker.studyAll")}
      </Button>
    </div>
  )
}
