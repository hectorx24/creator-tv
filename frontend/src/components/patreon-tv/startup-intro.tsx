import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { AnimatedLogo } from "./logo"

const MIN_MS = 1700 // the mark finishes assembling (~1.6 s)
const MAX_MS = 10000 // never trap the user if the session check hangs

/**
 * Brand intro and session gate: it stays until the session is known and the mark has formed,
 * so a valid session never flashes the Login screen. While waiting the mark breathes; on exit
 * it zooms through the screen. Transform/opacity only.
 */
export function StartupIntro({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const reduced = useReducedMotion()
  const [minDone, setMinDone] = useState(false)
  const done = useRef(false)

  const finish = () => {
    if (done.current) return
    done.current = true
    onComplete()
  }

  useEffect(() => {
    const min = setTimeout(() => setMinDone(true), reduced ? 150 : MIN_MS)
    const max = setTimeout(finish, MAX_MS)
    return () => {
      clearTimeout(min)
      clearTimeout(max)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  useEffect(() => {
    if (ready && minDone) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#08080b]"
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.45, ease: "easeIn" }}
      aria-label="Creator TV"
    >
      {!reduced && (
        <motion.div
          aria-hidden="true"
          className="absolute h-[60vh] w-[60vh] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,133,105,0.22) 0%, rgba(255,133,105,0) 66%)" }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      )}
      <motion.div
        className="h-[26vh] w-[26vh]"
        animate={minDone && !ready && !reduced ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={minDone && !ready ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        exit={reduced ? undefined : { scale: 7, opacity: 0, transition: { duration: 0.5, ease: [0.7, 0, 0.84, 0] } }}
      >
        <AnimatedLogo className="h-full w-full" />
      </motion.div>
    </motion.div>
  )
}
