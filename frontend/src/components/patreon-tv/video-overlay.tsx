import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { exitTween } from "@/lib/patreon-tv/motion-tokens"
import { Pause, Play, X } from "lucide-react"
import Hls from "hls.js"
import type { ContentItem } from "@/lib/patreon-tv/types"
import type { PlaybackStatus, VideoState } from "@/integration/types"
import { creatorById } from "@/integration/catalog"
import { formatClock } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { updateVideoStatus, videoController } from "@/integration/host"

const HIDE_DELAY = 3400

export function VideoOverlay({
  item,
  status,
  onTogglePlay,
  onSeekBy,
  onClose,
}: {
  item: ContentItem
  status: PlaybackStatus<VideoState>
  onTogglePlay: () => void
  onSeekBy: (delta: number) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [mediaType, setMediaType] = useState<"hls" | "mp4" | "embed">("mp4")
  const [mediaUrl, setMediaUrl] = useState<string>("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creator = creatorById(item.creatorId)

  const duration = status.duration || item.durationSec || 0
  const position = status.position
  const playing = status.state === "playing"
  const loading = status.state === "opening" || status.state === "buffering" || status.state === "poster"
  const failed = status.state === "error" || Boolean(loadError)

  const scheduleHide = () => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), HIDE_DELAY)
  }

  // Load video media metadata from /api/posts/{id}/video
  useEffect(() => {
    let active = true
    setLoadError(null)

    async function fetchMedia() {
      try {
        updateVideoStatus({ state: "opening", position: 0, duration: item.durationSec || 0, error: undefined })

        if (item.id.startsWith("cos-") || item.id.startsWith("noc-") || item.id.startsWith("bib-") || item.id.startsWith("tal-")) {
          const sampleUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          setMediaType("mp4")
          setMediaUrl(sampleUrl)
          videoController.currentUrl = sampleUrl
          videoController.currentType = "mp4"
          return
        }

        const res = await fetch(`/api/posts/${encodeURIComponent(item.id)}/video`)
        if (!res.ok) throw new Error("No se pudo obtener el archivo de vídeo.")
        const media = await res.json()
        if (!active) return

        if (!media.url) throw new Error("Este vídeo no ofrece un flujo reproducible.")

        const type: "hls" | "mp4" | "embed" =
          media.type === "embed"
            ? "embed"
            : media.type === "hls" || media.url.includes(".m3u8")
              ? "hls"
              : "mp4"

        setMediaType(type)
        setMediaUrl(media.url)
        videoController.currentUrl = media.url
        videoController.currentType = type
      } catch (err: any) {
        if (!active) return
        const msg = err?.message || "Error al cargar vídeo"
        setLoadError(msg)
        updateVideoStatus({ state: "error", error: msg })
      }
    }

    fetchMedia()

    return () => {
      active = false
    }
  }, [item.id, item.durationSec])

  // Setup video element playback & Hls.js
  useEffect(() => {
    const video = videoRef.current
    if (!video || !mediaUrl || mediaType === "embed") return

    videoController.videoEl = video

    if (mediaType === "hls" && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 25 * 1000 * 1000,
        backBufferLength: 15,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
      })

      hls.loadSource(mediaUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        updateVideoStatus({ state: "ready" })
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          } else {
            hls.destroy()
            updateVideoStatus({ state: "error", error: "Error de transmisión de vídeo" })
          }
        }
      })
      videoController.hlsInstance = hls
    } else {
      video.src = mediaUrl
      video.play().catch(() => {})
    }

    const onTimeUpdate = () => {
      updateVideoStatus({ position: Math.round(video.currentTime) })
    }
    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) {
        updateVideoStatus({ duration: Math.round(video.duration) })
      }
    }
    const onPlay = () => updateVideoStatus({ state: "playing" })
    const onPause = () => updateVideoStatus({ state: "paused" })
    const onWaiting = () => updateVideoStatus({ state: "buffering" })
    const onPlaying = () => updateVideoStatus({ state: "playing" })
    const onError = () => updateVideoStatus({ state: "error", error: "Error en el reproductor de vídeo" })

    video.addEventListener("timeupdate", onTimeUpdate)
    video.addEventListener("durationchange", onDurationChange)
    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    video.addEventListener("waiting", onWaiting)
    video.addEventListener("playing", onPlaying)
    video.addEventListener("error", onError)

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate)
      video.removeEventListener("durationchange", onDurationChange)
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
      video.removeEventListener("waiting", onWaiting)
      video.removeEventListener("playing", onPlaying)
      video.removeEventListener("error", onError)

      if (videoController.hlsInstance) {
        videoController.hlsInstance.destroy()
        videoController.hlsInstance = null
      }
      videoController.videoEl = null
    }
  }, [mediaUrl, mediaType])

  useEffect(() => {
    scheduleHide()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  useTvInput(
    (action) => {
      scheduleHide()
      switch (action) {
        case "back":
          onClose()
          return true
        case "ok":
        case "playpause":
          onTogglePlay()
          return true
        case "left":
        case "rewind":
          onSeekBy(-10)
          return true
        case "right":
        case "forward":
          onSeekBy(10)
          return true
        default:
          return true // ↑/↓ just wake the controls; never move focus underneath the video
      }
    },
    { modal: true },
  )

  const pct = duration > 0 ? (position / duration) * 100 : 0
  const hint = failed
    ? (loadError ?? status.error ?? "No se pudo reproducir el vídeo")
    : loading
      ? "Cargando vídeo…"
      : "Controles discretos · vídeo a pantalla completa"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 bg-black"
      data-tv-screen
      onMouseMove={scheduleHide}
      onClick={scheduleHide}
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo vídeo: ${item.title}`}
    >
      {/* Real Fullscreen Video Surface */}
      <div className="absolute inset-0 overflow-hidden bg-black flex items-center justify-center">
        {mediaType === "embed" && mediaUrl ? (
          <iframe
            src={mediaUrl}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={item.title}
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            autoPlay
            className="absolute inset-0 h-full w-full object-contain bg-black"
          />
        )}

        {/* Loading Spinner only while buffering/opening */}
        {loading && !failed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-14 w-14 rounded-full border-4 border-white/20 border-t-[var(--ptv-accent)] animate-spin" />
          </div>
        )}
      </div>

      {/* Disappearing TV Video Controls */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exitTween }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/80 via-transparent to-black/85 pointer-events-auto"
            style={{ padding: "var(--ptv-safe-y) var(--ptv-safe-x)" }}
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold tracking-wide">
                PATREON TV · VÍDEO
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                aria-label="Cerrar reproductor de vídeo"
                className="ptv-focusable flex h-10 w-10 items-center justify-center rounded-full bg-black/60"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <h1 className="ptv-h2 line-clamp-2 font-bold text-balance">{item.title}</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--ptv-muted)" }}>
                {creator?.name}
              </p>

              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTogglePlay()
                  }}
                  aria-label={playing ? "Pausar" : "Reproducir"}
                  className="ptv-focusable flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "var(--ptv-text)", color: "#17141a" }}
                >
                  {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                </button>
                <p
                  className="text-sm"
                  role="status"
                  style={{ color: failed ? "var(--ptv-accent)" : "var(--ptv-muted-dim)" }}
                >
                  {hint}
                </p>
              </div>

              <div className="mt-6">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full w-full origin-left rounded-full"
                    style={{ transform: `scaleX(${pct / 100})`, background: "var(--ptv-accent)" }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs" style={{ color: "var(--ptv-muted-dim)" }}>
                  <span>{formatClock(position)}</span>
                  <span>{formatClock(duration)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
