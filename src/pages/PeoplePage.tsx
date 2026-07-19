import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useTeacherLinks, createInviteCode, redeemInviteCode } from "@/hooks/useTeacherLinks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { getAppOrigin } from "@/lib/appUrl"

function initials(name: string | null, email: string) {
  return (name || email).slice(0, 2).toUpperCase()
}

export default function PeoplePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { myTeachers, myStudents, loading, removeLink } = useTeacherLinks()
  const [invite, setInvite] = React.useState<string | null>(null)
  const [generating, setGenerating] = React.useState(false)
  const [redeemCode, setRedeemCode] = React.useState("")
  const [redeeming, setRedeeming] = React.useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    const { code, error } = await createInviteCode()
    setGenerating(false)
    if (error) toast.error(error)
    else setInvite(code)
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!redeemCode.trim()) return
    setRedeeming(true)
    const { error } = await redeemInviteCode(redeemCode)
    setRedeeming(false)
    if (error) toast.error(error)
    else {
      toast.success(t("people.studentAdded"))
      setRedeemCode("")
    }
  }

  const inviteLink = invite ? `${getAppOrigin()}/invite/${invite}` : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("people.title")}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Invite a teacher (as student) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("people.inviteTeacherTitle")}</CardTitle>
          <CardDescription>{t("people.inviteTeacherDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? t("people.generating") : t("people.generateCode")}
          </Button>
          {invite && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="text-xs text-muted-foreground">{t("people.inviteCodeLabel")}</div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-background px-2 py-1 text-lg font-semibold tracking-wider">
                  {invite}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(invite)
                    toast.success(t("people.codeCopied"))
                  }}
                >
                  {t("people.copyCode")}
                </Button>
              </div>
              {inviteLink && (
                <div className="flex items-center gap-2">
                  <Input readOnly value={inviteLink} className="text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink)
                      toast.success(t("people.linkCopied"))
                    }}
                  >
                    {t("people.copyLink")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redeem a code (as teacher) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("people.redeemTitle")}</CardTitle>
          <CardDescription>{t("people.redeemDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRedeem} className="flex gap-2">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder={t("people.codePlaceholder")}
              className="uppercase"
            />
            <Button type="submit" disabled={redeeming}>
              {redeeming ? "…" : t("people.add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My teachers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("people.myTeachers")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {!loading && myTeachers.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("people.noOneYet")}</p>
          )}
          {myTeachers.map((tch) => (
            <PersonRow key={tch.link_id} person={tch} role={t("people.roleTeacher")} onRemove={() => removeLink(tch.link_id)} />
          ))}
        </CardContent>
      </Card>

      {/* My students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("people.myStudents")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {!loading && myStudents.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("people.noOneYet")}</p>
          )}
          {myStudents.map((s) => (
            <div key={s.link_id} className="flex items-center justify-between rounded-lg border p-3">
              <Link to={`/student/${s.id}`} className="flex items-center gap-3 flex-1 hover:opacity-80">
                <Avatar>
                  <AvatarFallback>{initials(s.display_name, s.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{s.display_name || s.email}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t("people.roleStudent")}</Badge>
                <RemoveButton onConfirm={() => removeLink(s.link_id)} label={s.display_name || s.email} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function PersonRow({
  person,
  role,
  onRemove,
}: {
  person: { id: string; display_name: string | null; email: string }
  role: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{initials(person.display_name, person.email)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium">{person.display_name || person.email}</div>
          <div className="text-xs text-muted-foreground">{person.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{role}</Badge>
        <RemoveButton onConfirm={onRemove} label={person.display_name || person.email} />
      </div>
    </div>
  )
}

function RemoveButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const { t } = useTranslation()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          {t("common.delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("people.removeLinkTitle", { name: label })}</AlertDialogTitle>
          <AlertDialogDescription>{t("people.removeLinkDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
