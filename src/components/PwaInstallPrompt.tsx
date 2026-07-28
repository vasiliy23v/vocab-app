import * as React from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { usePwaInstall } from "@/hooks/usePwaInstall"

const SHOWN_KEY = "pwa-install-toast-shown"

/** Mounted once (App.tsx). The very first time the browser can offer
 *  installing the app, nudges once with a toast — never again after
 *  that, even across reloads. From then on the sidebar's install link
 *  (see AppLayout) is the durable way back to it.
 *  iOS has no `beforeinstallprompt` at all, so that toast just states the
 *  manual Share-sheet steps instead of an "Install" button with nothing
 *  to trigger. */
export function PwaInstallPrompt() {
  const { t } = useTranslation()
  const { canInstall, isIos, promptInstall } = usePwaInstall()
  const shown = React.useRef(false)

  React.useEffect(() => {
    if ((!canInstall && !isIos) || shown.current) return
    if (localStorage.getItem(SHOWN_KEY)) return
    shown.current = true
    localStorage.setItem(SHOWN_KEY, "1")

    const icon = <Download className="h-4 w-4 pwa-install-icon" aria-hidden />

    if (isIos) {
      toast(t("pwa.installAvailableIos"), { icon, duration: 8000 })
      return
    }

    toast(t("pwa.installAvailable"), {
      icon,
      duration: 8000,
      action: {
        label: t("pwa.installAction"),
        onClick: () => void promptInstall(),
      },
    })
  }, [canInstall, isIos, t, promptInstall])

  return null
}
