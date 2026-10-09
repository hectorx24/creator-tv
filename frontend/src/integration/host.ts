import type {
  Integration,
  AuthPort,
  DataPort,
  AudioPort,
  VideoPort,
  PlaybackStatus,
  AudioState,
  VideoState,
  LoginCredentials,
} from "./types"
import type { ContentItem, Creator, ArtColor, ContentKind } from "@/lib/patreon-tv/types"
import { creatorById } from "./catalog"
import { CREATORS, CONTENT, contentForCreator as demoContentForCreator } from "@/demo/demo-data"

const ART_COLORS: ArtColor[] = ["coral", "gold", "purple", "green", "slate"]

let demoActive = typeof window !== "undefined" && window.localStorage?.getItem("ptv_demo_active") === "true"

export function isDemoActive(): boolean {
  return demoActive
}

let demoAudioTimer: ReturnType<typeof setInterval> | null = null

function stopDemoAudioTimer() {
  if (demoAudioTimer) {
    clearInterval(demoAudioTimer)
    demoAudioTimer = null
  }
}

function startDemoAudioTimer() {
  stopDemoAudioTimer()
  demoAudioTimer = setInterval(() => {
    if (audioStatus.state !== "playing") return
    const next = audioStatus.position + 1
    if (next >= audioStatus.duration) {
      updateAudioStatus({ position: audioStatus.duration, state: "paused" })
      stopDemoAudioTimer()
    } else {
      updateAudioStatus({ position: next })
    }
  }, 1000)
}

function stripHtml(html: string): string {
  if (!html) return ""
  return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()
}

function classifyPostKind(post: any): ContentKind {
  const videoType = String(post.videoType || "").toLowerCase()
  const postType = String(post.postType || "").toLowerCase()
  const mimeType = String(post.mimeType || "").toLowerCase()
  const mediaUrl = String(post.mediaUrl || "").toLowerCase()

  if (
    (videoType !== "none" && videoType !== "") ||
    postType.includes("video") ||
    mimeType.startsWith("video/") ||
    /\.(mp4|m4v|webm|m3u8)(\?|$)/i.test(mediaUrl)
  ) {
    return "video"
  }

  if (
    postType.includes("audio") ||
    postType.includes("podcast") ||
    mimeType.startsWith("audio/") ||
    /\.(mp3|m4a|aac|ogg|wav|flac)(\?|$)/i.test(mediaUrl)
  ) {
    return "audio"
  }

  return "text"
}

// ==========================================
// AUTH PORT
// ==========================================
const auth: AuthPort = {
  async isAuthenticated(): Promise<boolean> {
    if (demoActive) return true
    try {
      const res = await fetch("/api/auth/status")
      if (!res.ok) return false
      const data = await res.json()
      return Boolean(data.authenticated)
    } catch {
      return false
    }
  },

  async login(credentials: LoginCredentials): Promise<void> {
    if (credentials.method === "session" && credentials.sessionId.trim().toLowerCase() === "demo") {
      demoActive = true
      try {
        window.localStorage?.setItem("ptv_demo_active", "true")
      } catch {}
      return
    }
    demoActive = false
    try {
      window.localStorage?.removeItem("ptv_demo_active")
    } catch {}

    if (credentials.method === "password") {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Credenciales incorrectas")
      }
    } else {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: credentials.sessionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "ID de sesión inválido")
      }
    }
  },

  async logout(): Promise<void> {
    demoActive = false
    try {
      window.localStorage?.removeItem("ptv_demo_active")
    } catch {}
    stopDemoAudioTimer()
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
  },
}

