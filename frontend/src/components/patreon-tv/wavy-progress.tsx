import { motion } from "motion/react"

/** Material 3 Expressive "wavy" linear progress: the played part is a travelling sine wave
 *  (flattens when paused), a small gap, then a flat remaining track and a pill stop.
 *  The wave is one pre-drawn SVG path translated by CSS: no per-frame JS, no layout. */
const WAVELEN = 30
const AMP = 4.5
const WAVE = (() => {
  let d = `M0 ${AMP + 1}`
  for (let x = 0; x <= 2400; x += WAVELEN / 2) {
    const y = (x / (WAVELEN / 2)) % 2 === 0 ? 1 : AMP * 2 + 1
    d += ` Q${x + WAVELEN / 4} ${y} ${x + WAVELEN / 2} ${AMP + 1}`
  }
  return d
})()

export function WavyProgress({ value, playing, thick = 4, className = "" }: { value: number; playing: boolean; thick?: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100
  const h = AMP * 2 + 2 + thick
  return (
    <div className={`relative w-full ${className}`} style={{ height: h }} aria-hidden="true">
      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `max(${playing ? 34 : 0}px, calc(${pct}% - 4px))`, transition: "width 400ms cubic-bezier(.2,.8,.2,1)" }}>
        <motion.svg
          width="2400"
          height={h}
          className="ptv-wave absolute left-0 top-0"
          style={{ animationPlayState: playing ? "running" : "paused" }}
          animate={{ scaleY: playing ? 1 : 0.05 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
        >
          <path d={WAVE} transform={`translate(0 ${thick / 2})`} fill="none" stroke="var(--ptv-accent)" strokeWidth={thick} strokeLinecap="round" />
        </motion.svg>
      </div>
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full"
        style={{ width: `min(calc(100% - ${playing ? 38 : 4}px), max(0px, calc(${100 - pct}% - 4px)))`, height: thick, background: "rgba(255,255,255,0.18)", transition: "width 400ms cubic-bezier(.2,.8,.2,1)" }}
      />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full" style={{ width: thick, height: thick, background: "var(--ptv-accent)" }} />
    </div>
  )
}
