import { PixelSprite } from "@/components/PixelSprite"

// 12 wide × 16 tall, same grid and palette as PixelWarrior so the two read
// as one art set. Frame A: hair and skirt swept out, arms raised. Frame B:
// hair tucked, arms lowered, feet shifted — a gentle idle sway.
const FRAME_A = [
  "....RRRR....",
  "...RRRRRR...",
  "...RFFFFR...",
  "...RLFLFR...",
  "...RAFFAR...",
  "...RRFFRR...",
  "..RR.BB.RR..",
  "..RRTTTTRR..",
  "...RTTTTR...",
  "....TTTT....",
  "...TTTTTT...",
  "..TTTTTTTT..",
  "..TTTTTTTT..",
  "....F..F....",
  "...LL..LL...",
  "...LL..LL...",
]

const FRAME_B = [
  "....RRRR....",
  "...RRRRRR...",
  "...RFFFFR...",
  "...RLFLFR...",
  "...RAFFAR...",
  "...RRFFRR...",
  "...R.BB.R...",
  "...RTTTTR...",
  "..RRTTTTRR..",
  "....TTTT....",
  "...TTTTTT...",
  "...TTTTTT...",
  "..TTTTTTTT..",
  "....F..F....",
  "...LL..LL...",
  "..LL....LL..",
]

/** Pixel-art heroine — the study app's mascot. */
export function PixelHeroine({ className }: { className?: string }) {
  return <PixelSprite frames={[FRAME_A, FRAME_B]} width={12} height={16} className={className ?? "h-9 w-auto"} />
}
