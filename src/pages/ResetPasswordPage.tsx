import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const password = fd.get("password") as string
    const confirm = fd.get("confirm") as string
    if (password !== confirm) {
      toast.error(t("resetPassword.mismatch"))
      return
    }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    setDone(true)
    toast.success(t("resetPassword.success"))
    setTimeout(() => navigate("/", { replace: true }), 1200)
  }

  if (loading) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("resetPassword.title")}</CardTitle>
          <CardDescription>
            {session ? t("resetPassword.subtitle") : t("resetPassword.invalidLink")}
          </CardDescription>
        </CardHeader>
        {session && !done && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("resetPassword.newPassword")}</Label>
                <PasswordInput id="password" name="password" required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">{t("resetPassword.confirmPassword")}</Label>
                <PasswordInput id="confirm" name="confirm" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t("resetPassword.saving") : t("resetPassword.save")}
              </Button>
            </form>
          </CardContent>
        )}
        {!session && (
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
              {t("resetPassword.backToSignIn")}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
