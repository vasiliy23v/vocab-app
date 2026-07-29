export type MarkStatus = "known" | "unknown" | "repeat"
export type UserRole = "user" | "superadmin"
export type Language = "ru" | "en" | "de" | "uk" | "fr" | "es" | "it" | "pt" | "pl" | "ja" | "zh" | "ko"

export interface Profile {
  id: string
  email: string
  display_name: string | null
  created_at: string
  role: UserRole
  /** Buzz on each correct / "I know it!" answer during study. */
  vibrate_on_correct: boolean
  /** Consecutive days with at least one finished study session. */
  current_streak: number
  longest_streak: number
  /** Local-date (YYYY-MM-DD) of the last finished session; drives streak math. */
  last_study_date: string | null
  /** Fixed level size for the leveled learning path — null until the
   *  student picks one (asked once, then remembered). */
  words_per_day: number | null
  /** Language to learn from (e.g. "en" to learn German from English) */
  language_from: Language
  /** Language to learn (e.g. "de" for German) */
  language_to: Language
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
  name_en: string
  created_by: string
  created_at: string
  is_template: boolean
}

export interface DeckAssignment {
  id: string
  template_deck_id: string
  student_id: string
  assigned_deck_id: string | null
  assigned_by: string | null
  assigned_at: string
}

// row shape returned by the admin_list_profiles() RPC
export interface AdminProfileRow {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
  deck_count: number
  card_count: number
  teacher_count: number
  student_count: number
}

export interface Card {
  id: string
  deck_id: string
  owner_id: string
  word_de: string
  translation_ru: string
  translation_en: string
  group: string
  group_en: string
  tags: string[]
  description: string
  description_en: string
  example_de: string
  example_ru: string
  example_en: string
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
  deck_is_template: boolean
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
  translation_en: string
  group: string
  group_en: string
  tags: string[]
  description: string
  description_en: string
  example_de: string
  example_ru: string
  example_en: string
}

// Multilingual system types
export interface LanguageInfo {
  code: Language
  name: string
  native_name: string
  direction: "ltr" | "rtl"
  created_at: string
}

export interface LanguagePair {
  id: string
  language_from: Language
  language_to: Language
  created_at: string
}

export interface WordTranslation {
  id: string
  card_id: string
  language: Language
  text: string
  created_at: string
}

export interface WordExample {
  id: string
  card_id: string
  language: Language
  text: string
  created_at: string
}

export interface WordDescription {
  id: string
  card_id: string
  language: Language
  text: string
  created_at: string
}

// Extended parsed card row for multilingual imports
export interface MultilingualCardRow {
  word: Record<Language, string> // {"de": "das Haus", "ru": "дом", "en": "house", "uk": "дім"}
  translations: Record<Language, string> // Language→Language translations
  examples: Record<Language, string> // Examples in different languages
  descriptions: Record<Language, string> // Descriptions in different languages
  group: Record<Language, string> // Group names in different languages
  tags: string[]
}
