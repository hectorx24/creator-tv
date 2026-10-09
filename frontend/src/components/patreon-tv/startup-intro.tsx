import { useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"
import { PatreonTvLogo } from "./logo"

export function StartupIntro({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, reducedMotion ? 200 : 2000)
    return () => clearTimeout(timer)
  }, [onComplete, reducedMotion])

  return (
    <motion.div
      onClick={onComplete}
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-[#080b14]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.25, ease: "easeOut" }}
      onAnimationComplete={() => {
        if (reducedMotion) onComplete()
      }}
    >
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="h-40 w-40 rounded-[28px] shadow-[0_18px_60px_rgba(255,133,105,0.14)] sm:h-48 sm:w-48"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <PatreonTvLogo className="h-full w-full rounded-[28px] object-cover" />
        </motion.div>
        <motion.span
          className="text-sm font-semibold tracking-[0.28em] text-white/75"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 0.65 }}
        >
          PATREON TV
        </motion.span>
      </motion.div>
      {!reducedMotion && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.35, delay: 1.55 }}
          onAnimationComplete={onComplete}
        />
      )}
    </motion.div>
  )
}
