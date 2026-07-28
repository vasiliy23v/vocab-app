import * as React from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useRegisterSW } from "virtual:pwa-register/react"

/** How often to ask the browser to re-check for a new service worker
 *  while the tab stays open — visiting/reloading the page always checks
 *  too, this just covers long-lived sessions in between. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

/** Mounted once (App.tsx). Registers the service worker, polls for a
 *  newer one on an interval, and lets the student apply it on their own
 *  terms instead of the app silently swapping under them mid-lesson. */
export function PwaUpdatePrompt() {
  const { t } = useTranslation()
  const toastShown = React.useRef(false)

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      window.setInterval(() => {
        void registration.update()
      }, UPDATE_CHECK_INTERVAL_MS)
    },
    onRegisterError(error) {
      console.error("SW registration failed", error)
    },
  })

  const [needsRefresh] = needRefresh

  React.useEffect(() => {
    if (!needsRefresh || toastShown.current) return
    toastShown.current = true
    toast(t("pwa.updateAvailable"), {
      duration: Infinity,
      action: {
        label: t("pwa.updateAction"),
        onClick: () => void updateServiceWorker(true),
      },
    })
  }, [needsRefresh, t, updateServiceWorker])

  return null
}
