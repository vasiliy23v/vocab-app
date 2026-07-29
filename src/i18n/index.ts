import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import ru from "@/i18n/locales/ru.json"
import en from "@/i18n/locales/en.json"
import de from "@/i18n/locales/de.json"
import uk from "@/i18n/locales/uk.json"

export const SUPPORTED_LANGUAGES = ["uk", "ru", "en", "de"] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = "vocab-app-language"

function detectInitialLanguage(): AppLanguage {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === "ru" || stored === "en") return stored

    const browserLang = window.navigator.language?.toLowerCase() ?? ""
    if (browserLang.startsWith("en")) return "en"
  }
  return "ru"
}

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    de: { translation: de },
    uk: { translation: uk },
  },
  lng: detectInitialLanguage(),
  fallbackLng: "ru",
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
})

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language
}

i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng
  }
})

export default i18n
