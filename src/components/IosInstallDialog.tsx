import { useTranslation } from "react-i18next"
import { Share, SquarePlus } from "lucide-react"
import { Modal } from "@/components/ui/modal"

/** iOS has no programmatic install prompt — this is the manual
 *  Share-sheet path Safari requires instead, shown from the sidebar's
 *  install link. */
export function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("pwa.iosTitle")}>
      <ol className="space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
            <Share className="h-4 w-4" />
          </span>
          {t("pwa.iosStep1")}
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
            <SquarePlus className="h-4 w-4" />
          </span>
          {t("pwa.iosStep2")}
        </li>
      </ol>
    </Modal>
  )
}
