import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { redeemInviteCode } from "@/hooks/useTeacherLinks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = React.useState<"idle" | "working" | "done" | "error">("idle")
  const [message, setMessage] = React.useState("")

  const handleAccept = async () => {
    if (!code) return
    setStatus("working")
    const { error } = await redeemInviteCode(code)
    if (error) {
      setStatus("error")
      setMessage(error)
    } else {
      setStatus("done")
      toast.success("Готово, ученик добавлен!")
      setTimeout(() => navigate("/people"), 1200)
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Приглашение учителя</CardTitle>
            <CardDescription>Войдите или зарегистрируйтесь, чтобы принять приглашение</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate(`/auth?next=/invite/${code}`)}>
              Войти / Зарегистрироваться
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Приглашение учителя</CardTitle>
          <CardDescription>
            Код: <code className="font-semibold">{code}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "error" && <p className="text-sm text-destructive">{message}</p>}
          {status === "done" ? (
            <p className="text-sm text-success">Принято! Переходим…</p>
          ) : (
            <Button className="w-full" onClick={handleAccept} disabled={status === "working"}>
              {status === "working" ? "Принимаем…" : "Принять приглашение"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
