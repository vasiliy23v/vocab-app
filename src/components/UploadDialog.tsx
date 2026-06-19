import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { parseVocabText } from "@/lib/parseVocab"
import type { ParsedCardRow } from "@/types/db"
import { toast } from "sonner"
import { Upload } from "lucide-react"

const DEMO_TSV = `word\ttranslation\tgroup\ttags\tdescription\texample_de\texample_ru
das Erlebnis, -se\tпереживание, событие\tB1.1\tnoun;experience\tСущ. ср. рода, мн.ч. с -se\tManfred erzählt von seinem Glückserlebnis.\tМанфред рассказывает о своём счастливом событии.
der Artikel, -\tстатья\tB1.1\tnoun;media\tСущ. муж. рода, мн.ч. без окончания\tEllas Artikel wird pünktlich fertig.\tСтатья Эллы будет готова вовремя.
weg sein (ist weg gewesen)\tпропасть, исчезнуть\tB1.1\tverb;state\tГлагол — отсутствовать или исчезнуть\tSo lange, bis viel Geld weg war.\tДо тех пор, пока не пропало много денег.`

interface UploadDialogProps {
  onUpload: (rows: ParsedCardRow[], newDeckName?: string) => Promise<void>
  trigger?: React.ReactNode
  /** if true, also asks for a deck name (used when creating a brand-new deck) */
  askDeckName?: boolean
}

export function UploadDialog({ onUpload, trigger, askDeckName }: UploadDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [paste, setPaste] = React.useState("")
  const [deckName, setDeckName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const submit = async (rows: ParsedCardRow[]) => {
    if (askDeckName && !deckName.trim()) {
      toast.error("Введите название набора карточек")
      return
    }
    setBusy(true)
    await onUpload(rows, askDeckName ? deckName.trim() : undefined)
    setBusy(false)
    setOpen(false)
    setPaste("")
    setDeckName("")
    toast.success(`Загружено карточек: ${rows.length}`)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const { cards, error } = parseVocabText(e.target?.result as string)
      if (error) toast.error(error)
      else submit(cards)
    }
    reader.readAsText(file, "UTF-8")
  }

  const handlePasteSubmit = () => {
    const { cards, error } = parseVocabText(paste)
    if (error) toast.error(error)
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
            <Upload className="h-4 w-4" /> Загрузить карточки
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузить карточки</DialogTitle>
          <DialogDescription>TSV или CSV — первая строка заголовки</DialogDescription>
        </DialogHeader>

        {askDeckName && (
          <div className="space-y-1.5">
            <Label htmlFor="deck-name">Название набора</Label>
            <Input
              id="deck-name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="например, Schritte Plus B1.1"
            />
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
          <div className="font-medium">Столбцы:</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="success" className="text-[10px]">word</Badge>
            <Badge variant="success" className="text-[10px]">translation</Badge>
            <Badge variant="outline" className="text-[10px]">group</Badge>
            <Badge variant="outline" className="text-[10px]">tags</Badge>
            <Badge variant="outline" className="text-[10px]">description</Badge>
            <Badge variant="outline" className="text-[10px]">example_de</Badge>
            <Badge variant="outline" className="text-[10px]">example_ru</Badge>
          </div>
          <p className="text-muted-foreground">Разделитель: Tab или запятая. Теги через «;»</p>
        </div>

        <Tabs defaultValue="file">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file">Файл</TabsTrigger>
            <TabsTrigger value="paste">Вставить</TabsTrigger>
            <TabsTrigger value="demo">Демо</TabsTrigger>
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
              <p className="text-sm font-medium">Перетащите файл или нажмите</p>
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
              Загрузить
            </Button>
          </TabsContent>

          <TabsContent value="demo" className="space-y-2">
            <p className="text-sm text-muted-foreground text-center py-4">
              3 демо-карточки из Schritte Plus B1.1
            </p>
            <Button onClick={handleDemo} disabled={busy} className="w-full">
              Запустить демо
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  )
}
