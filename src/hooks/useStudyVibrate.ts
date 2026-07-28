import * as React from "react"
import { useAuth } from "@/hooks/useAuth"

/** Victory buzz when the profile preference is on (and the browser allows it). */
export function vibrateWin(enabled: boolean) {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) return
  try {
    navigator.vibrate([18, 40, 28])
  } catch {
    // ignore — some browsers throw when vibration is blocked
  }
}

/** Profile-backed vibrate preference + toggle that persists immediately. */
export function useStudyVibrate() {
  const { profile, updateProfile } = useAuth()
  const enabled = profile?.vibrate_on_correct ?? true

  const setEnabled = React.useCallback(
    async (next: boolean) => {
      // Optimistic local feel: updateProfile writes DB and refreshes profile state.
      await updateProfile({ vibrate_on_correct: next })
      if (next) vibrateWin(true)
    },
    [updateProfile]
  )

  const buzzIfEnabled = React.useCallback(() => {
    vibrateWin(enabled)
  }, [enabled])

  return { enabled, setEnabled, buzzIfEnabled }
}
