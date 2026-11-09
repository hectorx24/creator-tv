import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { exitTween } from "@/lib/patreon-tv/motion-tokens"
import { Gauge, ListVideo, Moon, Pause, Play, Settings2, SunDim } from "lucide-react"
import Hls from "hls.js"
import type { ContentItem } from "@/lib/patreon-tv/types"
import type { PlaybackStatus, VideoState } from "@/integration/types"
import { creatorById } from "@/integration/catalog"
import { formatClock } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { updateVideoStatus, videoController } from "@/integration/host"
import { loadPostBody, parseChapters, plainText, type Chapter } from "@/integration/post-body"
import { getPrefs, getProgress, nextSpeed, saveProgress, setPrefs, speedLabel } from "@/lib/patreon-tv/progress"
import { uiSound } from "@/lib/patreon-tv/ui-sound"
import { Artwork } from "./artwork"
import { WavyProgress } from "./wavy-progress"
import { PatreonTvLogo } from "./logo"

const HIDE_DELAY = 4000
const SCRUB_COMMIT_MS = 650
const AUTO_DIM_MS = 45_000 // paused this long → partial dim
const AUTO_DARK_MS = 4 * 60_000 // paused this long → near black
const DIM = { none: 0, dim: 0.6, dark: 0.93 } as const
type Dim = keyof typeof DIM
type Mode = "play" | "panel" | "chapters"
const PANEL = ["speed", "chapters", "dim", "dark"] as const
const PANEL_LABEL = { speed: "Velocidad", chapters: "Capítulos", dim: "Atenuar", dark: "Oscurecer" } as const

