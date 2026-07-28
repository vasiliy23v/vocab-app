import * as React from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag — there's no beforeinstallprompt there at all,
    // but this still lets us hide the install UI once added to home screen.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

/** iPhone/iPad Safari (and any browser wrapping it, since iOS forces
 *  WebKit) never fires beforeinstallprompt — there is no programmatic
 *  install API at all. iPadOS 13+ reports as a desktop Mac UA, so we also
 *  check for a Mac with touch support. */
function detectIos(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

/** Wraps the browser's native "Add to Home Screen" prompt. `canInstall` is
 *  only ever true on browsers that support `beforeinstallprompt` (Chrome/
 *  Edge/Android) and haven't already installed the app. `isIos` flags the
 *  one major platform with no such API at all — Safari requires the
 *  student to do it manually via the Share sheet, so UI for that platform
 *  needs to show instructions instead of calling `promptInstall`. */
export function usePwaInstall() {
  const deferredPrompt = React.useRef<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = React.useState(false)
  const [installed, setInstalled] = React.useState(isStandalone)
  const [isIos] = React.useState(detectIos)

  React.useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onAppInstalled = () => {
      deferredPrompt.current = null
      setCanInstall(false)
      setInstalled(true)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
    }
  }, [])

  const promptInstall = React.useCallback(async () => {
    const prompt = deferredPrompt.current
    if (!prompt) return { outcome: null as "accepted" | "dismissed" | null }
    await prompt.prompt()
    const choice = await prompt.userChoice
    deferredPrompt.current = null
    setCanInstall(false)
    return choice
  }, [])

  return {
    canInstall: canInstall && !installed,
    installed,
    isIos: isIos && !installed,
    promptInstall,
  }
}
