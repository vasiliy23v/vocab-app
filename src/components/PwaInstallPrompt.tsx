import * as React from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { usePwaInstall } from "@/hooks/usePwaInstall"

const SHOWN_KEY = "pwa-install-toast-shown"

/** Mounted once (App.tsx). The very first time the browser says the app
 *  can be installed, nudges once with a toast — never again after that,
 *  even across reloads. From then on the sidebar's install link (see
 *  AppLayout) is the durable way back to it. */
export function PwaInstallPrompt() {
  const { t } = useTranslation()
  const { canInstall, promptInstall } = usePwaInstall()
  const shown = React.useRef(false)

  React.useEffect(() => {
    if (!canInstall || shown.current) return
    if (localStorage.getItem(SHOWN_KEY)) return
    shown.current = true
    localStorage.setItem(SHOWN_KEY, "1")

    toast(t("pwa.installAvailable"), {
      icon: <Download className="h-4 w-4 pwa-install-icon" aria-hidden />,
      duration: 8000,
      action: {
        label: t("pwa.installAction"),
        onClick: () => void promptInstall(),
      },
    })
  }, [canInstall, t, promptInstall])

  return null
}
