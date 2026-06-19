import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useTeacherLinks } from "@/hooks/useTeacherLinks"
import { useDecks, useCards } from "@/hooks/useCards"
import { UploadDialog } from "@/components/UploadDialog"
import { LevelPicker } from "@/components/LevelPicker"
import { WordTable } from "@/components/WordTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { CardWithMarks } from "@/types/db"
import { toast } from "sonner"

export default function TeacherStudentPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { myStudents, loading: linksLoading } = useTeacherLinks()
  const { decks, createDeck } = useDecks(studentId ?? null)
  const [activeDeckId, setActiveDeckId] = React.useState<string | null>(null)
  const [levelSize, setLevelSize] = React.useState(20)
  const [selectedLevel, setSelectedLevel] = React.useState<number | null>(null)

  const student = myStudents.find((s) => s.id === studentId)
  const { cards, addCards, setMark } = useCards(activeDeckId)

  React.useEffect(() => {
    if (decks.length > 0 && !activeDeckId) setActiveDeckId(decks[0].id)
  }, [decks, activeDeckId])

  if (!linksLoading && !student) {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-3">
        <p className="text-sm text-muted-foreground">У вас нет доступа к этому ученику.</p>
        <Button variant="outline" onClick={() => navigate("/people")}>
          ← К списку
        </Button>
      </div>
    )
  }

  const handleUpload = async (rows: any) => {
    if (!studentId || !user) return
    let deckId = activeDeckId
    if (!deckId) {
      const { deck, error } = await createDeck("Слова от учителя", studentId)
      if (error || !deck) {
        toast.error(error || "Ошибка создания набора")
        return
      }
      deckId = deck.id
      setActiveDeckId(deckId)
    }
    const { error } = await addCards(rows, studentId, deckId)
    if (error) toast.error(error)
  }

  const levels = React.useMemo(() => {
    const size = levelSize
    const out: CardWithMarks[][] = []
    for (let i = 0; i < cards.length; i += size) out.push(cards.slice(i, i + size))
    return out
  }, [cards, levelSize])

  const visibleCards = selectedLevel !== null ? levels[selectedLevel] ?? [] : cards

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/people")}>
            ←
          </Button>
          <Avatar>
            <AvatarFallback>{(student?.display_name || student?.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-base font-medium">{student?.display_name || student?.email}</div>
            <div className="text-xs text-muted-foreground">{student?.email}</div>
          </div>
        </div>
        <UploadDialog onUpload={handleUpload} trigger={<Button>+ Добавить слова</Button>} />
      </div>

      {decks.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setActiveDeckId(d.id)
                setSelectedLevel(null)
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                activeDeckId === d.id ? "bg-foreground text-background border-foreground" : "text-muted-foreground"
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Уровни</CardTitle>
        </CardHeader>
        <CardContent>
          <LevelPicker
            items={cards}
            levelSize={levelSize}
            onLevelSizeChange={(n) => {
              setLevelSize(n)
              setSelectedLevel(null)
            }}
            selectedLevel={selectedLevel ?? undefined}
            onSelectLevel={(_lvl, i) => setSelectedLevel(i)}
            onSelectAll={() => setSelectedLevel(null)}
            renderLevelExtra={(lvl) => {
              const known = lvl.filter((c) => c.teacher_status === "known").length
              if (lvl.length === 0) return null
              return (
                <div className="mt-1 text-[10px] text-success">
                  {Math.round((known / lvl.length) * 100)}% знает
                </div>
              )
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedLevel !== null ? `Уровень ${selectedLevel + 1}` : "Все слова"}{" "}
            <span className="text-muted-foreground font-normal">({visibleCards.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <WordTable cards={visibleCards} onMark={setMark} />
        </CardContent>
      </Card>
    </div>
  )
}
