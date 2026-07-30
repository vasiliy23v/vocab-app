import { PixelSprite } from "@/components/PixelSprite"

// 14 wide × 13 tall — wider than the humanoid sprites, same palette. A
// chibi ginger cat with big eyes and a small downturned mouth: it shows up
// when the student is about to abandon a lesson, so it looks a little sad
// on purpose. Frame A/B differ only in the ears and tail, giving a gentle
// twitch-and-swish idle rather than a walk cycle.
const FRAME_A = [
  ".AA........AA.",
  ".AAA......AAA.",
  "..AAAAAAAAAA..",
  ".AAAAAAAAAAAA.",
  ".AAAAAAAAAAAA.",
  ".ALLAAAAAALLA.",
  ".ALLAAAAAALLA.",
  ".AAAASSSSAAAA.",
  ".AAAASTTSAAAA.",
  "..AAALAALAAA..",
  "...AAAAAAAA...",
  "..AAAAAAAAAAR.",
  "..AASSAASSAARR",
]

const FRAME_B = [
  "..A........A..",
  ".AAA......AAA.",
  "..AAAAAAAAAA..",
  ".AAAAAAAAAAAA.",
  ".AAAAAAAAAAAA.",
  ".ALLAAAAAALLA.",
  ".ALLAAAAAALLA.",
  ".AAAASSSSAAAA.",
  ".AAAASTTSAAAA.",
  "..AAALAALAAA..",
  "...AAAAAAAA...",
  "..AAAAAAAAAARR",
  "..AASSAASSAA..",
]

/** Pixel-art cat — the "leaving the lesson?" mascot. */
export function PixelCat({ className }: { className?: string }) {
  return <PixelSprite frames={[FRAME_A, FRAME_B]} width={14} height={13} className={className ?? "h-9 w-auto"} />
}
