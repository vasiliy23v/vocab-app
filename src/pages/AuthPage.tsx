import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

export default function AuthPage() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (user) navigate("/", { replace: true })
  }, [user, navigate])

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const { error } = await signIn(fd.get("email") as string, fd.get("password") as string)
    setLoading(false)
    if (error) toast.error(error)
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const { error } = await signUp(
      fd.get("email") as string,
      fd.get("password") as string,
      fd.get("name") as string
    )
    setLoading(false)
    if (error) toast.error(error)
    else toast.success("Готово! Можете войти.")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Карточки — Немецкий</CardTitle>
          <CardDescription>Войдите или создайте аккаунт</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Пароль</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Входим…" : "Войти"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Имя</Label>
                  <Input id="name" name="name" required placeholder="Как вас называть" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-su">Email</Label>
                  <Input id="email-su" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-su">Пароль</Label>
                  <Input id="password-su" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Создаём…" : "Создать аккаунт"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
