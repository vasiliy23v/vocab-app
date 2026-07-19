import type { Card, Deck } from "@/types/db"

const COLUMNS = [
  { header: "Deck", key: "deck", width: 26 },
  { header: "Deck (EN)", key: "deckEn", width: 26 },
  { header: "Word (DE)", key: "wordDe", width: 24 },
  { header: "Translation (RU)", key: "translationRu", width: 24 },
  { header: "Translation (EN)", key: "translationEn", width: 24 },
  { header: "Group", key: "group", width: 20 },
  { header: "Group (EN)", key: "groupEn", width: 20 },
  { header: "Tags", key: "tags", width: 18 },
  { header: "Description", key: "description", width: 40 },
  { header: "Description (EN)", key: "descriptionEn", width: 40 },
  { header: "Example (DE)", key: "exampleDe", width: 40 },
  { header: "Example (RU)", key: "exampleRu", width: 40 },
  { header: "Example (EN)", key: "exampleEn", width: 40 },
]

/**
 * Builds a single-sheet .xlsx with every card from the given template
 * decks — one row per card, every translatable field as its own column
 * — and triggers a browser download. Loads exceljs lazily (dynamic
 * import) so its ~900KB bundle only loads for the superadmin who
 * actually clicks Export, not on every page load.
 */
export async function exportTemplateDecksToExcel(decks: Deck[], cardsByDeck: Map<string, Card[]>) {
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Flashcards · German"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Cards")
  sheet.columns = COLUMNS

  sheet.getRow(1).font = { bold: true }

  for (const deck of decks) {
    const cards = cardsByDeck.get(deck.id) ?? []
    for (const card of cards) {
      sheet.addRow({
        deck: deck.name,
        deckEn: deck.name_en,
        wordDe: card.word_de,
        translationRu: card.translation_ru,
        translationEn: card.translation_en,
        group: card.group,
        groupEn: card.group_en,
        tags: (card.tags ?? []).join("; "),
        description: card.description,
        descriptionEn: card.description_en,
        exampleDe: card.example_de,
        exampleRu: card.example_ru,
        exampleEn: card.example_en,
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `vocab-templates-${stamp}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
