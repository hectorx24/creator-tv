import { motion, useReducedMotion } from "motion/react"
import { spring, exitTween } from "@/lib/patreon-tv/motion-tokens"
import { ArrowLeft, Pause, Play, RotateCcw, RotateCw } from "lucide-react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import { creatorById } from "@/integration/catalog"
import { formatClock, KIND_LABEL } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { currentNavId } from "@/navigation/focus-nav"
import { Artwork } from "./artwork"

const SKIP_SECONDS = 10

/**
 * Full-screen audio player. Fades/settles in and out as one opaque layer
 * (opacity + a few px of transform only). Playback lives in the native
 * service, so mounting/unmounting this view never touches the audio.
 *
 * Remote: ←/→ move between controls; on the seek bar they seek ±10 s.
 * ↑/↓ move between header, seek bar and transport controls. OK activates.
 * Rewind / Fast-forward / Play-Pause keys always work. BACK minimises.
 */
export function AudioPlayerScreen({
  item,
  playing,
  position,
  duration,
  onMinimize,
  onTogglePlay,
  onSeek,
  onSkip,
}: {
  item: ContentItem
  playing: boolean
  position: number
  duration: number
  onMinimize: () => void
  onTogglePlay: () => void
  onSeek: (pos: number) => void
  onSkip: (delta: number) => void
}) {
  const creator = creatorById(item.creatorId)
  const reduced = useReducedMotion()

  useTvInput(
    (action) => {
      switch (action) {
        case "back":
          onMinimize()
          return true
        case "rewind":
          onSkip(-SKIP_SECONDS)
          return true
        case "forward":
          onSkip(SKIP_SECONDS)
          return true
        case "playpause":
          onTogglePlay()
          return true
        case "left":
        case "right":
          if (currentNavId() === "audio-seek") {
            onSkip(action === "left" ? -SKIP_SECONDS : SKIP_SECONDS)
            return true
          }
          return false // move between controls
        case "ok":
          onTogglePlay() // only reached when a non-button (the seek bar) has focus
          return true
        default:
          return false
      }
    },
    { modal: true },
  )

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
          style={{ background: "radial-gradient(55% 55% at 50% 30%, var(--ptv-accent-soft) 0%, transparent 70%)" }}
        />

        <header className="relative z-10 flex flex-shrink-0 items-center justify-between">
          <button
            type="button"
            data-nav
            data-nav-id="audio-back"
            onClick={onMinimize}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ color: "var(--ptv-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Biblioteca
          </button>
          <p className="text-sm font-medium" style={{ color: "var(--ptv-muted-dim)" }}>
            Reproduciendo audio
          </p>
        </header>

        <div className="ptv-fill relative z-10 flex items-center justify-center gap-[5vw] py-[2vh]">
          <div
            className="aspect-square flex-shrink-0 overflow-hidden rounded-3xl shadow-2xl"
            style={{ height: "min(100%, 56vh)" }}
          >
            <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
          </div>

          <div className="flex w-full max-w-md min-w-0 flex-col items-start gap-[1.4vh] text-left">
            <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "var(--ptv-accent)" }}>
              {KIND_LABEL[item.kind].toUpperCase()}
            </p>
            <h1 className="ptv-h1 line-clamp-3 font-bold text-balance">{item.title}</h1>
            <p className="text-sm font-medium" style={{ color: "var(--ptv-muted)" }}>
              {creator?.name}
            </p>

            <div className="mt-2 w-full">
              <input
                type="range"
                data-nav
                data-nav-id="audio-seek"
                min={0}
                max={duration || 0}
                value={Math.min(position, duration)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Posición de reproducción"
                className="w-full"
                style={{ accentColor: "var(--ptv-accent)" }}
              />
              <div className="mt-1 flex justify-between text-xs" style={{ color: "var(--ptv-muted-dim)" }}>
                <span>{formatClock(position)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-6">
              <button
                type="button"
                data-nav
                data-nav-id="audio-back10"
                onClick={() => onSkip(-SKIP_SECONDS)}
                aria-label="Retroceder 10 segundos"
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ color: "var(--ptv-muted)" }}
              >
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-nav
                data-nav-default
                data-nav-id="audio-play"
                onClick={onTogglePlay}
                aria-label={playing ? "Pausar" : "Reproducir"}
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "var(--ptv-text)", color: "#17141a" }}
              >
                {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
              </button>
              <button
                type="button"
                data-nav
                data-nav-id="audio-fwd10"
                onClick={() => onSkip(SKIP_SECONDS)}
                aria-label="Adelantar 10 segundos"
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ color: "var(--ptv-muted)" }}
              >
                <RotateCw className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <footer
          className="relative z-10 flex flex-shrink-0 items-center justify-between text-xs"
          style={{ color: "var(--ptv-muted-dim)" }}
        >
          <span>↑ ↓ Moverse · ← → Elegir / Buscar ±10 s · OK Activar · Atrás Minimizar</span>
          <span className="ptv-footer-brand">Patreon TV Personal</span>
        </footer>
      </div>
    </motion.div>
  )
}
