import * as React from "react"

const COLORS = ["#f87171", "#fb923c", "#fbbf24", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"]
const PARTICLES_PER_BURST = 16

// Fixed origin points/timing for each burst — a few staggered "shells"
// scattered across the screen so it reads as one small fireworks show
// rather than a single pop.
const BURSTS = [
  { x: 22, y: 28, delay: 0 },
  { x: 72, y: 22, delay: 200 },
  { x: 50, y: 38, delay: 420 },
  { x: 14, y: 55, delay: 600 },
  { x: 84, y: 48, delay: 760 },
]

// A short buzz timed to land on each burst above (vibrate, pause, vibrate,
// pause, ...). Only does anything on devices/browsers that support the
// Vibration API (mainly Android — iOS Safari and desktop browsers just
// silently ignore the call), so it's a bonus, not something to rely on.
const VIBRATE_PATTERN = [30, 170, 30, 190, 30, 150, 30, 130, 40]

interface Particle {
  id: number
  angle: number
  distance: number
  color: string
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLES_PER_BURST }, (_, i) => ({
    id: i,
    angle: (360 / PARTICLES_PER_BURST) * i + (Math.random() * 16 - 8),
    distance: 55 + Math.random() * 45,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
}

function Burst({ x, y, delay }: { x: number; y: number; delay: number }) {
  const [particles] = React.useState(makeParticles)

  return (
    <div className="firework-burst" style={{ left: `${x}%`, top: `${y}%` }}>
      {particles.map((p) => (
        <span
          key={p.id}
          className="firework-particle"
          style={
            {
              backgroundColor: p.color,
              animationDelay: `${delay}ms`,
              "--angle": `${p.angle}deg`,
              "--distance": `${p.distance}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** A brief, self-contained fireworks burst — mount it when a study round
 *  finishes, and let the parent unmount it (or just leave it; the CSS
 *  animation runs once and stays invisible afterwards). */
export function Fireworks() {
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(VIBRATE_PATTERN)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {BURSTS.map((b, i) => (
        <Burst key={i} x={b.x} y={b.y} delay={b.delay} />
      ))}
    </div>
  )
}
