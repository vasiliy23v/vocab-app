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
import TeacherStudentPage from "@/pages/TeacherStudentPage"
import AdminDashboard from "@/pages/AdminDashboard"
import ResetPasswordPage from "@/pages/ResetPasswordPage"
import { Toaster } from "@/components/ui/sonner"
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt"
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt"

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

function AppRoutes() {
  return (
    <>
      <AuthCallbackHandler />
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
