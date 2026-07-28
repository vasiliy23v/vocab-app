import * as React from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import { useIsSuperadmin } from "@/hooks/useAdmin"
import { DashboardSectionProvider } from "@/hooks/useDashboardSection"
import { needsPasswordSetup } from "@/lib/authCallback"
import AppLayout from "@/components/AppLayout"
import AuthPage from "@/pages/AuthPage"
import InvitePage from "@/pages/InvitePage"
import PeoplePage from "@/pages/PeoplePage"
import HomePage from "@/pages/HomePage"
import SettingsPage from "@/pages/SettingsPage"
import TeacherStudentPage from "@/pages/TeacherStudentPage"
import AdminDashboard from "@/pages/AdminDashboard"
import ResetPasswordPage from "@/pages/ResetPasswordPage"
import { LanguageOnboardingDialog } from "@/components/LanguageOnboardingDialog"
import { UILanguageOnboardingDialog } from "@/components/UILanguageOnboardingDialog"
import { Toaster } from "@/components/ui/sonner"
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt"
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt"
import type { Language } from "@/types/db"
import { LANGUAGE_STORAGE_KEY } from "@/i18n"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }
  return (
    <DashboardSectionProvider>
      <AppLayout>{children}</AppLayout>
    </DashboardSectionProvider>
  )
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const isSuperadmin = useIsSuperadmin()
  if (!isSuperadmin) return <Navigate to="/" replace />
  return <>{children}</>
}

/** After invite/magic/recovery: send user to password setup or home. */
function AuthCallbackHandler() {
  const { user, loading, authEvent, callbackType, callbackError } = useAuth()
  const navigate = useNavigate()
  const handled = React.useRef(false)

  React.useEffect(() => {
    if (loading || handled.current) return

    if (callbackError) {
      handled.current = true
      toast.error(callbackError)
      navigate("/auth", { replace: true })
      return
    }

    if (!user || !callbackType) return

    handled.current = true
    navigate(needsPasswordSetup(callbackType, authEvent) ? "/reset-password" : "/", { replace: true })
  }, [user, loading, authEvent, callbackType, callbackError, navigate])

  return null
}

/** Show UI language onboarding dialog if user hasn't set language yet */
function UILanguageOnboardingHandler() {
  const [showDialog, setShowDialog] = React.useState(false)
  const handled = React.useRef(false)

  React.useEffect(() => {
    if (handled.current) return

    if (typeof window !== "undefined") {
      const storedLang = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (!storedLang) {
        handled.current = true
        setShowDialog(true)
      }
    }
  }, [])

  return (
    <UILanguageOnboardingDialog
      open={showDialog}
      onComplete={() => setShowDialog(false)}
    />
  )
}

/** Show language pair onboarding dialog if user hasn't set a language pair yet */
function LanguagePairOnboardingHandler() {
  const { profile, loading, updateProfile } = useAuth()
  const [showDialog, setShowDialog] = React.useState(false)
  const handled = React.useRef(false)

  React.useEffect(() => {
    if (loading || handled.current) return

    // Show dialog if user is logged in but hasn't selected a language pair
    if (profile && !profile.language_from && !profile.language_to) {
      handled.current = true
      setShowDialog(true)
    }
  }, [profile, loading])

  const handleComplete = async (from: Language, to: Language) => {
    await updateProfile({
      language_from: from,
      language_to: to,
    })
    setShowDialog(false)
  }

  return <LanguageOnboardingDialog open={showDialog} onComplete={handleComplete} />
}

function AppRoutes() {
  return (
    <>
      <AuthCallbackHandler />
      <UILanguageOnboardingHandler />
      <LanguagePairOnboardingHandler />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/people"
          element={
            <RequireAuth>
              <PeoplePage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/student/:studentId"
          element={
            <RequireAuth>
              <TeacherStudentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" />
        <PwaUpdatePrompt />
        <PwaInstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
