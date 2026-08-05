import * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { parseVocabText, type ParseErrorCode } from "@/lib/parseVocab"
import type { ParsedCardRow } from "@/types/db"
import { toast } from "sonner"
import { Upload } from "lucide-react"

// Doubles as documentation: whatever columns this sample carries are the
// ones people copy. It shows the Ukrainian pair alongside the English one
// so both read as equally supported.
const DEMO_TSV = `word\ttranslation\ttranslation_en\ttranslation_uk\tgroup\ttags\tdescription\texample_de\texample_ru\texample_uk
das Erlebnis, -se\tпереживание, событие\texperience, event\tпереживання, подія\tB1.1\tnoun;experience\tСущ. ср. рода, мн.ч. с -se\tManfred erzählt von seinem Glückserlebnis.\tМанфред рассказывает о своём счастливом событии.\tМанфред розповідає про свою щасливу подію.
der Artikel, -\tстатья\tarticle\tстаття\tB1.1\tnoun;media\tСущ. муж. рода, мн.ч. без окончания\tEllas Artikel wird pünktlich fertig.\tСтатья Эллы будет готова вовремя.\tСтаття Елли буде готова вчасно.
weg sein (ist weg gewesen)\tпропасть, исчезнуть\tto be gone, to disappear\tзникнути, пропасти\tB1.1\tverb;state\tГлагол — отсутствовать или исчезнуть\tSo lange, bis viel Geld weg war.\tДо тех пор, пока не пропало много денег.\tДо того часу, поки не зникло багато грошей.`

interface UploadDialogProps {
  onUpload: (
    rows: ParsedCardRow[],
    newDeckName: string | undefined,
    onProgress?: (done: number, total: number) => void,
    newDeckNameEn?: string
  ) => Promise<{ error: string | null } | void>
  trigger?: React.ReactNode
  /** if true, also asks for a deck name (used when creating a brand-new deck) */
  askDeckName?: boolean
}

/** Below this many rows the upload is a single quick insert — no need for a progress toast. */
const PROGRESS_TOAST_THRESHOLD = 250

export function UploadDialog({ onUpload, trigger, askDeckName }: UploadDialogProps) {
  const { t } = useTranslation()

  const parseErrorMessage = (code: ParseErrorCode) => {
    if (code === "min_lines") return t("upload.errorMinLines")
    if (code === "missing_columns") return t("upload.errorMissingColumns")
    return t("upload.errorNoCards")
  }
  const [open, setOpen] = React.useState(false)
  const [paste, setPaste] = React.useState("")
  const [deckName, setDeckName] = React.useState("")
  const [deckNameEn, setDeckNameEn] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const submit = async (rows: ParsedCardRow[]) => {
    if (askDeckName && !deckName.trim()) {
      toast.error(t("upload.needDeckName"))
      return
    }
    setBusy(true)
    const showProgress = rows.length > PROGRESS_TOAST_THRESHOLD
    const toastId = showProgress
      ? toast.loading(t("upload.uploadingProgress", { done: 0, total: rows.length }))
      : undefined
    const result = await onUpload(
      rows,
      askDeckName ? deckName.trim() : undefined,
      (done, total) => {
        if (toastId) toast.loading(t("upload.uploadingProgress", { done, total }), { id: toastId })
      },
      askDeckName ? deckNameEn.trim() : undefined
    )
    setBusy(false)

    const error = result?.error ?? null
    if (error) {
      // The individual page already showed a toast.error with details;
      // just clear the loading toast so it doesn't get stuck spinning.
      if (toastId) toast.dismiss(toastId)
      return
    }

    setOpen(false)
    setPaste("")
    setDeckName("")
    setDeckNameEn("")
    toast.success(t("upload.uploadedCount", { count: rows.length }), { id: toastId })
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const { cards, error } = parseVocabText(e.target?.result as string)
      if (error) toast.error(parseErrorMessage(error))
      else submit(cards)
    }
    reader.readAsText(file, "UTF-8")
  }

  const handlePasteSubmit = () => {
    const { cards, error } = parseVocabText(paste)
    if (error) toast.error(parseErrorMessage(error))
    else submit(cards)
  }

  const handleDemo = () => {
    const { cards } = parseVocabText(DEMO_TSV)
    submit(cards)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload className="h-4 w-4" /> {t("upload.uploadCards")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upload.uploadCards")}</DialogTitle>
          <DialogDescription>{t("upload.formatDesc")}</DialogDescription>
        </DialogHeader>

        {askDeckName && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deck-name">{t("upload.deckNameLabel")}</Label>
              <Input
                id="deck-name"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder={t("upload.deckNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deck-name-en">{t("upload.deckNameEnLabel")}</Label>
              <Input
                id="deck-name-en"
                value={deckNameEn}
                onChange={(e) => setDeckNameEn(e.target.value)}
                placeholder={t("upload.deckNameEnPlaceholder")}
              />
            </div>
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
          <div className="font-medium">{t("upload.columnsLabel")}</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="success" className="text-[10px]">word</Badge>
            <Badge variant="success" className="text-[10px]">translation</Badge>
            <Badge variant="outline" className="text-[10px]">translation_en</Badge>
            <Badge variant="outline" className="text-[10px]">translation_uk</Badge>
            <Badge variant="outline" className="text-[10px]">group</Badge>
            <Badge variant="outline" className="text-[10px]">group_en</Badge>
            <Badge variant="outline" className="text-[10px]">group_uk</Badge>
            <Badge variant="outline" className="text-[10px]">tags</Badge>
            <Badge variant="outline" className="text-[10px]">description</Badge>
            <Badge variant="outline" className="text-[10px]">description_en</Badge>
            <Badge variant="outline" className="text-[10px]">description_uk</Badge>
            <Badge variant="outline" className="text-[10px]">example_de</Badge>
            <Badge variant="outline" className="text-[10px]">example_ru</Badge>
            <Badge variant="outline" className="text-[10px]">example_en</Badge>
            <Badge variant="outline" className="text-[10px]">example_uk</Badge>
          </div>
          <p className="text-muted-foreground">{t("upload.separatorHint")}</p>
          <p className="text-muted-foreground">{t("upload.translationColumnHint")}</p>
          <p className="text-muted-foreground">{t("upload.groupColumnHint")}</p>
          <p className="text-muted-foreground">{t("upload.ukAliasHint")}</p>
        </div>

        <Tabs defaultValue="file">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file">{t("upload.tabFile")}</TabsTrigger>
            <TabsTrigger value="paste">{t("upload.tabPaste")}</TabsTrigger>
            <TabsTrigger value="demo">{t("upload.tabDemo")}</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-2">
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center cursor-pointer hover:bg-muted/40"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{t("upload.dropHint")}</p>
              <p className="text-xs text-muted-foreground">.tsv · .csv · .txt</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".tsv,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </TabsContent>

          <TabsContent value="paste" className="space-y-2">
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background p-3 text-sm font-mono outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"word\ttranslation\tgroup\ndas Erlebnis, -se\tпереживание\tB1.1"}
            />
            <Button onClick={handlePasteSubmit} disabled={busy} className="w-full">
              {t("upload.upload")}
            </Button>
          </TabsContent>

          <TabsContent value="demo" className="space-y-2">
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("upload.demoDesc")}
            </p>
            <Button onClick={handleDemo} disabled={busy} className="w-full">
              {t("upload.runDemo")}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  )
}
