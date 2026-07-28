import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useIsSuperadmin } from "@/hooks/useAdmin"
import { useDashboardSection, type DashboardSection } from "@/hooks/useDashboardSection"
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
import { BookOpen, Users, ShieldCheck, LogOut, Menu, Settings } from "lucide-react"

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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const location = useLocation()
  const isSuperadmin = useIsSuperadmin()
  const { setSection } = useDashboardSection()

  const items = [
    { to: "/", label: t("dashboard.title"), icon: BookOpen, onClick: () => setSection("decks") },
    { to: "/people", label: t("nav.people"), icon: Users },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
    ...(isSuperadmin ? [{ to: "/admin", label: t("nav.admin"), icon: ShieldCheck }] : []),
  ]

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = location.pathname === item.to
        const Icon = item.icon
        return (
          <React.Fragment key={item.to}>
            <Link
              to={item.to}
              onClick={() => {
                item.onClick?.()
                onNavigate?.()
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
            {/* Review/Mastered/Word table live under "My flashcards" — always
                visible (not just while already on that page), so the sidebar
                doesn't lose menu items just from navigating elsewhere. */}
            {item.to === "/" && <DashboardSecondaryNav onNavigate={onNavigate} />}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

/** Review / Mastered / Word table — the student dashboard's own
 *  sub-sections, surfaced here instead of a tab bar competing with the
 *  deck list for space in the main content area. Always visible under
 *  "My flashcards" regardless of the current route; picking one jumps
 *  back to the dashboard if you're elsewhere. */
function DashboardSecondaryNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { section, setSection, newCards, reviewQueue, masteredCards, loading } = useDashboardSection()
  const toLearnCount = newCards.length + reviewQueue.length

  const items: { key: DashboardSection; label: string; count?: string; tone?: "destructive" | "success" }[] = [
    {
      key: "review",
      label: t("dashboard.review"),
      count: !loading && toLearnCount > 0 ? formatCount(toLearnCount) : undefined,
      tone: "destructive",
    },
    {
      key: "mastered",
      label: t("dashboard.mastered"),
      count: !loading && masteredCards.length > 0 ? formatCount(masteredCards.length) : undefined,
      tone: "success",
    },
    { key: "table", label: t("dashboard.wordTableHeading") },
  ]

  return (
    <div className="ml-1 mt-1 space-y-1 border-l pl-3">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            setSection(item.key)
            if (location.pathname !== "/") navigate("/")
            onNavigate?.()
          }}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
            section === item.key && location.pathname === "/"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.count && (
            <Badge variant={item.tone === "destructive" ? "destructive" : "success"} className="shrink-0 px-1.5 text-[10px]">
              {item.count}
            </Badge>
          )}
        </button>
      ))}
    </div>
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

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center justify-between gap-2 px-1">
        <Link to="/" className="block font-semibold text-sm tracking-tight">
          {t("appName")}
        </Link>
        {streak > 0 && <StreakBadge streak={streak} />}
      </div>

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
    </div>
  )

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop: persistent sidebar */}
      <aside className="hidden shrink-0 border-r p-4 md:flex md:w-60 md:flex-col">{sidebarBody}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: top bar with a drawer for the same nav */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              {sidebarBody}
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-sm">{t("appName")}</span>
          <div className="w-9" />
        </header>

        <main className="container flex-1 py-6 md:px-8">{children}</main>
      </div>

      <DailyGoalDialog
        open={goalDialogVisible}
        onOpenChange={setGoalDialogOpen}
      />
    </div>
  )
}
