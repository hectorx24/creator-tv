import type { SVGAttributes } from "react"
import { motion, useReducedMotion } from "motion/react"

export function PatreonTvLogo({ className, ...props }: SVGAttributes<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Creator TV" className={className} {...props}>
      <title>Creator TV</title>
      <rect width="128" height="128" rx="28" fill="#101827" />
      <path d="M35 91V61a29 29 0 0 1 58 0v30" fill="none" stroke="#ff9d8d" strokeWidth="13" strokeLinecap="butt" />
      <path d="m54 49 29 19-29 19Z" fill="#fff" />
    </svg>
  )
}

/**
 * The same mark, assembling itself: tile settles in, the coral arch draws, the play triangle
 * pops with a spring. Re-runs whenever `runKey` changes.
 * SVG transforms + stroke-dashoffset only: cheap on Chromecast HD.
 */
export function AnimatedLogo({ className, runKey = 0, delay = 0 }: { className?: string; runKey?: number; delay?: number }) {
  const reduced = useReducedMotion()
  if (reduced) return <PatreonTvLogo className={className} />
  const d = delay
  return (
    <svg key={runKey} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Creator TV" className={className} style={{ overflow: "visible" }}>
      <motion.rect
        width="128"
        height="128"
        rx="28"
        fill="#101827"
        style={{ originX: "64px", originY: "64px" }}
        initial={{ scale: 0.55, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18, delay: d }}
      />
      <motion.path
        d="M35 91V61a29 29 0 0 1 58 0v30"
        fill="none"
        stroke="#ff9d8d"
        strokeWidth="13"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.75, ease: [0.65, 0, 0.35, 1], delay: d + 0.22 }, opacity: { duration: 0.01, delay: d + 0.22 } }}
      />
      <motion.path
        d="m54 49 29 19-29 19Z"
        fill="#fff"
        style={{ originX: "64px", originY: "68px" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 25, delay: d + 0.78 }}
      />
    </svg>
  )
}
