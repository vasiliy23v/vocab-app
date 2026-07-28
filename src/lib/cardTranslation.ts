/**
 * Cards store two translation fields: `translation_ru` (Russian) and
 * `translation_en` (English). Which one is shown depends on the current
 * interface language — this is independent from the i18n system that
 * translates the app's own UI strings.
 */
export interface Translatable {
  translation_ru: string
  translation_en?: string | null
  word_de?: string
}

export function cardTranslation(card: Translatable, language: string): string {
  if (language.startsWith("en")) {
    return card.translation_en?.trim() ? card.translation_en : card.translation_ru
  }
  return card.translation_ru
}

/**
 * Get the front side text based on learning language pair
 * Front shows the "from" language (what user reads)
 */
export function getCardFront(card: Translatable, languageFrom: string): string {
  if (languageFrom === "ru") {
    return card.translation_ru
  }
  if (languageFrom === "en") {
    return card.translation_en?.trim() ? card.translation_en : card.translation_ru
  }
  if (languageFrom === "de") {
    return card.word_de || ""
  }
  return card.translation_ru
}

/**
 * Get the back side text based on learning language pair
 * Back shows the "to" language (what user learns)
 */
export function getCardBack(card: Translatable, languageTo: string): string {
  if (languageTo === "de") {
    return card.word_de || ""
  }
  if (languageTo === "ru") {
    return card.translation_ru
  }
  if (languageTo === "en") {
    return card.translation_en?.trim() ? card.translation_en : card.translation_ru
  }
  return card.word_de || ""
}

/**
 * Topic/group names follow the same pattern: `group` (Russian) is
 * required, `group_en` is optional and falls back to `group` when
 * blank or not provided (e.g. older uploads, or custom groups the
 * user typed without an English name).
 */
export interface GroupTranslatable {
  group: string
  group_en?: string | null
}

export function cardGroupName(card: GroupTranslatable, language: string): string {
  if (language.startsWith("en")) {
    return card.group_en?.trim() ? card.group_en : card.group
  }
  return card.group
}

/**
 * Example sentences follow the same pattern: `example_ru` is the
 * default, `example_en` is optional and falls back to `example_ru`
 * when blank (e.g. older uploads without an English example).
 */
export interface ExampleTranslatable {
  example_ru: string
  example_en?: string | null
  example_de?: string
}

export function cardExample(card: ExampleTranslatable, language: string): string {
  if (language.startsWith("en")) {
    return card.example_en?.trim() ? card.example_en : card.example_ru
  }
  return card.example_ru
}

/**
 * Get the appropriate example based on learning language
 */
export function getCardExample(card: ExampleTranslatable, languageTo: string): string {
  if (languageTo === "de") {
    return card.example_de?.trim() || card.example_ru
  }
  if (languageTo === "en") {
    return card.example_en?.trim() || card.example_ru
  }
  return card.example_ru
}

/**
 * Descriptions (grammar/usage notes, synonyms, gender, etc.) follow the
 * same pattern: `description` (Russian) is the default, `description_en`
 * is optional and falls back to `description` when blank (e.g. older
 * uploads without an English description).
 */
export interface DescriptionTranslatable {
  description: string
  description_en?: string | null
}

export function cardDescription(card: DescriptionTranslatable, language: string): string {
  if (language.startsWith("en")) {
    return card.description_en?.trim() ? card.description_en : card.description
  }
  return card.description
}

/**
 * Deck names are free text typed by whoever created the deck (a student
 * naming their own deck, or a superadmin naming a template) — same
 * fallback pattern: `name` is whatever they typed, `name_en` is optional
 * and falls back to `name` when blank (e.g. decks created before this
 * field existed, or nobody bothered to add an English name).
 */
export interface NameTranslatable {
  name: string
  name_en?: string | null
}

export function deckName(deck: NameTranslatable, language: string): string {
  if (language.startsWith("en")) {
    return deck.name_en?.trim() ? deck.name_en : deck.name
  }
  return deck.name
}
