import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { spring, exitTween } from "@/lib/patreon-tv/motion-tokens"
import { Gauge, Pause, Play } from "lucide-react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import { creatorById } from "@/integration/catalog"
import { formatClock, KIND_LABEL } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { getPrefs, nextSpeed, setPrefs, speedLabel } from "@/lib/patreon-tv/progress"
import { Artwork } from "./artwork"
import { WavyProgress } from "./wavy-progress"

const STEP = 10

/**
 * Full-screen audio player, driven like a native TV player (no on-screen buttons to reach):
 *   ← / →   rewind / forward 10 s per press; quick presses add up, the jump lands when you stop
 *   OK      play / pause
 *   ↓       options (speed) · ↑ or BACK closes them
 *   BACK    minimise to the mini-player (audio keeps playing in the native service)
 */
export function AudioPlayerScreen({
  item,
  playing,
  position,
  duration,
  onMinimize,
  onTogglePlay,
  onSeek,
}: {
  item: ContentItem
  playing: boolean
  position: number
  duration: number
  onMinimize: () => void
  onTogglePlay: () => void
  onSeek: (pos: number) => void
  onSkip?: (delta: number) => void
}) {
  const creator = creatorById(item.creatorId)
  const reduced = useReducedMotion()
  const [scrub, setScrub] = useState<number | null>(null)
  const [nudgeDir, setNudgeDir] = useState<0 | 1 | -1>(0)
  const [menu, setMenu] = useState(false)
  const [speed, setSpeed] = useState(getPrefs().audioSpeed)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const nudge = (dir: 1 | -1) => {
    const base = scrub ?? position
    const next = Math.max(0, Math.min(duration || base + STEP, base + dir * STEP))
    setScrub(next)
    setNudgeDir(dir)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSeek(next)
      setNudgeDir(0)
      setTimeout(() => setScrub(null), 700) // let the native position catch up
    }, 650)
  }

  const cycleSpeed = () => {
    const s = nextSpeed(speed)
    setSpeed(s)
    setPrefs({ audioSpeed: s })
    window.PersonalAudio?.setSpeed?.(s)
  }

  useTvInput(
    (action) => {
      if (menu) {
        if (action === "ok") cycleSpeed()
        else if (action === "up" || action === "back" || action === "down") setMenu(false)
        else if (action === "playpause") onTogglePlay()
        return true
      }
      switch (action) {
        case "back":
          onMinimize()
          return true
        case "left":
        case "rewind":
          nudge(-1)
          return true
        case "right":
        case "forward":
          nudge(1)
          return true
        case "ok":
        case "playpause":
          onTogglePlay()
          return true
        case "down":
          setMenu(true)
          return true
        default:
          return true
      }
    },
    { modal: true },
  )

  const shown = scrub ?? position
  const delta = scrub !== null ? scrub - position : 0

  return (
    <motion.div
      data-tv-screen
      className="ptv-overlay"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: exitTween }}
      transition={spring.soft}
    >
      <div className="ptv-screen">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(55% 55% at 30% 45%, var(--ptv-accent-soft) 0%, transparent 70%)" }}
        />

        <div className="ptv-fill relative z-10 flex items-center justify-center gap-[5vw]">
          {/* The cover breathes with playback (smaller when paused) and leans toward the seek direction. */}
          <motion.div
            className="aspect-square flex-shrink-0 overflow-hidden rounded-[32px]"
            style={{ height: "58vh", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.9)" }}
            animate={{ scale: playing ? 1 : 0.92, x: nudgeDir * 10 }}
            transition={{ type: "spring", stiffness: 130, damping: 18 }}
          >
            <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
          </motion.div>

          <div className="flex w-full max-w-[42vw] min-w-0 flex-col items-start gap-[1.6vh]">
            <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "var(--ptv-accent)" }}>
              {KIND_LABEL[item.kind].toUpperCase()} · {creator?.name}
            </p>
            <h1 className="ptv-h1 line-clamp-3 font-bold text-balance">{item.title}</h1>

            <div className="mt-[3vh] w-full">
              <WavyProgress value={duration ? shown / duration : 0} playing={playing && scrub === null} thick={6} />
              <div className="mt-2 flex items-center justify-between text-sm tabular-nums" style={{ color: "var(--ptv-muted-dim)" }}>
                <motion.span
                  className="origin-left font-semibold"
                  animate={{ scale: scrub !== null ? 1.3 : 1, color: scrub !== null ? "#ffffff" : "rgba(255,255,255,0.55)" }}
                  transition={{ type: "spring", stiffness: 250, damping: 25 }}
                >
                  {formatClock(shown)}
                </motion.span>
                <AnimatePresence>
                  {delta !== 0 && (
                    <motion.span
                      key="delta"
                      className="rounded-full px-3 py-0.5 text-xs font-bold"
                      style={{ background: "var(--ptv-text)", color: "#17141a" }}
                      initial={{ opacity: 0, y: 6, scale: 0.7 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    >
                      {delta > 0 ? "+" : "−"}
                      {formatClock(Math.abs(delta))}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span>{formatClock(duration)}</span>
              </div>
            </div>

            <div className="relative mt-[2vh] flex items-center gap-4">
              <motion.div
                className="flex h-[9vh] w-[9vh] items-center justify-center rounded-full"
                style={{ background: "var(--ptv-text)", color: "#17141a" }}
                animate={{ scale: playing ? 1 : 1.06 }}
                transition={{ type: "spring", stiffness: 210, damping: 23 }}
              >
                <motion.span
                  key={playing ? "pause" : "play"}
                  className="flex"
                  initial={{ scale: 0.3, rotate: playing ? -90 : 90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                >
                  {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
                </motion.span>
              </motion.div>
              {speed !== 1 && !menu && (
                <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: "rgba(255,255,255,0.1)" }}>
                  {speedLabel(speed)}
                </span>
              )}

              <AnimatePresence>
                {menu && (
                  <motion.div
                    className="flex items-center gap-3 rounded-full py-2 pl-4 pr-5 text-sm font-semibold"
                    style={{ background: "var(--ptv-text)", color: "#17141a", transformOrigin: "left center" }}
                    initial={{ opacity: 0, scale: 0.6, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.22 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  >
                    <Gauge className="h-4 w-4" />
                    Velocidad
                    <motion.span
                      key={speed}
                      className="tabular-nums"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    >
                      {speedLabel(speed)}
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
