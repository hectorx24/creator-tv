import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import type { LoginCredentials } from "@/integration/types"
import { catalogAge, catalogVersion, contentForCreator, getAllContent, loadCatalog, refreshCatalog, resetCatalog, subscribeCatalog } from "@/integration/catalog"
import { errorMessage, getIntegration, requireIntegration } from "@/integration/registry"
import { useAudioStatus, useVideoStatus } from "@/integration/use-playback"
import { LoginScreen } from "./login-screen"
import { CreatorGrid } from "./creator-grid"
import { BrowseScreen } from "./browse-screen"
import { MiniPlayer } from "./mini-player"
// Heavy, rarely-first screens load on demand (hls.js alone is ~500 KB): faster cold start on Chromecast HD.
const AudioPlayerScreen = lazy(() => import("./audio-player-screen").then((m) => ({ default: m.AudioPlayerScreen })))
const VideoOverlay = lazy(() => import("./video-overlay").then((m) => ({ default: m.VideoOverlay })))
const SearchScreen = lazy(() => import("./search-screen").then((m) => ({ default: m.SearchScreen })))
const TextReaderScreen = lazy(() => import("./text-reader-screen").then((m) => ({ default: m.TextReaderScreen })))
// Warm the chunks once the UI is idle so the first open is still instant.
if (typeof window !== "undefined")
  setTimeout(() => {
    void import("./video-overlay")
    void import("./audio-player-screen")
    void import("./text-reader-screen")
  }, 4000)
import { StartupIntro } from "./startup-intro"
import { ConfirmDialog } from "./confirm-dialog"

type Stage = "checking" | "login" | "app"
type Overlay = "none" | "search" | "reader" | "audioFull"
type AudioMode = "closed" | "mini" | "full"

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value))

