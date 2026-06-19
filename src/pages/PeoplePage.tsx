import * as React from "react"
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

function initials(name: string | null, email: string) {
  return (name || email).slice(0, 2).toUpperCase()
}

export default function PeoplePage() {
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
      toast.success("Ученик добавлен!")
      setRedeemCode("")
    }
  }

  const inviteLink = invite ? `${window.location.origin}/invite/${invite}` : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Учителя и ученики</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Invite a teacher (as student) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пригласить учителя</CardTitle>
          <CardDescription>Сгенерируйте код — учитель вводит его на своей странице</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Генерируем…" : "Сгенерировать код"}
          </Button>
          {invite && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Код приглашения (действует 7 дней)</div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-background px-2 py-1 text-lg font-semibold tracking-wider">
                  {invite}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(invite)
                    toast.success("Код скопирован")
                  }}
                >
                  Скопировать код
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
                      toast.success("Ссылка скопирована")
                    }}
                  >
                    Скопировать ссылку
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
          <CardTitle className="text-base">У меня есть код от ученика</CardTitle>
          <CardDescription>Введите код, который вам дал ученик</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRedeem} className="flex gap-2">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="например, A1B2C3D4"
              className="uppercase"
            />
            <Button type="submit" disabled={redeeming}>
              {redeeming ? "…" : "Добавить"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My teachers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мои учителя</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          {!loading && myTeachers.length === 0 && (
            <p className="text-sm text-muted-foreground">Пока никого нет</p>
          )}
          {myTeachers.map((t) => (
            <PersonRow key={t.link_id} person={t} role="учитель" onRemove={() => removeLink(t.link_id)} />
          ))}
        </CardContent>
      </Card>

      {/* My students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мои ученики</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          {!loading && myStudents.length === 0 && (
            <p className="text-sm text-muted-foreground">Пока никого нет</p>
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
                <Badge variant="secondary">ученик</Badge>
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
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          Удалить
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить связь с «{label}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Доступ к карточкам и статусам будет немедленно отключён. Это можно отменить только повторным приглашением.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