/** Visual-only dimming: a black layer over the picture. The TV backlight is never touched. */
export function VideoOverlay({
  item,
  status,
  onTogglePlay,
  onSeekBy: _onSeekBy,
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
  const [mediaUrl, setMediaUrl] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [firstFrame, setFirstFrame] = useState(false)
  const [mode, setMode] = useState<Mode>("play")
  const [panelIndex, setPanelIndex] = useState(0)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterIndex, setChapterIndex] = useState(0)
  const skip = getPrefs().skip
  const [speed, setSpeed] = useState(getPrefs().videoSpeed)
  useEffect(() => {
    const v = videoController.videoEl
    if (v) v.playbackRate = speed
  }, [speed, firstFrame])
  const [scrub, setScrub] = useState<number | null>(null)
  const [dim, setDim] = useState<Dim>("none")
  const [toast, setToast] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const descText = useRef("")
  const creator = creatorById(item.creatorId)

  const duration = status.duration || item.durationSec || 0
  const position = status.position
  const playing = status.state === "playing"
  const failed = status.state === "error" || Boolean(loadError)
  const shownPos = scrub ?? position

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200)
  }

  const scheduleHide = () => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      setControlsVisible(false)
      setMode((m) => (m === "panel" ? "play" : m))
    }, HIDE_DELAY)
  }

  // ---- media resolution -------------------------------------------------------------
  useEffect(() => {
    let active = true
    setLoadError(null)
    setFirstFrame(false)
    ;(async () => {
      try {
        updateVideoStatus({ state: "opening", position: 0, duration: item.durationSec || 0, error: undefined })
        const res = await fetch(`/api/posts/${encodeURIComponent(item.id)}/video`)
        if (!res.ok) throw new Error("No se pudo obtener el archivo de vídeo.")
        const media = await res.json()
        if (!active) return
        if (!media.url) throw new Error("Este vídeo no ofrece un flujo reproducible.")
        const type: "hls" | "mp4" | "embed" =
          media.type === "embed" ? "embed" : media.type === "hls" || media.url.includes(".m3u8") ? "hls" : "mp4"
        setMediaType(type)
        setMediaUrl(media.url)
        videoController.currentUrl = media.url
        videoController.currentType = type
        if (type === "embed") setFirstFrame(true)
      } catch (err: any) {
        if (!active) return
        const msg = err?.message || "Error al cargar vídeo"
        setLoadError(msg)
        updateVideoStatus({ state: "error", error: msg })
      }
    })()
    return () => {
      active = false
    }
  }, [item.id, item.durationSec])

  // ---- chapters from the post description ----------------------------------------------
  useEffect(() => {
    let alive = true
    loadPostBody(item).then((b) => {
      if (!alive) return
      descText.current = plainText(b.html)
      setChapters(parseChapters(descText.current, duration))
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])
  useEffect(() => {
    if (duration && descText.current) setChapters(parseChapters(descText.current, duration))
  }, [duration])

  const currentChapter = useMemo(() => {
    let idx = -1
    chapters.forEach((c, i) => {
      if (shownPos >= c.start) idx = i
    })
    return idx
  }, [chapters, shownPos])

  // ---- player wiring ------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current
    if (!video || !mediaUrl || mediaType === "embed") return
    videoController.videoEl = video
    const resume = getProgress(item.id)

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
        startPosition: resume ? resume.pos : -1,
        capLevelToPlayerSize: true, // Chromecast HD: never decode above the panel size
      })
      hls.loadSource(mediaUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        updateVideoStatus({ state: "ready" })
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else {
          hls.destroy()
          updateVideoStatus({ state: "error", error: "Error de transmisión de vídeo" })
        }
      })
      videoController.hlsInstance = hls
    } else {
      video.src = mediaUrl
      video.play().catch(() => {})
    }

    let lastSave = 0
    const onMeta = () => {
      if (resume && mediaType !== "hls" && resume.pos < video.duration - 20) video.currentTime = resume.pos
    }
    const onTime = () => {
      updateVideoStatus({ position: Math.round(video.currentTime) })
      const now = Date.now()
      if (now - lastSave > 5000) {
        lastSave = now
        saveProgress(item.id, video.currentTime, video.duration)
      }
    }
    const onDur = () => {
      if (video.duration && isFinite(video.duration)) updateVideoStatus({ duration: Math.round(video.duration) })
    }
    const onFrame = () => setFirstFrame(true)
    const onPlay = () => updateVideoStatus({ state: "playing" })
    const onPause = () => {
      updateVideoStatus({ state: "paused" })
      saveProgress(item.id, video.currentTime, video.duration)
    }
    const onWaiting = () => updateVideoStatus({ state: "buffering" })
    const onError = () => updateVideoStatus({ state: "error", error: "Error en el reproductor de vídeo" })
    const onEnded = () => saveProgress(item.id, video.duration, video.duration)

    // Bluetooth headsets (AirPods click) send media buttons to the platform MediaSession Chromium
    // creates for this <video>; register handlers so play/pause/seek reach the player.
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined
    if (ms) {
      try {
        ms.metadata = new MediaMetadata({ title: item.title, artist: creator?.name || "", artwork: item.art ? [{ src: item.art }] : [] })
        ms.setActionHandler("play", () => { video.play().catch(() => {}) })
        ms.setActionHandler("pause", () => video.pause())
        ms.setActionHandler("seekbackward", () => { video.currentTime = Math.max(0, video.currentTime - skip) })
        ms.setActionHandler("seekforward", () => { video.currentTime = video.currentTime + skip })
        ms.setActionHandler("stop", () => video.pause())
      } catch {
        /* older WebView: key events still work */
      }
    }
    const events: [string, () => void][] = [
      ["loadedmetadata", onMeta], ["timeupdate", onTime], ["durationchange", onDur], ["loadeddata", onFrame],
      ["play", onPlay], ["pause", onPause], ["waiting", onWaiting], ["playing", onPlay], ["error", onError], ["ended", onEnded],
    ]
    events.forEach(([e, fn]) => video.addEventListener(e, fn))
    return () => {
      saveProgress(item.id, video.currentTime, video.duration)
      events.forEach(([e, fn]) => video.removeEventListener(e, fn))
      if (ms) for (const act of ["play", "pause", "seekbackward", "seekforward", "stop"] as MediaSessionAction[]) {
        try { ms.setActionHandler(act, null) } catch { /* ignore */ }
      }
      if (videoController.hlsInstance) {
        videoController.hlsInstance.destroy()
        videoController.hlsInstance = null
      }
      videoController.videoEl = null
    }
  }, [mediaUrl, mediaType, item.id])

  useEffect(() => {
    scheduleHide()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (scrubTimer.current) clearTimeout(scrubTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Screen stays awake only while the video plays; paused/closed → Google TV screensaver may run.
  useEffect(() => {
    try { window.PersonalAudio?.setKeepAwake?.(playing) } catch { /* ignore */ }
  }, [playing])
  useEffect(() => () => { try { window.PersonalAudio?.setKeepAwake?.(false) } catch { /* ignore */ } }, [])

  // ---- auto-dim while paused --------------------------------------------------------------
  useEffect(() => {
    if (playing || !firstFrame || failed) return
    const t1 = setTimeout(() => setDim((d) => (d === "none" ? "dim" : d)), AUTO_DIM_MS)
    const t2 = setTimeout(() => setDim("dark"), AUTO_DARK_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [playing, firstFrame, failed])

  // ---- seeking: repeated presses accelerate; the jump commits when the remote rests ----------
  const seekTo = (target: number) => {
    const v = videoController.videoEl
    if (!v) return
    const max = duration || v.duration || Number.POSITIVE_INFINITY
    v.currentTime = Math.max(0, Math.min(max - 1, target))
    updateVideoStatus({ position: Math.round(v.currentTime) })
  }
  const nudge = (dir: 1 | -1) => {
    // Each press adds exactly one step (x1, x2, x3...); the jump happens when the remote rests.
    const step = skip
    const base = scrub ?? position
    const next = Math.max(0, Math.min(duration || base + step, base + dir * step))
    setScrub(next)
    if (scrubTimer.current) clearTimeout(scrubTimer.current)
    scrubTimer.current = setTimeout(() => {
      seekTo(next)
      setScrub(null)
    }, SCRUB_COMMIT_MS)
  }

  const runPanel = (key: (typeof PANEL)[number]) => {
    if (key === "speed") {
      const s = nextSpeed(speed)
      setSpeed(s)
      setPrefs({ videoSpeed: s })
    } else if (key === "chapters") {
      if (!chapters.length) return flash("Este vídeo no tiene capítulos en la descripción")
      setChapterIndex(Math.max(0, currentChapter))
      setMode("chapters")
    } else {
      setDim(key)
      setMode("play")
    }
  }

  useTvInput(
    (action, e) => {
      // Headsets (AirPods) may send explicit PLAY / PAUSE instead of PLAY_PAUSE: honour them exactly.
      const k = e as KeyboardEvent | undefined
      if (action === "playpause" && k) {
        const v = videoController.videoEl
        if (v && (k.keyCode === 126 || k.key === "MediaPlay")) { setDim("none"); v.play().catch(() => {}); return true }
        if (v && (k.keyCode === 127 || k.key === "MediaPause")) { v.pause(); return true }
      }
      // Any key first restores the picture; that key does nothing else.
      if (dim !== "none") {
        setDim("none")
        scheduleHide()
        return true
      }
      const wasHidden = !controlsVisible
      scheduleHide()
      if (mode === "chapters") {
        if (action === "left" || action === "right") setChapterIndex((i) => Math.max(0, Math.min(chapters.length - 1, i + (action === "left" ? -1 : 1))))
        else if (action === "ok") {
          seekTo(chapters[chapterIndex].start)
          setMode("play")
          videoController.videoEl?.play().catch(() => {})
        } else if (action === "back" || action === "up") setMode("panel")
        return true
      }
      if (mode === "panel") {
        if (action === "up" || action === "down") {
                setPanelIndex((i) => Math.max(0, Math.min(PANEL.length - 1, i + (action === "up" ? -1 : 1))))
        } else if (action === "ok") {
          runPanel(PANEL[panelIndex])
        } else if (action === "back" || action === "left") setMode("play")
        else if (action === "playpause") onTogglePlay()
        return true
      }
      switch (action) {
        case "back":
          onClose()
          return true
        case "ok":
          if (wasHidden && playing) return true // first OK just shows the controls
          onTogglePlay()
          return true
        case "playpause":
          onTogglePlay()
          return true
        case "left":
        case "rewind":
          nudge(-1)
          return true
        case "right":
        case "forward":
          nudge(1)
          return true
        case "down":
          setPanelIndex(0)
          setMode("panel")
          return true
        default:
          return true // ↑ only wakes the controls
      }
    },
    { modal: true },
  )

  const pct = duration > 0 ? (shownPos / duration) * 100 : 0
  const loadingCover = !firstFrame && !failed
  const ring = (on: boolean) => (on ? { outline: "3px solid var(--ptv-focus, #ffd7a8)", outlineOffset: 3 } : undefined)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 bg-black"
      data-tv-screen
      onClick={scheduleHide}
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo vídeo: ${item.title}`}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
        {mediaType === "embed" && mediaUrl ? (
          <iframe src={mediaUrl} className="absolute inset-0 h-full w-full border-0" allow="autoplay; fullscreen" allowFullScreen title={item.title} />
        ) : (
          <video ref={videoRef} playsInline autoPlay className="absolute inset-0 h-full w-full bg-black object-contain" />
        )}
      </div>

      {/* Cover until the first decoded frame: artwork + title + progress shimmer (no grey box). */}
      <AnimatePresence>
        {(loadingCover || failed) && (
          <motion.div
            key="cover"
            className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
          >
            <motion.div className="absolute inset-0" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: "linear" }}>
              <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
            </motion.div>
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,5,7,0.94) 0%, rgba(5,5,7,0.7) 45%, rgba(5,5,7,0.35) 100%)" }} />
            <div className="absolute inset-0 flex flex-col justify-end" style={{ padding: "var(--ptv-safe-y) var(--ptv-safe-x)" }}>
              <motion.p className="text-xs font-bold tracking-[0.22em]" style={{ color: "var(--ptv-accent)" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                {creator?.name?.toUpperCase()}
              </motion.p>
              <motion.h1 className="ptv-h1 mt-2 max-w-[70%] font-bold text-balance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, type: "spring", stiffness: 300, damping: 30 }}>
                {item.title}
              </motion.h1>
              {failed ? (
                <p className="mt-6 text-base font-semibold" role="alert" style={{ color: "#ff8a7a" }}>
                  {loadError ?? status.error ?? "No se pudo reproducir el vídeo"} · Atrás para volver
                </p>
              ) : (
                <motion.div className="mt-8 h-12 w-12" animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
                  <PatreonTvLogo className="h-full w-full" />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {firstFrame && status.state === "buffering" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-[var(--ptv-accent)]" />
        </div>
      )}

      <AnimatePresence>
        {controlsVisible && firstFrame && !failed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exitTween }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute inset-0 flex flex-col justify-end"
            style={{ padding: "var(--ptv-safe-y) var(--ptv-safe-x)", background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 28%, transparent 52%, rgba(0,0,0,0.88) 100%)" }}
          >
            <h1 className="ptv-h2 line-clamp-2 max-w-[75%] font-bold text-balance">{item.title}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--ptv-muted)" }}>
              {creator?.name}
              {currentChapter >= 0 && chapters[currentChapter] ? ` · ${chapters[currentChapter].title}` : ""}
            </p>

            {/* Material 3 Expressive-style timeline: active track, gap, pill handle; grows while seeking. */}
            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--ptv-text)", color: "#17141a" }}>
                <motion.span key={playing ? "pause" : "play"} className="flex" initial={{ scale: 0.3, rotate: playing ? -90 : 90, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 13 }}>
                  {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                </motion.span>
              </div>
              <span className="w-[4.5em] text-right text-sm font-semibold tabular-nums" style={{ color: scrub !== null ? "#fff" : "var(--ptv-muted)" }}>
                {formatClock(shownPos)}
              </span>
              <div className="relative flex-1">
                <WavyProgress value={duration ? shownPos / duration : 0} playing={playing && scrub === null} thick={5} />
                {(scrub !== null || mode === "chapters") && duration > 0 && (
                  <div className="pointer-events-none absolute inset-0">
                    {chapters.map((c, i) =>
                      i === 0 ? null : (
                        <motion.div
                          key={i}
                          className="absolute top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-full bg-white/80"
                          style={{ left: `${(c.start / duration) * 100}%` }}
                          initial={{ opacity: 0, scaleY: 0 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 18, delay: i * 0.015 }}
                        />
                      ),
                    )}
                  </div>
                )}
                {scrub !== null && (
                  <motion.div
                    className="absolute top-1/2 h-6 w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                    style={{ left: `${pct}%` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 600, damping: 16 }}
                  />
                )}
              </div>
              <span className="w-[4.5em] text-sm tabular-nums" style={{ color: "var(--ptv-muted)" }}>
                -{formatClock(Math.max(0, duration - shownPos))}
              </span>
              <div className="relative">
                <motion.div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  animate={{ rotate: mode !== "play" ? 90 : 0, scale: mode !== "play" ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  style={{ background: mode !== "play" ? "var(--ptv-text)" : "rgba(255,255,255,0.12)", color: mode !== "play" ? "#17141a" : "var(--ptv-text)" }}
                  aria-label="Opciones"
                >
                  <Settings2 className="h-5 w-5" />
                </motion.div>
                <AnimatePresence>
                  {mode === "panel" && (
                    <motion.div
                      className="absolute bottom-[calc(100%+12px)] right-0 flex w-56 flex-col gap-1 rounded-3xl p-2"
                      style={{ background: "rgba(24,24,28,0.96)", border: "1px solid var(--ptv-line)", transformOrigin: "bottom right" }}
                      initial={{ opacity: 0, scale: 0.85, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 6, transition: { duration: 0.12 } }}
                      transition={{ type: "spring", stiffness: 520, damping: 32 }}
                    >
                      {PANEL.map((key, i) => {
                        const on = panelIndex === i
                        const Icon = key === "speed" ? Gauge : key === "chapters" ? ListVideo : key === "dim" ? SunDim : Moon
                        const off = key === "chapters" && !chapters.length
                        return (
                          <div
                            key={key}
                            className="relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold"
                            style={{ color: on ? "#17141a" : "var(--ptv-text)", opacity: off ? 0.5 : 1 }}
                          >
                            {on && (
                              <motion.div
                                layoutId="gear-pill"
                                className="absolute inset-0 rounded-2xl"
                                style={{ background: "var(--ptv-text)" }}
                                transition={{ type: "spring", stiffness: 600, damping: 38 }}
                              />
                            )}
                            <Icon className="relative h-4 w-4" />
                            <span className="relative">
                              {PANEL_LABEL[key]}
                              {key === "chapters" && chapters.length ? ` (${chapters.length})` : ""}
                              {key === "speed" ? ` · ${speedLabel(speed)}` : ""}
                            </span>
                          </div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <AnimatePresence>
              {mode === "chapters" && (
                <motion.div
                  className="mt-4 flex gap-3 overflow-hidden"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                >
                  {chapters.map((c, i) => {
                    const offset = Math.max(0, chapterIndex - 2)
                    if (i < offset || i > offset + 4) return null
                    const on = i === chapterIndex
                    return (
                      <div
                        key={i}
                        className="flex w-[17vw] flex-shrink-0 flex-col gap-1 rounded-2xl p-3"
                        style={{
                          background: on ? "var(--ptv-text)" : "rgba(255,255,255,0.1)",
                          color: on ? "#17141a" : "var(--ptv-text)",
                          transform: on ? "translateY(-4px)" : "none",
                          transition: "transform 140ms ease, background 140ms ease",
                        }}
                      >
                        <span className="text-xs font-bold tabular-nums opacity-70">{formatClock(c.start)}</span>
                        <span className="line-clamp-2 text-sm font-semibold">{c.title}</span>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="absolute left-1/2 top-[8vh] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold"
            style={{ background: "rgba(20,20,24,0.9)", border: "1px solid var(--ptv-line)" }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dimming layer (picture only; system brightness untouched). */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: DIM[dim] }}
        initial={false}
        transition={{ duration: dim === "none" ? 0.25 : 1.2, ease: "easeInOut" }}
      />
    </motion.div>
  )
}
