export type MarkStatus = "known" | "unknown" | "repeat"

export interface Profile {
  id: string
  email: string
  display_name: string | null
  created_at: string
}

export interface TeacherLink {
  id: string
  student_id: string
  teacher_id: string
  created_at: string
}

export interface Invite {
  id: string
  code: string
  student_id: string
  created_at: string
  expires_at: string
  redeemed_at: string | null
  redeemed_by: string | null
}

export interface Deck {
  id: string
  owner_id: string
  name: string
  created_by: string
  created_at: string
}

export interface Card {
  id: string
  deck_id: string
  owner_id: string
  word_de: string
  translation_ru: string
  group: string
  tags: string[]
  description: string
  example_de: string
  example_ru: string
  created_by: string | null
  sort_order: number
  created_at: string
}

export interface CardMark {
  id: string
  card_id: string
  student_id: string
  marked_by: string
  is_teacher_mark: boolean
  status: MarkStatus
  updated_at: string
}

export interface CardWithMarks extends Card {
  teacher_status: MarkStatus | null
  teacher_marked_by: string | null
  teacher_marked_at: string | null
  own_status: MarkStatus | null
  own_marked_at: string | null
}

// raw row shape coming back from the parsed TSV/CSV upload, before insert
export interface ParsedCardRow {
  word_de: string
  translation_ru: string
  group: string
  tags: string[]
  description: string
  example_de: string
  example_ru: string
}
