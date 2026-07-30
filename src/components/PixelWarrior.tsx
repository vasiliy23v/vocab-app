import { PixelSprite } from "@/components/PixelSprite"

// 12 wide × 16 tall. Frame A: legs mid-stride, sword low. Frame B: legs
// together, sword raised a pixel — together they read as a step forward.
const FRAME_A = [
  "....HHHH....",
  "...HHHHHH...",
  "...HFFFFH..S",
  "...HFFFFH..S",
  "....FFFF...S",
  "..DDBBBB...S",
  ".DDDBBBB..GS",
  ".DDDTTTT.GG.",
  ".DDDTTTT.G..",
  "..DDTTTT....",
  "....TTTT....",
  "....BBBB....",
  "...LL..LL...",
  "..LL....LL..",
  "..LL....LL..",
  ".LLL....LLL.",
]

const FRAME_B = [
  "....HHHH...S",
  "...HHHHHH..S",
  "...HFFFFH..S",
  "...HFFFFH..S",
  "....FFFF..GS",
  "..DDBBBB..GS",
  ".DDDBBBB.GG.",
  ".DDDTTTT.G..",
  ".DDDTTTT....",
  "..DDTTTT....",
  "....TTTT....",
  "....BBBB....",
  "....LLLL....",
  "....L..L....",
  "...LL..LL...",
  "...LL..LL...",
]

/** Pixel-art warrior — walks the level path, standing on the current level. */
export function PixelWarrior({ className }: { className?: string }) {
  return <PixelSprite frames={[FRAME_A, FRAME_B]} width={12} height={16} className={className ?? "h-9 w-auto"} />
}
