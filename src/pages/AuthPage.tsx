import * as React from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { toast } from "sonner"

const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1519452575417-564c1401ecc0?auto=format&fit=crop&w=1400&q=80"

function safeNextPath(raw: string | null): string {
  if (!raw) return "/"
  // Only allow same-origin relative paths (blocks open redirects).
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/"
  return raw
}

export default function AuthPage() {
  const { signIn, signUp, user, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const [loading, setLoading] = React.useState(false)
  const [forgotOpen, setForgotOpen] = React.useState(false)
  const [resetSent, setResetSent] = React.useState(false)
  const nextPath = safeNextPath(searchParams.get("next"))

  React.useEffect(() => {
    if (user) navigate(nextPath, { replace: true })
  }, [user, navigate, nextPath])

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
    else toast.success(t("auth.signupSuccess"))
  }

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const { error } = await requestPasswordReset(fd.get("email") as string)
    setLoading(false)
    if (error) toast.error(error)
    else setResetSent(true)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Hero panel — the two-column split only makes sense once there's
          room for it; on phones/small tablets it's just noise, so skip it
          entirely and show a plain, centered form instead. */}
      <div className="relative hidden lg:block">
        <img src={HERO_IMAGE_URL} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20" />
        <div className="relative flex h-full flex-col justify-end p-10 text-white">
          <div className="text-3xl font-semibold tracking-tight">{t("appName")}</div>
          <p className="mt-2 max-w-sm text-sm text-white/80">{t("auth.heroTagline")}</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm space-y-3">
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>

          <Card>
            {forgotOpen ? (
              <>
                <CardHeader>
                  <CardTitle>{t("auth.forgotTitle")}</CardTitle>
                  <CardDescription>
                    {resetSent ? t("auth.forgotSent") : t("auth.forgotDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!resetSent && (
                    <form onSubmit={handleForgot} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="forgot-email">{t("common.email")}</Label>
                        <Input id="forgot-email" name="email" type="email" required placeholder="you@example.com" />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? t("auth.forgotSending") : t("auth.forgotSend")}
                      </Button>
                    </form>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={() => {
                      setForgotOpen(false)
                      setResetSent(false)
                    }}
                  >
                    {t("auth.backToSignIn")}
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>{t("appName")}</CardTitle>
                  <CardDescription>{t("auth.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="signin">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="signin">{t("auth.signInTab")}</TabsTrigger>
                      <TabsTrigger value="signup">{t("auth.signUpTab")}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="signin">
                      <form onSubmit={handleSignIn} className="space-y-3 pt-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="email">{t("common.email")}</Label>
                          <Input id="email" name="email" type="email" required placeholder="you@example.com" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password">{t("common.password")}</Label>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                              onClick={() => setForgotOpen(true)}
                            >
                              {t("auth.forgotLink")}
                            </button>
                          </div>
                          <PasswordInput id="password" name="password" required />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? t("auth.signingIn") : t("auth.signIn")}
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="signup">
                      <form onSubmit={handleSignUp} className="space-y-3 pt-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="name">{t("common.name")}</Label>
                          <Input id="name" name="name" required placeholder={t("auth.namePlaceholder")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="email-su">{t("common.email")}</Label>
                          <Input id="email-su" name="email" type="email" required placeholder="you@example.com" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="password-su">{t("common.password")}</Label>
                          <PasswordInput id="password-su" name="password" required minLength={6} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? t("auth.creating") : t("auth.createAccount")}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
