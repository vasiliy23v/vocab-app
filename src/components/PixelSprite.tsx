import { cn } from "@/lib/utils"

/**
 * Shared pixel-art sprite renderer. Sprites are written as string maps —
 * one character per pixel — and drawn as 1×1 SVG rects, so they stay crisp
 * at any size with no raster asset to ship. Two poses alternate on a hard
 * `steps(1)` cut (the classic two-cel loop) rather than a CSS crossfade,
 * which would blur the pixels into mush.
 *
 * Palette, shared so every character reads as the same art set:
 *   H helm/hair-dark   F face      B armor/bodice   T tunic (app accent)
 *   S steel/blade      G leather   D shield/wood    L boots
 *   R hair (warm)      A accent-light             W white/highlight
 */
export const PIXEL_PALETTE: Record<string, string> = {
  H: "#78909c",
  F: "#f2c39b",
  B: "#546e7a",
  T: "#c2410c",
  S: "#eceff1",
  G: "#8d6e63",
  D: "#a1662f",
  L: "#4e342e",
  R: "#b45309",
  A: "#fb923c",
  W: "#ffffff",
}

function Cels({ rows, className }: { rows: string[]; className?: string }) {
  return (
    <g className={className}>
      {rows.flatMap((row, y) =>
        row.split("").map((ch, x) => {
          const fill = PIXEL_PALETTE[ch]
          if (!fill) return null
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
        })
      )}
    </g>
  )
}

/**
 * Renders a two-frame pixel sprite. Both cels stay mounted and only flip
 * opacity, so the browser never re-rasterises mid-cycle. Under
 * prefers-reduced-motion nothing animates and frame A alone is shown,
 * which still reads as the character standing still.
 */
export function PixelSprite({
  frames,
  width,
  height,
  className,
  bob = true,
}: {
  frames: [string[], string[]]
  width: number
  height: number
  className?: string
  /** Adds the 1px vertical bounce. Off for portraits that shouldn't hop. */
  bob?: boolean
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={cn(bob && "motion-safe:animate-sprite-bob", className)}
      role="img"
      aria-hidden
    >
      <Cels rows={frames[0]} className="motion-safe:animate-sprite-frame-a" />
      <Cels rows={frames[1]} className="opacity-0 motion-safe:animate-sprite-frame-b" />
    </svg>
  )
}
