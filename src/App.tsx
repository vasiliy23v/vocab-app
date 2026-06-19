import * as React from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import AppLayout from "@/components/AppLayout"
import AuthPage from "@/pages/AuthPage"
import InvitePage from "@/pages/InvitePage"
import PeoplePage from "@/pages/PeoplePage"
import HomePage from "@/pages/HomePage"
import TeacherStudentPage from "@/pages/TeacherStudentPage"
import { Toaster } from "@/components/ui/sonner"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Загрузка…</div>
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }
  return <AppLayout>{children}</AppLayout>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