export function PatreonTvApp() {
  const [stage, setStage] = useState<Stage>("checking")
  const [showStartup, setShowStartup] = useState(true)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [activeCreatorId, setActiveCreatorId] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>("none")
  const [readerItem, setReaderItem] = useState<ContentItem | null>(null)
  const [videoItem, setVideoItem] = useState<ContentItem | null>(null)
  const [audioItem, setAudioItem] = useState<ContentItem | null>(null)
  const [audioMode, setAudioMode] = useState<AudioMode>("closed")
  const [confirmLogout, setConfirmLogout] = useState(false)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useSyncExternalStore(subscribeCatalog, catalogVersion) // re-render when new posts arrive

  // Fresh content: the WebView can live for days in the background. Refresh when the app comes
  // back (if older than 5 min) and every 30 min while visible.
  useEffect(() => {
    if (stage !== "app") return
    const maybe = () => {
      if (document.visibilityState === "visible" && catalogAge() > 5 * 60_000) void refreshCatalog()
    }
    document.addEventListener("visibilitychange", maybe)
    window.addEventListener("focus", maybe)
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refreshCatalog()
    }, 30 * 60_000)
    return () => {
      document.removeEventListener("visibilitychange", maybe)
      window.removeEventListener("focus", maybe)
      clearInterval(t)
    }
  }, [stage])

  const audioStatus = useAudioStatus()
  const videoStatus = useVideoStatus()
  const audioPlaying = audioStatus.state === "playing" || audioStatus.state === "buffering"
  const audioDuration = audioStatus.duration || audioItem?.durationSec || 0

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }, [])

  const attempt = useCallback(
    (action: () => void) => {
      try {
        action()
      } catch (error) {
        showNotice(errorMessage(error))
      }
    },
    [showNotice],
  )

  useEffect(() => {
    // Stay on the intro until the session is known: no Login flash when a valid session exists.
    const auth = getIntegration("auth")
    if (!auth?.isAuthenticated) {
      setStage("login")
      return
    }
    let cancelled = false
    auth
      .isAuthenticated()
      .then(async (authenticated) => {
        if (cancelled) return
        if (!authenticated) return setStage("login")
        try {
          await loadCatalog()
        } catch (error) {
          showNotice(errorMessage(error))
        }
        if (!cancelled) {
          restoreAudio()
          setStage("app")
        }
      })
      .catch(() => !cancelled && setStage("login"))
    return () => {
      cancelled = true
    }
  }, [])

  // Audio keeps playing in the native service while the UI is gone; re-attach the mini-player on return.
  function restoreAudio() {
    let id = ""
    try {
      const raw = window.PersonalAudio?.status?.()
      const st = typeof raw === "string" ? JSON.parse(raw) : raw
      id = st?.id ? String(st.id) : ""
    } catch {
      /* no native audio */
    }
    if (!id) return
    const item = getAllContent().find((i) => i.id === id)
    if (item) {
      setAudioItem(item)
      setAudioMode("mini")
    }
  }

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setLoginBusy(true)
    setLoginError(null)
    try {
      await requireIntegration("auth").login(credentials)
      await loadCatalog()
      setActiveCreatorId(null)
      setStage("app")
    } catch (error) {
      setLoginError(errorMessage(error))
    } finally {
      setLoginBusy(false)
    }
  }, [])

  const handleLogout = useCallback(() => {
    setConfirmLogout(false)
    getIntegration("audio")?.stop()
    getIntegration("video")?.close()
    void getIntegration("auth")
      ?.logout()
      .catch(() => {})
    resetCatalog()
    setStage("login")
    setActiveCreatorId(null)
    setOverlay("none")
    setReaderItem(null)
    setVideoItem(null)
    setAudioItem(null)
    setAudioMode("closed")
  }, [])

  const playAudio = useCallback(
    (item: ContentItem) =>
      attempt(() => {
        requireIntegration("audio").play(item)
        setAudioItem(item)
        setAudioMode("full")
        setOverlay("audioFull")
      }),
    [attempt],
  )

  const openVideo = useCallback(
    (item: ContentItem) =>
      attempt(() => {
        getIntegration("audio")?.stop()
        setAudioItem(null)
        setAudioMode("closed")
        requireIntegration("video").open(item)
        setVideoItem(item)
      }),
    [attempt],
  )

  const closeVideo = useCallback(() => {
    getIntegration("video")?.close()
    setVideoItem(null)
  }, [])

  const handleOpenItem = useCallback(
    (item: ContentItem) => {
      if (item.locked) return
      if (item.kind === "video") {
        openVideo(item)
      } else if (item.kind === "text") {
        setReaderItem(item)
        setOverlay("reader")
      } else {
        playAudio(item)
      }
    },
    [openVideo, playAudio],
  )

  const minimizeAudio = useCallback(() => {
    setOverlay("none")
    setAudioMode("mini")
  }, [])

  const expandAudio = useCallback(() => {
    setOverlay("audioFull")
    setAudioMode("full")
  }, [])

  const closeAudio = useCallback(() => {
    getIntegration("audio")?.stop()
    setAudioItem(null)
    setAudioMode("closed")
    setOverlay((o) => (o === "audioFull" ? "none" : o))
  }, [])

  // Reserve room for the docked mini-player (CSS reads body[data-mini]).
  useEffect(() => {
    if (audioItem && audioMode === "mini") document.body.setAttribute("data-mini", "open")
    else document.body.removeAttribute("data-mini")
    return () => document.body.removeAttribute("data-mini")
  }, [audioItem, audioMode])

  const toggleAudio = useCallback(() => attempt(() => requireIntegration("audio").toggle()), [attempt])

  const seekAudio = useCallback(
    (position: number) => attempt(() => requireIntegration("audio").seekTo(clamp(position, audioDuration))),
    [attempt, audioDuration],
  )

  const skipAudio = useCallback(
    (delta: number) => seekAudio(audioStatus.position + delta),
    [seekAudio, audioStatus.position],
  )

  const toggleVideo = useCallback(
    () =>
      attempt(() => {
        const video = requireIntegration("video")
        if (video.getStatus().state === "playing") video.pause()
        else video.play()
      }),
    [attempt],
  )

  const seekVideoBy = useCallback(
    (delta: number) =>
      attempt(() => {
        const video = requireIntegration("video")
        const { position, duration } = video.getStatus()
        video.seekTo(clamp(position + delta, duration || Number.POSITIVE_INFINITY))
      }),
    [attempt],
  )

  const closeReader = useCallback(() => {
    setReaderItem(null)
    setOverlay("none")
  }, [])

  const closeSearch = useCallback(() => setOverlay("none"), [])

  const noticeBanner = notice && (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold"
      style={{ bottom: "calc(var(--ptv-safe-y) + 8px)", background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", color: "var(--ptv-text)" }}
    >
      {notice}
    </div>
  )

  return (
    <MotionConfig reducedMotion="user">
    <LayoutGroup>
      <Suspense fallback={null}>
      <div className="ptv relative">
        {stage === "checking" ? null : stage === "login" ? (
          <LoginScreen onLogin={handleLogin} busy={loginBusy} error={loginError} />
        ) : (
          <>
            {!activeCreatorId && (
              <CreatorGrid
                onSelect={(id) => {
                  setActiveCreatorId(id)
                  setOverlay("none")
                }}
                onLogout={() => setConfirmLogout(true)}
              />
            )}

        {activeCreatorId && (
          <div
            className="h-full"
            data-tv-screen
            data-tv-dock-ok
            style={{ display: overlay === "none" && !videoItem ? "block" : "none" }}
          >
            <BrowseScreen
              active={overlay === "none" && !videoItem}
              creatorId={activeCreatorId}
              items={contentForCreator(activeCreatorId)}
              onSwitchCreator={() => setActiveCreatorId(null)}
              onOpenSearch={() => setOverlay("search")}
              onOpenItem={handleOpenItem}
              onReadItem={(item) => {
                setReaderItem(item)
                setOverlay("reader")
              }}
            />
          </div>
        )}

        {overlay === "search" && (
          <div className="ptv-overlay">
            <SearchScreen onBack={closeSearch} onOpenItem={handleOpenItem} />
          </div>
        )}

        {overlay === "reader" && readerItem && (
          <div className="ptv-overlay">
            <TextReaderScreen
              item={readerItem}
              onBack={closeReader}
              onPlay={(item) => {
                closeReader()
                handleOpenItem(item)
              }}
            />
          </div>
        )}

        <AnimatePresence>
          {videoItem && (
            <VideoOverlay
              key={videoItem.id}
              item={videoItem}
              status={videoStatus}
              onTogglePlay={toggleVideo}
              onSeekBy={seekVideoBy}
              onClose={closeVideo}
            />
          )}
        </AnimatePresence>

        {/* One presence slot, sequential: the full player finishes fading out
            before the mini-player slides in (and vice-versa) — no overlap. */}
        <AnimatePresence mode="wait" initial={false}>
          {audioItem && overlay === "audioFull" && audioMode === "full" ? (
            <AudioPlayerScreen
              key="audio-full"
              item={audioItem}
              playing={audioPlaying}
              position={audioStatus.position}
              duration={audioDuration}
              onMinimize={minimizeAudio}
              onTogglePlay={toggleAudio}
              onSeek={seekAudio}
              onSkip={skipAudio}
            />
          ) : audioItem && audioMode === "mini" ? (
            <MiniPlayer
              key="audio-mini"
              item={audioItem}
              playing={audioPlaying}
              position={audioStatus.position}
              duration={audioDuration}
              onExpand={expandAudio}
              onTogglePlay={toggleAudio}
              onClose={closeAudio}
            />
          ) : null}
        </AnimatePresence>
          </>
        )}
        {noticeBanner}
        <AnimatePresence>
          {confirmLogout && (
            <ConfirmDialog
              title="¿Cerrar sesión?"
              body="Tendrás que volver a iniciar sesión en Patreon para ver tu biblioteca. La reproducción actual se detendrá."
              confirmLabel="Cerrar sesión"
              onConfirm={handleLogout}
              onCancel={() => setConfirmLogout(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showStartup && <StartupIntro ready={stage !== "checking"} onComplete={() => setShowStartup(false)} />}
        </AnimatePresence>
      </div>
      </Suspense>
    </LayoutGroup>
    </MotionConfig>
  )
}
