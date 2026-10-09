import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import type { LoginCredentials } from "@/integration/types"
import { contentForCreator, loadCatalog, resetCatalog } from "@/integration/catalog"
import { errorMessage, getIntegration, requireIntegration } from "@/integration/registry"
import { useAudioStatus, useVideoStatus } from "@/integration/use-playback"
import { LoginScreen } from "./login-screen"
import { CreatorGrid } from "./creator-grid"
import { BrowseScreen } from "./browse-screen"
import { MiniPlayer } from "./mini-player"
import { AudioPlayerScreen } from "./audio-player-screen"
import { VideoOverlay } from "./video-overlay"
import { SearchScreen } from "./search-screen"
import { TextReaderScreen } from "./text-reader-screen"
import { StartupIntro } from "./startup-intro"

type Stage = "login" | "app"
type Overlay = "none" | "search" | "reader" | "audioFull"
type AudioMode = "closed" | "mini" | "full"

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value))

export function PatreonTvApp() {
  const [stage, setStage] = useState<Stage>("login")
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
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const auth = getIntegration("auth")
    if (!auth?.isAuthenticated) return
    let cancelled = false
    auth
      .isAuthenticated()
      .then(async (authenticated) => {
        if (!authenticated || cancelled) return
        await loadCatalog()
        if (!cancelled) setStage("app")
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
      <div className="ptv relative">
        {stage === "login" ? (
          <LoginScreen onLogin={handleLogin} busy={loginBusy} error={loginError} />
        ) : (
          <>
            {!activeCreatorId && (
              <CreatorGrid
                onSelect={(id) => {
                  setActiveCreatorId(id)
                  setOverlay("none")
                }}
                onLogout={handleLogout}
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
            <TextReaderScreen item={readerItem} onBack={closeReader} />
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
          {showStartup && <StartupIntro onComplete={() => setShowStartup(false)} />}
        </AnimatePresence>
      </div>
    </LayoutGroup>
    </MotionConfig>
  )
}