// ==========================================
// DATA PORT
// ==========================================
const data: DataPort = {
  async listCreators(): Promise<Creator[]> {
    if (demoActive) return CREATORS

    const res = await fetch("/api/campaigns")
    if (!res.ok) throw new Error("No se pudieron cargar los creadores.")
    const raw = await res.json()
    const campaigns: any[] = Array.isArray(raw) ? raw : raw.campaigns || []
    return campaigns.map((c, i) => ({
      id: String(c.id),
      name: c.name || "Creador",
      tagline: c.summary || c.tagline || c.url || "Patreon Creator",
      avatar: c.avatarUrl || c.avatar || "",
      color: ART_COLORS[i % ART_COLORS.length],
    }))
  },

  async listContent(creatorId: string): Promise<ContentItem[]> {
    if (demoActive) return demoContentForCreator(creatorId)

    // CRITICAL: ?videoOnly=false is mandatory so NanoHTTPD PatreonServer
    // does not discard podcasts/audio posts (fixes AnaitGames 0 posts regression!)
    const res = await fetch(`/api/campaigns/${encodeURIComponent(creatorId)}/posts?videoOnly=false`)
    if (!res.ok) throw new Error("No se pudieron cargar las publicaciones.")
    const raw = await res.json()
    const posts: any[] = Array.isArray(raw) ? raw : raw.posts || []
    return posts.map((p, i) => {
      const kind = classifyPostKind(p)
      const durationSec = p.durationSec
        ? Number(p.durationSec)
        : p.duration
          ? Math.round(Number(p.duration) / 1000)
          : undefined
      return {
        id: String(p.id),
        creatorId,
        kind,
        title: p.title || "Sin título",
        description: stripHtml(p.description || p.content || ""),
        publishedAt: p.publishedAt || p.published_at || new Date().toISOString(),
        durationSec,
        art: p.thumbnailUrl || p.thumbnail || p.art || "",
        color: ART_COLORS[i % ART_COLORS.length],
        locked: Boolean(p.isLocked || p.locked),
      }
    })
  },

  async search(query: string): Promise<ContentItem[]> {
    if (demoActive) {
      const q = query.toLowerCase()
      return CONTENT.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          CREATORS.find((c) => c.id === item.creatorId)?.name.toLowerCase().includes(q),
      )
    }
    return []
  },
}

// ==========================================
// AUDIO PORT (window.PersonalAudio)
// ==========================================
let audioStatus: PlaybackStatus<AudioState> = { state: "closed", position: 0, duration: 0 }
const audioListeners = new Set<() => void>()

function updateAudioStatus(next: Partial<PlaybackStatus<AudioState>>) {
  const merged = { ...audioStatus, ...next }
  if (
    merged.state === audioStatus.state &&
    merged.position === audioStatus.position &&
    merged.duration === audioStatus.duration &&
    merged.error === audioStatus.error
  ) {
    return
  }
  audioStatus = merged
  audioListeners.forEach((fn) => {
    try {
      fn()
    } catch {}
  })
}

// Background status poller for native audio
let audioPoller: ReturnType<typeof setInterval> | null = null

function ensureAudioPoller() {
  if (audioPoller) return
  audioPoller = setInterval(() => {
    if (typeof window === "undefined" || !window.PersonalAudio?.status) return
    if (demoActive) return // Demo manages simulated status timer
    try {
      const raw = window.PersonalAudio.status()
      const st = typeof raw === "string" ? JSON.parse(raw) : raw
      if (!st) return

      let state: AudioState = "closed"
      if (st.error) {
        state = "error"
      } else if (st.playing) {
        state = "playing"
      } else if (st.id) {
        state = "paused"
      }

      // Convert from ms to seconds
      const position = Math.max(0, Math.round((Number(st.position) || 0) / 1000))
      const duration = Math.max(0, Math.round((Number(st.duration) || 0) / 1000))

      updateAudioStatus({
        state,
        position,
        duration: duration || audioStatus.duration,
        error: st.error || undefined,
      })
    } catch {}
  }, 500)
}

ensureAudioPoller()

