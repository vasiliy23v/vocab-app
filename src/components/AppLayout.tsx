import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useIsSuperadmin } from "@/hooks/useAdmin"
import { useDashboardSection } from "@/hooks/useDashboardSection"
import { useStudyStreak } from "@/hooks/useStudyStreak"
import { useDailyGoal } from "@/hooks/useDailyGoal"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import { DailyGoalDialog } from "@/components/DailyGoalDialog"
import { formatCount } from "@/lib/formatCount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { BookOpen, Users, ShieldCheck, LogOut, Menu, Settings, Flame, RotateCcw, CheckCircle2, Table2, ShoppingBag } from "lucide-react"

function initials(name: string | null | undefined, email: string | undefined) {
  const base = name || email || "?"
  return base.slice(0, 2).toUpperCase()
}

function StreakBadge({ streak }: { streak: number }) {
  const { t } = useTranslation()
  return (
    <span
      title={t("study.streakDays", { count: streak })}
      className="flex shrink-0 items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
    >
      <span aria-hidden>🔥</span>
      {streak}
    </span>
  )
}

/** Every sidebar entry — including "My flashcards"'s own Review/Mastered/
 *  Word table sections — is a real route (/, /review, /mastered, /table)
 *  and a plain <Link>, so they're all one flat, identically styled list
 *  with normal active-route highlighting. Review/Mastered/Word table used
 *  to be local dashboard state rendered as nested indented buttons; now
 *  they're routes like everything else below them, just like Teachers/
 *  Leaderboard/Settings/Admin, and get the same real-link behavior
 *  (bookmarkable URL, browser back/forward). */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const location = useLocation()
  const isSuperadmin = useIsSuperadmin()
  const { newCards, reviewQueue, masteredCards, loading } = useDashboardSection()
  const toLearnCount = newCards.length + reviewQueue.length

  const items: {
    to: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    count?: string
    tone?: "destructive" | "success"
  }[] = [
    { to: "/", label: t("dashboard.title"), icon: BookOpen },
    {
      to: "/review",
      label: t("dashboard.review"),
      icon: RotateCcw,
      count: !loading && toLearnCount > 0 ? formatCount(toLearnCount) : undefined,
      tone: "destructive",
    },
    {
      to: "/mastered",
      label: t("dashboard.mastered"),
      icon: CheckCircle2,
      count: !loading && masteredCards.length > 0 ? formatCount(masteredCards.length) : undefined,
      tone: "success",
    },
    { to: "/table", label: t("dashboard.wordTableHeading"), icon: Table2 },
    { to: "/shop", label: t("shop.title"), icon: ShoppingBag },
    { to: "/people", label: t("nav.people"), icon: Users },
    { to: "/leaderboard", label: t("leaderboard.title"), icon: Flame },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
    ...(isSuperadmin ? [{ to: "/admin", label: t("nav.admin"), icon: ShieldCheck }] : []),
  ]

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = location.pathname === item.to
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-orange-50 text-orange-700 font-medium dark:bg-orange-950/40 dark:text-orange-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
            {item.count && (
              <Badge variant={item.tone === "destructive" ? "destructive" : "success"} className="shrink-0 px-1.5 text-[10px]">
                {item.count}
              </Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

/** Phone-style bottom tab bar for the four dashboard sections. Mobile
 *  only — on desktop the sidebar already shows these. The active tab's
 *  icon lifts and its pill background scales in; tapping gives a brief
 *  press-in scale, so switching feels like a native tab bar. */
function BottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const { newCards, reviewQueue, masteredCards, loading } = useDashboardSection()
  const toLearnCount = newCards.length + reviewQueue.length

  const items: {
    to: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    count?: string
    tone?: "destructive" | "success"
  }[] = [
    { to: "/", label: t("dashboard.tabDecks"), icon: BookOpen },
    {
      to: "/review",
      label: t("dashboard.tabReview"),
      icon: RotateCcw,
      count: !loading && toLearnCount > 0 ? formatCount(toLearnCount) : undefined,
      tone: "destructive",
    },
    {
      to: "/mastered",
      label: t("dashboard.tabMastered"),
      icon: CheckCircle2,
      count: !loading && masteredCards.length > 0 ? formatCount(masteredCards.length) : undefined,
      tone: "success",
    },
    { to: "/table", label: t("dashboard.tabTable"), icon: Table2 },
    { to: "/shop", label: t("shop.tabShop"), icon: ShoppingBag },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = location.pathname === item.to
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] transition-colors active:scale-95 motion-safe:transition-transform",
                active ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
              )}
            >
              <span className="relative flex h-7 w-12 items-center justify-center">
                {/* Pill highlight: scales in behind the active tab's icon. */}
                <span
                  className={cn(
                    "absolute inset-0 rounded-full bg-orange-100 transition-transform duration-200 ease-out dark:bg-orange-950/50",
                    active ? "scale-100" : "scale-0"
                  )}
                />
                <Icon
                  className={cn(
                    "relative h-[18px] w-[18px] transition-transform duration-200 ease-out",
                    active && "motion-safe:-translate-y-px"
                  )}
                />
                {item.count && (
                  <Badge
                    variant={item.tone === "destructive" ? "destructive" : "success"}
                    className="absolute -right-1.5 -top-1 px-1 py-0 text-[9px] leading-4"
                  >
                    {item.count}
                  </Badge>
                )}
              </span>
              <span className={cn("truncate", active && "font-medium")}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, user, signOut, updateProfile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const isSuperadmin = useIsSuperadmin()
  const { streak } = useStudyStreak()
  const { wordsPerDay } = useDailyGoal()
  const { goalDialogOpen, setGoalDialogOpen } = useDashboardSection()
  // Only show daily goal dialog if user explicitly opened it from settings
  const goalDialogVisible = goalDialogOpen

  const handleSignOut = async () => {
    await signOut()
    navigate("/auth", { replace: true })
  }

  // Nav + account footer, shared between the desktop sidebar and the
  // mobile drawer. The header row above it is NOT shared: the drawer
  // (SheetContent) already renders its own close (✕) button in the same
  // top-right corner, so putting the streak badge there crowded the two
  // together. The desktop sidebar has no such button, so it keeps the
  // badge inline; the drawer doesn't, and the mobile top bar shows it
  // instead — that bar is always visible, unlike the drawer.
  const sidebarNav = (
    <>
      <NavLinks onNavigate={() => setMobileOpen(false)} />

      <div className="mt-auto space-y-3 pt-4">
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">{initials(profile?.display_name, user?.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium">{profile?.display_name || t("common.noName")}</span>
              {isSuperadmin && (
                <Badge variant="success" className="shrink-0 px-1 text-[9px]">
                  {t("admin.roleSuperadmin")}
                </Badge>
              )}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{user?.email}</div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop: persistent sidebar */}
      <aside className="hidden shrink-0 border-r p-4 md:flex md:w-60 md:flex-col">
        <div className="flex h-full flex-col">
          <div className="mb-5 flex items-center justify-between gap-2 px-1">
            <Link to="/" className="block font-semibold text-sm tracking-tight">
              {t("appName")}
            </Link>
            {streak > 0 && <StreakBadge streak={streak} />}
          </div>
          {sidebarNav}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: top bar with a drawer for the same nav. The streak badge
            lives here instead of in the drawer (see sidebarNav comment). */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <div className="flex h-full flex-col">
                <Link to="/" className="mb-5 block px-1 font-semibold text-sm tracking-tight">
                  {t("appName")}
                </Link>
                {sidebarNav}
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-sm">{t("appName")}</span>
          {streak > 0 ? <StreakBadge streak={streak} /> : <div className="w-9" />}
        </header>

        {/* pb-20 keeps content clear of the fixed bottom nav on mobile. */}
        <main className="container flex-1 pb-20 pt-6 md:px-8 md:pb-6">{children}</main>
      </div>

      <BottomNav />

      <DailyGoalDialog
        open={goalDialogVisible}
        onOpenChange={setGoalDialogOpen}
      />
    </div>
  )
}
