import type { TFunction } from "i18next"

/**
 * Name of a *studied* language, written in the interface language.
 *
 * Distinct from the `language.*` keys, which hold endonyms for the
 * interface picker ("Deutsch", "Українська") — those are right for a list
 * of languages to pick from and wrong inside a sentence, where a Russian
 * UI needs "переведи на немецкий", not "переведи на Deutsch".
 *
 * Two forms, because Slavic languages inflect after a preposition:
 *   "name" — standalone, for a heading ("Німецька")
 *   "to"   — after на / to ("переклади на німецьку")
 * English and German spell both the same; the split costs a few keys and
 * saves the Ukrainian and Russian labels from reading as machine output.
 *
 * Falls back to the endonym, then to the raw code, so enabling a fifth
 * language in the database shows "Français" rather than a blank label
 * until someone writes the wording for it.
 */
export function languageName(t: TFunction, code: string, form: "name" | "to" = "name"): string {
  const endonym = t(`language.${code}`, { defaultValue: code })
  return t(`learnLang.${form}.${code}`, { defaultValue: endonym })
}