const audio: AudioPort = {
  getStatus: () => audioStatus,
  subscribe: (l) => {
    audioListeners.add(l)
    return () => {
      audioListeners.delete(l)
    }
  },
  async play(item: ContentItem) {
    // Stop any video playing first
    video.close()

    if (demoActive) {
      const dur = item.durationSec || 180
      updateAudioStatus({ state: "playing", position: 0, duration: dur, error: undefined })
      startDemoAudioTimer()
      return
    }

    updateAudioStatus({ state: "loading", position: 0, duration: item.durationSec || 0, error: undefined })

    try {
      // Obtain playable media stream from /api/posts/{id}/video
      const res = await fetch(`/api/posts/${encodeURIComponent(item.id)}/video`)
      if (!res.ok) throw new Error("No se pudo obtener el audio reproducible.")
      const media = await res.json()
      if (!media.url) throw new Error("URL de audio no disponible.")

      const creator = creatorById(item.creatorId)
      if (window.PersonalAudio?.play) {
        window.PersonalAudio.play(
          JSON.stringify({
            id: item.id,
            url: media.url,
            title: item.title,
            creator: creator?.name || "",
            artwork: item.art || "",
          }),
        )
      }
    } catch (e: any) {
      updateAudioStatus({ state: "error", error: e?.message || "Error al reproducir audio" })
    }
  },
  toggle() {
    if (demoActive) {
      if (audioStatus.state === "playing") {
        updateAudioStatus({ state: "paused" })
        stopDemoAudioTimer()
      } else {
        updateAudioStatus({ state: "playing" })
        startDemoAudioTimer()
      }
      return
    }
    window.PersonalAudio?.toggle?.()
  },
  seekTo(seconds: number) {
    if (demoActive) {
      updateAudioStatus({ position: Math.max(0, Math.min(audioStatus.duration, seconds)) })
      return
    }
    window.PersonalAudio?.seekTo?.(Math.round(seconds * 1000))
  },
  stop() {
    if (demoActive) {
      stopDemoAudioTimer()
      updateAudioStatus({ state: "closed", position: 0, duration: 0, error: undefined })
      return
    }
    window.PersonalAudio?.stop?.()
    updateAudioStatus({ state: "closed", position: 0, duration: 0, error: undefined })
  },
}

// ==========================================
// VIDEO PORT & CONTROLLER
// ==========================================
let videoStatus: PlaybackStatus<VideoState> = { state: "closed", position: 0, duration: 0 }
const videoListeners = new Set<() => void>()

export interface VideoPlaybackController {
  videoEl: HTMLVideoElement | null
  hlsInstance: any | null
  currentUrl: string
  currentType: "hls" | "mp4" | "embed"
  currentItem: ContentItem | null
}

export const videoController: VideoPlaybackController = {
  videoEl: null,
  hlsInstance: null,
  currentUrl: "",
  currentType: "mp4",
  currentItem: null,
}

export function updateVideoStatus(next: Partial<PlaybackStatus<VideoState>>) {
  const merged = { ...videoStatus, ...next }
  if (
    merged.state === videoStatus.state &&
    merged.position === videoStatus.position &&
    merged.duration === videoStatus.duration &&
    merged.error === videoStatus.error
  ) {
    return
  }
  videoStatus = merged
  videoListeners.forEach((fn) => {
    try {
      fn()
    } catch {}
  })
}

const video: VideoPort = {
  getStatus: () => videoStatus,
  subscribe: (l) => {
    videoListeners.add(l)
    return () => {
      videoListeners.delete(l)
    }
  },
  async open(item: ContentItem) {
    // Stop native audio so they never play simultaneously
    audio.stop()

    videoController.currentItem = item
    updateVideoStatus({ state: "opening", position: 0, duration: item.durationSec || 0, error: undefined })
  },
  play() {
    videoController.videoEl?.play().catch(() => {})
  },
  pause() {
    videoController.videoEl?.pause()
  },
  seekTo(seconds: number) {
    if (videoController.videoEl) {
      videoController.videoEl.currentTime = seconds
      updateVideoStatus({ position: Math.round(seconds) })
    }
  },
  close() {
    if (videoController.hlsInstance) {
      videoController.hlsInstance.destroy()
      videoController.hlsInstance = null
    }
    if (videoController.videoEl) {
      videoController.videoEl.pause()
      videoController.videoEl.removeAttribute("src")
      videoController.videoEl.load()
    }
    videoController.currentUrl = ""
    videoController.currentItem = null
    updateVideoStatus({ state: "closed", position: 0, duration: 0, error: undefined })
  },
}

export const hostIntegration: Integration = {
  auth,
  data,
  audio,
  video,
}
