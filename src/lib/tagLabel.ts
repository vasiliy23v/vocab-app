/**
 * Tags are stored as one shared `text[]` per card — plain English slugs
 * like "noun" or "travel", with no per-language column behind them, so
 * unlike a translation or an example there is nothing in the card data to
 * show instead. They are a small closed vocabulary though, so a lookup
 * covers them: every slug the uploaded decks actually use, in the four
 * languages the app studies.
 *
 * Keyed by language code rather than by interface locale, because a tag is
 * part of the card's own language side — the same rule the topic and the
 * grammar note follow.
 *
 * Anything not listed falls through as the raw slug. That keeps a freshly
 * invented tag readable instead of blank, and means adding one is optional
 * rather than a prerequisite for uploading.
 */
const TAG_LABELS: Record<string, Partial<Record<string, string>>> = {
  // parts of speech
  noun: { de: "Substantiv", ru: "существительное", en: "noun", uk: "іменник" },
  verb: { de: "Verb", ru: "глагол", en: "verb", uk: "дієслово" },
  adjective: { de: "Adjektiv", ru: "прилагательное", en: "adjective", uk: "прикметник" },
  adverb: { de: "Adverb", ru: "наречие", en: "adverb", uk: "прислівник" },
  preposition: { de: "Präposition", ru: "предлог", en: "preposition", uk: "прийменник" },
  separable: { de: "trennbar", ru: "отделяемый", en: "separable", uk: "відокремлюваний" },
  phrase: { de: "Wendung", ru: "выражение", en: "phrase", uk: "вислів" },

  // topics
  home: { de: "Zuhause", ru: "дом", en: "home", uk: "дім" },
  household: { de: "Haushalt", ru: "быт", en: "household", uk: "побут" },
  furniture: { de: "Möbel", ru: "мебель", en: "furniture", uk: "меблі" },
  work: { de: "Arbeit", ru: "работа", en: "work", uk: "робота" },
  job: { de: "Beruf", ru: "профессия", en: "job", uk: "професія" },
  education: { de: "Bildung", ru: "образование", en: "education", uk: "освіта" },
  money: { de: "Geld", ru: "деньги", en: "money", uk: "гроші" },
  shopping: { de: "Einkaufen", ru: "покупки", en: "shopping", uk: "покупки" },
  daily: { de: "Alltag", ru: "повседневное", en: "daily life", uk: "щоденне" },
  action: { de: "Handlung", ru: "действие", en: "action", uk: "дія" },
  communication: { de: "Kommunikation", ru: "общение", en: "communication", uk: "спілкування" },
  phone: { de: "Telefon", ru: "телефон", en: "phone", uk: "телефон" },
  speech: { de: "Sprechen", ru: "речь", en: "speech", uk: "мовлення" },
  media: { de: "Medien", ru: "медиа", en: "media", uk: "медіа" },
  document: { de: "Dokument", ru: "документ", en: "document", uk: "документ" },
  transport: { de: "Verkehr", ru: "транспорт", en: "transport", uk: "транспорт" },
  travel: { de: "Reisen", ru: "путешествия", en: "travel", uk: "подорожі" },
  place: { de: "Ort", ru: "место", en: "place", uk: "місце" },
  food: { de: "Essen", ru: "еда", en: "food", uk: "їжа" },
  health: { de: "Gesundheit", ru: "здоровье", en: "health", uk: "здоров'я" },
  sport: { de: "Sport", ru: "спорт", en: "sport", uk: "спорт" },
  leisure: { de: "Freizeit", ru: "досуг", en: "leisure", uk: "дозвілля" },
  tech: { de: "Technik", ru: "техника", en: "tech", uk: "техніка" },
  people: { de: "Menschen", ru: "люди", en: "people", uk: "люди" },
  character: { de: "Charakter", ru: "характер", en: "character", uk: "характер" },
  emotion: { de: "Gefühl", ru: "эмоции", en: "emotion", uk: "емоції" },
  greeting: { de: "Begrüßung", ru: "приветствие", en: "greeting", uk: "привітання" },
  event: { de: "Ereignis", ru: "событие", en: "event", uk: "подія" },
  experience: { de: "Erlebnis", ru: "переживание", en: "experience", uk: "переживання" },
  object: { de: "Gegenstand", ru: "предмет", en: "object", uk: "предмет" },
  quantity: { de: "Menge", ru: "количество", en: "quantity", uk: "кількість" },
  state: { de: "Zustand", ru: "состояние", en: "state", uk: "стан" },
  abstract: { de: "abstrakt", ru: "абстрактное", en: "abstract", uk: "абстрактне" },
}

export function tagLabel(tag: string, language: string): string {
  return TAG_LABELS[tag.trim().toLowerCase()]?.[language] ?? tag
}
