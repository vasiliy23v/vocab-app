import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useDailyGoal } from "@/hooks/useDailyGoal"
import { useDashboardSection } from "@/hooks/useDashboardSection"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import { LanguagePairSelector } from "@/components/LanguagePairSelector"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { IosInstallDialog } from "@/components/IosInstallDialog"
import type { Language } from "@/types/db"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Download, Heart } from "lucide-react"

const Confetti = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      life: number
      color: string
    }> = []

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 5 + 3,
        life: 1,
        color: ["#ff6b6b", "#ffd93d", "#6bcf7f", "#4d96ff", "#ff69b4"][Math.floor(Math.random() * 5)],
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.2
        p.life -= 0.01

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 8, 8)
      }

      if (particles.length > 0) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { profile, updateProfile } = useAuth()
  const { wordsPerDay } = useDailyGoal()
  const { setGoalDialogOpen } = useDashboardSection()
  const { canInstall, isIos, promptInstall } = usePwaInstall()
  const [languageFromTemp, setLanguageFromTemp] = React.useState<Language | undefined>(undefined)
  const [languageToTemp, setLanguageToTemp] = React.useState<Language | undefined>(undefined)
  const [isSavingLanguagePair, setIsSavingLanguagePair] = React.useState(false)
  const [iosDialogOpen, setIosDialogOpen] = React.useState(false)
  const [showCelebration, setShowCelebration] = React.useState(false)

  React.useEffect(() => {
    if (i18n.language === "uk") {
      const timer = setTimeout(() => {
        setShowCelebration(true)
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 100])
        }
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [i18n.language])

  React.useEffect(() => {
    if (profile && !languageFromTemp) {
      setLanguageFromTemp((profile.language_from || "en") as Language)
      setLanguageToTemp((profile.language_to || "de") as Language)
    }
  }, [profile, languageFromTemp])

  const handleSaveLanguagePair = async () => {
    if (!languageFromTemp || !languageToTemp || languageFromTemp === languageToTemp) return
    setIsSavingLanguagePair(true)
    await updateProfile({
      language_from: languageFromTemp,
      language_to: languageToTemp,
    })
    setIsSavingLanguagePair(false)
  }

  const vibrateOn = profile?.vibrate_on_correct ?? true

  return (
    <div className="max-w-2xl space-y-6">
      {/* UI Language Section */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">{t("language.label")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
        </div>
        <LanguageSwitcher />
      </div>

      <Separator />

      {/* Learning Language Pair Section */}
      {languageFromTemp && languageToTemp && (
        <>
          <div className="space-y-3">
            <h3 className="font-semibold">{t("languagePair.title")}</h3>
            <LanguagePairSelector
              from={languageFromTemp}
              to={languageToTemp}
              onFromChange={setLanguageFromTemp}
              onToChange={setLanguageToTemp}
              onSave={handleSaveLanguagePair}
              isSaving={isSavingLanguagePair}
            />
          </div>
          <Separator />
        </>
      )}

      {showCelebration && i18n.language === "uk" && (
        <>
          <Confetti />
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-white rounded-2xl p-12 text-center shadow-2xl">
              <div className="text-8xl mb-4 animate-bounce">🐱❤️</div>
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-2">
                Дякуємо!
              </div>
              <div className="text-lg text-gray-600">
                Ви обрали українську мову! 🇺🇦
              </div>
              <div className="mt-6 flex justify-center gap-2 text-4xl animate-pulse">
                💙 💛
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCelebration(false)}
            className="fixed inset-0 z-40"
            aria-label="Close celebration"
          />
        </>
      )}

      {/* Daily Goal Section */}
      <button
        type="button"
        onClick={() => setGoalDialogOpen(true)}
        className="w-full text-left transition-colors hover:opacity-70"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{t("dailyGoal.sidebarLabel")}</div>
            <p className="text-sm text-muted-foreground">{t("dailyGoal.desc")}</p>
          </div>
          <div className="text-right text-sm font-semibold">
            {wordsPerDay !== null ? t("dailyGoal.perLevel", { n: wordsPerDay }) : t("dailyGoal.change")}
          </div>
        </div>
      </button>

      <Separator />

      {/* Vibration Section */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{t("study.vibrateLabel")}</div>
        </div>
        <Switch
          checked={vibrateOn}
          onCheckedChange={(checked) => {
            void updateProfile({ vibrate_on_correct: checked })
          }}
        />
      </div>

      {(canInstall || isIos) && (
        <>
          <Separator />
          {/* Install App Section */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-semibold">{t("pwa.settingsTitle")}</div>
                <p className="text-sm text-muted-foreground">{t("pwa.settingsDesc")}</p>
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (isIos) {
                  setIosDialogOpen(true)
                } else {
                  void promptInstall()
                }
              }}
            >
              {t("pwa.installLink")}
            </Button>
            {isIos && <IosInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />}
          </div>
        </>
      )}
    </div>
  )
}
