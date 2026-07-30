import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Hero shop — spend earned 🔥 on characters.
 *
 * Nothing is purchasable yet: the whole catalogue renders blurred behind a
 * "coming soon" overlay, so the feature is visible and gives students a
 * reason to keep earning flames before any of it is wired to the backend.
 * Heroes are hardcoded placeholders on purpose — there's no shop table
 * yet, and inventing one before the pricing/ownership rules exist would
 * mean a migration we'd have to redo.
 */
const HEROES: { emoji: string; nameKey: string; price: number }[] = [
  { emoji: "🧙", nameKey: "shop.heroMage", price: 50 },
  { emoji: "⚔️", nameKey: "shop.heroWarrior", price: 120 },
  { emoji: "🏹", nameKey: "shop.heroArcher", price: 200 },
  { emoji: "🐉", nameKey: "shop.heroDragon", price: 500 },
]

export default function ShopPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const flames = profile?.flames_count ?? 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("shop.title")}</h1>
        <span
          title={t("shop.balanceHint")}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
        >
          <span aria-hidden>🔥</span>
          {flames}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{t("shop.desc")}</p>

      {/* The catalogue is inert: blurred, non-interactive, and hidden from
          screen readers, with a single "coming soon" note announced instead. */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none grid select-none grid-cols-2 gap-3 blur-[1.5px] sm:grid-cols-4"
        >
          {HEROES.map((hero) => (
            <HeroCard key={hero.nameKey} hero={hero} label={t(hero.nameKey)} flameLabel={t("shop.priceFlames")} />
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-orange-200 bg-background/80 px-5 py-2 text-base font-semibold text-orange-700 shadow-sm backdrop-blur-sm dark:border-orange-900 dark:text-orange-300">
            {t("shop.comingSoon")}
          </span>
        </div>
      </div>
    </div>
  )
}

function HeroCard({
  hero,
  label,
  flameLabel,
}: {
  hero: { emoji: string; price: number }
  label: string
  flameLabel: string
}) {
  return (
    <Card className={cn("flex flex-col items-center gap-2 p-4 text-center")}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-50 text-4xl dark:from-orange-950 dark:to-amber-950">
        <span aria-hidden>{hero.emoji}</span>
      </div>
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span aria-hidden>🔥</span>
        <span>
          {hero.price} {flameLabel}
        </span>
      </div>
    </Card>
  )
}
