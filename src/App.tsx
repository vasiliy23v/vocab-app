import * as React from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import { useIsSuperadmin } from "@/hooks/useAdmin"
import { DashboardSectionProvider } from "@/hooks/useDashboardSection"
import {
  getAuthCallbackError,
  getAuthCallbackType,
  hasAuthCallbackInUrl,
  passwordSetupTypes,
} from "@/lib/authCallback"
import AppLayout from "@/components/AppLayout"
import AuthPage from "@/pages/AuthPage"
import InvitePage from "@/pages/InvitePage"
import PeoplePage from "@/pages/PeoplePage"
import HomePage from "@/pages/HomePage"
import TeacherStudentPage from "@/pages/TeacherStudentPage"
import AdminDashboard from "@/pages/AdminDashboard"
import ResetPasswordPage from "@/pages/ResetPasswordPage"
import { Toaster } from "@/components/ui/sonner"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  // Magic/invite links land on `/#access_token=…`. Do not bounce to /auth
  // until the hash is consumed — Navigate would strip the tokens.
  if (loading || (!user && hasAuthCallbackInUrl())) {
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

/** Consume magic/invite/recovery callback and route to the right screen. */
function AuthCallbackHandler() {
  const { user, loading, authEvent } = useAuth()
  const navigate = useNavigate()
  const handled = React.useRef(false)

  React.useEffect(() => {
    if (loading || handled.current) return
    if (!hasAuthCallbackInUrl() && authEvent !== "PASSWORD_RECOVERY") return

    const error = getAuthCallbackError()
    if (error) {
      handled.current = true
      toast.error(error)
      navigate("/auth", { replace: true })
      return
    }

    if (!user) return

    handled.current = true
    const type = getAuthCallbackType()
    const needsPassword =
      authEvent === "PASSWORD_RECOVERY" || (type != null && passwordSetupTypes().has(type))

    navigate(needsPassword ? "/reset-password" : "/", { replace: true })
  }, [user, loading, authEvent, navigate])

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
      </AuthProvider>
    </BrowserRouter>
  )
}
