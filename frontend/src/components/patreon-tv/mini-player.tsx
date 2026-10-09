import { motion, useReducedMotion } from "motion/react"
import { spring, exitTween } from "@/lib/patreon-tv/motion-tokens"
import { Pause, Play, X } from "lucide-react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import { Artwork } from "./artwork"
import { formatClock } from "@/lib/patreon-tv/format"

/**
 * Minimised audio player, docked bottom-right inside the TV safe area.
 *
 * - Three real, sibling buttons (expand · play/pause · close) so the D-pad can
 *   reach each one; no nested interactive elements.
 * - Only `opacity` and `transform` animate (no shared-layout scaling, which is
 *   what distorted the old player while it morphed between sizes).
 * - Progress is a `scaleX` transform on a fixed-width track: no layout work
 *   on every position update.
 */
export function MiniPlayer({
  item,
  playing,
  position,
  duration,
  onExpand,
  onTogglePlay,
  onClose,
}: {
  item: ContentItem
  playing: boolean
  position: number
  duration: number
  onExpand: () => void
  onTogglePlay: () => void
  onClose: () => void
}) {
  const reduced = useReducedMotion()
  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0

  return (
    <motion.div
      data-tv-dock
      className="ptv-mini flex items-center gap-2 rounded-2xl p-2 shadow-2xl"
      style={{ background: "var(--ptv-raised)", border: "1px solid var(--ptv-line)" }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.94 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97, transition: exitTween }}
      transition={spring.bouncy}
      role="group"
      aria-label="Reproductor minimizado"
    >
      <button
        type="button"
        data-nav
        data-nav-id="mini-expand"
        onClick={onExpand}
        aria-label={`Abrir reproductor: ${item.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left"
      >
        <span className="block h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg">
          <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
        </span>
        <span className="block min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.title}</span>
          <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--ptv-line)" }}>
            <span className="ptv-mini-progress block" style={{ transform: `scaleX(${ratio})` }} />
          </span>
        </span>
      </button>

      <button
        type="button"
        data-nav
        data-nav-id="mini-play"
        onClick={onTogglePlay}
        aria-label={playing ? "Pausar" : "Reproducir"}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--ptv-text)", color: "#17141a" }}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </button>

      <button
        type="button"
        data-nav
        data-nav-id="mini-close"
        onClick={onClose}
        aria-label="Cerrar reproductor"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
        style={{ color: "var(--ptv-muted)" }}
      >
        <X className="h-4 w-4" />
      </button>

      <p className="sr-only">
        {formatClock(position)} de {formatClock(duration)}
      </p>
    </motion.div>
  )
}
