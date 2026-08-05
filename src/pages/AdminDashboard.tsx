import * as React from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { useAdminUsers, useAdminTemplates } from "@/hooks/useAdmin"
import { useAdminUserDecks } from "@/hooks/useAdminUserDecks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadDialog } from "@/components/UploadDialog"
import { MoreHorizontal, Download, Pencil } from "lucide-react"
import { formatCount } from "@/lib/formatCount"
import { deckName } from "@/lib/cardTranslation"
import { exportTemplateDecksToExcel } from "@/lib/exportDatabase"
import { supabase } from "@/lib/supabase"
import type { AdminProfileRow, Deck, ParsedCardRow, Card as CardRow } from "@/types/db"

export default function AdminDashboard() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-3 max-w-sm">
          <TabsTrigger value="users">{t("admin.tabUsers")}</TabsTrigger>
          <TabsTrigger value="content">{t("admin.tabContent")}</TabsTrigger>
          <TabsTrigger value="vocabulary">{t("admin.tabVocabulary")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="pt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="content" className="pt-4">
          <ContentPanel />
        </TabsContent>
        <TabsContent value="vocabulary" className="pt-4">
          <VocabularyPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UsersPanel() {
  const { t } = useTranslation()
  const { user: currentUser, requestPasswordReset } = useAuth()
  const { users, loading, setRole, deleteUser } = useAdminUsers()

  const handleResetEmail = async (email: string) => {
    const { error } = await requestPasswordReset(email)
    if (error) toast.error(error)
    else toast.success(t("admin.resetEmailSent", { email }))
  }

  const handleToggleRole = async (u: AdminProfileRow) => {
    const nextRole = u.role === "superadmin" ? "user" : "superadmin"
    const { error } = await setRole(u.id, nextRole)
    if (error) toast.error(error)
    else toast.success(nextRole === "superadmin" ? t("admin.promoted", { name: u.display_name || u.email }) : t("admin.demoted", { name: u.display_name || u.email }))
  }

  const handleDelete = async (u: AdminProfileRow) => {
    const { error } = await deleteUser(u.id)
    if (error) toast.error(error)
    else toast.success(t("admin.userDeleted", { name: u.display_name || u.email }))
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.colUser")}</TableHead>
              <TableHead>{t("admin.colRole")}</TableHead>
              <TableHead>{t("admin.colDecks")}</TableHead>
              <TableHead>{t("admin.colCards")}</TableHead>
              <TableHead>{t("admin.colLinks")}</TableHead>
              <TableHead className="text-right">{t("admin.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.display_name || t("common.noName")}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "superadmin" ? "success" : "outline"}>
                    {u.role === "superadmin" ? t("admin.roleSuperadmin") : t("admin.roleUser")}
                  </Badge>
                </TableCell>
                <TableCell>{formatCount(u.deck_count)}</TableCell>
                <TableCell>{formatCount(u.card_count)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t("admin.linksSummary", { teachers: u.teacher_count, students: u.student_count })}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleResetEmail(u.email)}>
                        {t("admin.sendResetEmail")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleRole(u)}
                        disabled={u.id === currentUser?.id}
                      >
                        {u.role === "superadmin" ? t("admin.demote") : t("admin.promote")}
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            disabled={u.id === currentUser?.id}
                            className="text-destructive focus:text-destructive"
                          >
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("admin.deleteUserTitle", { name: u.display_name || u.email })}
                            </AlertDialogTitle>
                            <AlertDialogDescription>{t("admin.deleteUserDesc")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(u)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ContentPanel() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { users } = useAdminUsers()
  const { templates, loading, createTemplate, deleteTemplate, assignToStudents, renameTemplate } = useAdminTemplates(user?.id ?? null)
  const [exporting, setExporting] = React.useState(false)

  // Admins are not students, but they still want to assign a template to
  // themselves — put themselves first in the list, marked as "you".
  const students = React.useMemo(() => {
    const rest = users.filter((u) => u.role === "user" && u.id !== user?.id)
    const me = users.find((u) => u.id === user?.id)
    return me ? [me, ...rest] : rest
  }, [users, user?.id])

  const handleCreate = async (
    rows: ParsedCardRow[],
    name?: string,
    onProgress?: (done: number, total: number) => void,
    nameEn?: string
  ) => {
    const { error } = await createTemplate(name || t("dashboard.defaultDeckName"), rows, onProgress, nameEn)
    if (error) toast.error(error)
    else toast.success(t("admin.templateCreated"))
    return { error }
  }

  const handleExport = async () => {
    if (templates.length === 0) return
    setExporting(true)
    try {
      const deckIds = templates.map((d) => d.id)
      const { data, error } = await supabase.from("cards").select("*").in("deck_id", deckIds).order("sort_order")
      if (error) {
        toast.error(error.message)
        return
      }
      const cardsByDeck = new Map<string, CardRow[]>()
      for (const card of (data as CardRow[]) ?? []) {
        const list = cardsByDeck.get(card.deck_id) ?? []
        list.push(card)
        cardsByDeck.set(card.deck_id, list)
      }
      await exportTemplateDecksToExcel(templates, cardsByDeck)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.exportError"))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{t("admin.templateLibrary")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting || templates.length === 0}>
            <Download className="h-4 w-4" />
            {exporting ? t("admin.exporting") : t("admin.export")}
          </Button>
          <UploadDialog askDeckName onUpload={handleCreate} trigger={<Button>{t("admin.newTemplate")}</Button>} />
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && templates.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("admin.noTemplates")}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((deck) => (
          <TemplateCard
            key={deck.id}
            deck={deck}
            students={students}
            currentUserId={user?.id ?? null}
            language={i18n.language}
            onAssign={assignToStudents}
            onDelete={() => deleteTemplate(deck.id)}
            onRename={renameTemplate}
          />
        ))}
      </div>
    </div>
  )
}

function TemplateCard({
  deck,
  students,
  currentUserId,
  language,
  onAssign,
  onDelete,
  onRename,
}: {
  deck: Deck
  students: AdminProfileRow[]
  currentUserId: string | null
  language: string
  onAssign: (deckId: string, studentIds: string[]) => Promise<{ error: string | null }>
  onDelete: () => void
  onRename: (deckId: string, name: string, nameEn: string) => Promise<{ error: string | null }>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [renameName, setRenameName] = React.useState(deck.name)
  const [renameNameEn, setRenameNameEn] = React.useState(deck.name_en)
  const [renameBusy, setRenameBusy] = React.useState(false)

  const displayName = deckName(deck, language)

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssign = async () => {
    if (selected.size === 0) return
    setBusy(true)
    const { error } = await onAssign(deck.id, [...selected])
    setBusy(false)
    if (error) toast.error(error)
    else {
      toast.success(t("admin.assignedTo", { count: selected.size }))
      setOpen(false)
      setSelected(new Set())
    }
  }

  const handleRename = async () => {
    if (!renameName.trim()) return
    setRenameBusy(true)
    const { error } = await onRename(deck.id, renameName.trim(), renameNameEn.trim())
    setRenameBusy(false)
    if (error) toast.error(error)
    else {
      toast.success(t("admin.renamed"))
      setRenameOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{displayName}</CardTitle>
          <Dialog
            open={renameOpen}
            onOpenChange={(o) => {
              setRenameOpen(o)
              if (o) {
                setRenameName(deck.name)
                setRenameNameEn(deck.name_en)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={t("admin.renameTitle")}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.renameTitle")}</DialogTitle>
                <DialogDescription>{t("admin.renameDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rename-name">{t("upload.deckNameLabel")}</Label>
                  <Input id="rename-name" value={renameName} onChange={(e) => setRenameName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rename-name-en">{t("upload.deckNameEnLabel")}</Label>
                  <Input
                    id="rename-name-en"
                    value={renameNameEn}
                    onChange={(e) => setRenameNameEn(e.target.value)}
                    placeholder={t("upload.deckNameEnPlaceholder")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleRename} disabled={renameBusy || !renameName.trim()}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t("admin.assign")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.assignTitle", { name: displayName })}</DialogTitle>
              <DialogDescription>{t("admin.assignDesc")}</DialogDescription>
            </DialogHeader>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {students.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.noStudents")}</p>}
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2.5 rounded-md border p-2.5 text-sm cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <span>
                    {s.id === currentUserId
                      ? t("admin.selfOption", { name: s.display_name || s.email })
                      : s.display_name || s.email}
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={handleAssign} disabled={busy || selected.size === 0}>
                {t("admin.assignCount", { count: selected.size })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              {t("common.delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.deleteTemplateTitle", { name: displayName })}</AlertDialogTitle>
              <AlertDialogDescription>{t("admin.deleteTemplateDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function VocabularyPanel() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { users } = useAdminUsers()
  const [selectedUserId, setSelectedUserId] = React.useState<string>("")
  const { decks, loading, createDeck, addCards } = useAdminUserDecks(selectedUserId || null)
  const [selectedDeckId, setSelectedDeckId] = React.useState<string>("")
  const [newDeckName, setNewDeckName] = React.useState("")
  const [newDeckNameEn, setNewDeckNameEn] = React.useState("")
  const [showCreateDeck, setShowCreateDeck] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id)
    }
  }, [decks, selectedDeckId])

  // Admins are not in the student list, but they still need to load vocabulary
  // into their own account — put themselves first, marked as "you".
  const assignableUsers = React.useMemo(() => {
    const students = users.filter((u) => u.role === "user" && u.id !== currentUser?.id)
    const me = users.find((u) => u.id === currentUser?.id)
    return me ? [me, ...students] : students
  }, [users, currentUser?.id])

  const handleCreateDeck = async () => {
    if (!newDeckName.trim() || !selectedUserId) return
    setBusy(true)
    const { error, deckId } = await createDeck(newDeckName.trim(), newDeckNameEn.trim())
    setBusy(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("admin.deckCreated"))
      setNewDeckName("")
      setNewDeckNameEn("")
      setShowCreateDeck(false)
      if (deckId) setSelectedDeckId(deckId)
    }
  }

  const handleUploadCards = async (
    rows: any[],
    _newDeckName?: string,
    onProgress?: (done: number, total: number) => void
  ) => {
    if (!selectedDeckId) {
      toast.error(t("admin.selectDeck"))
      return { error: t("admin.selectDeck") }
    }
    const { error, insertedCount, updatedCount } = await addCards(selectedDeckId, rows, onProgress)
    if (error) {
      toast.error(error)
      return { error }
    }
    toast.success(t("admin.cardsUpserted", { added: insertedCount, updated: updatedCount }))
    return { error: null }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* User Selection */}
        <div className="space-y-2">
          <Label htmlFor="user-select">{t("admin.selectStudent")}</Label>
          <select
            id="user-select"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value)
              setSelectedDeckId("")
            }}
          >
            <option value="">{t("admin.chooseStudent")}</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === currentUser?.id
                  ? t("admin.selfOption", { name: u.display_name || u.email })
                  : u.display_name || u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Deck Selection */}
        {selectedUserId && (
          <div className="space-y-2">
            <Label htmlFor="deck-select">{t("admin.selectDeck")}</Label>
            <select
              id="deck-select"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              disabled={loading || decks.length === 0}
            >
              <option value="">{t("admin.chooseDeck")}</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.card_count} {t("admin.cards")})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedUserId && (
        <div className="flex gap-2">
          <Dialog open={showCreateDeck} onOpenChange={setShowCreateDeck}>
            <DialogTrigger asChild>
              <Button variant="outline">{t("admin.newDeck")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.createNewDeck")}</DialogTitle>
                <DialogDescription>{t("admin.createDeckDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-deck-name">{t("upload.deckNameLabel")}</Label>
                  <Input
                    id="new-deck-name"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder={t("upload.deckNamePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-deck-name-en">{t("upload.deckNameEnLabel")}</Label>
                  <Input
                    id="new-deck-name-en"
                    value={newDeckNameEn}
                    onChange={(e) => setNewDeckNameEn(e.target.value)}
                    placeholder={t("upload.deckNameEnPlaceholder")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateDeck} disabled={busy || !newDeckName.trim()}>
                  {t("common.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {selectedDeckId && (
            <UploadDialog onUpload={handleUploadCards} trigger={<Button>{t("admin.addCards")}</Button>} />
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {selectedUserId && decks.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("admin.noDecksByStudent")}</p>
      )}
    </div>
  )
}
