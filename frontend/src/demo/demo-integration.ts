import type {
  AudioPort,
  AudioState,
  Integration,
  PlaybackStatus,
  VideoPort,
  VideoState,
} from "@/integration/types"
import { CONTENT, CREATORS, contentForCreator } from "./demo-data"

function createSimulatedPlayer<S extends string>(closed: S, playing: S, paused: S) {
  let status: PlaybackStatus<S> = { state: closed, position: 0, duration: 0 }
  let timer: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<() => void>()

  const set = (next: Partial<PlaybackStatus<S>>) => {
    status = { ...status, ...next }
    listeners.forEach((l) => l())
  }
  const stopTimer = () => {
    if (timer) clearInterval(timer)
    timer = null
  }
  const startTimer = () => {
    stopTimer()
    timer = setInterval(() => {
      const next = status.position + 1
      if (next >= status.duration) {
        stopTimer()
        set({ position: status.duration, state: paused })
      } else {
        set({ position: next })
      }
    }, 1000)
  }

  return {
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start(duration: number) {
      set({ state: playing, position: 0, duration })
      startTimer()
    },
    resume() {
      if (status.state === closed) return
      set({ state: playing })
      startTimer()
    },
    pause() {
      if (status.state === closed) return
      stopTimer()
      set({ state: paused })
    },
    seekTo(seconds: number) {
      if (status.state === closed) return
      set({ position: Math.max(0, Math.min(status.duration, seconds)) })
    },
    close() {
      stopTimer()
      set({ state: closed, position: 0, duration: 0 })
    },
    isPlaying: () => status.state === playing,
  }
}

const audioPlayer = createSimulatedPlayer<AudioState>("closed", "playing", "paused")
const videoPlayer = createSimulatedPlayer<VideoState>("closed", "playing", "paused")

const audio: AudioPort = {
  getStatus: audioPlayer.getStatus,
  subscribe: audioPlayer.subscribe,
  play: (item) => audioPlayer.start(item.durationSec ?? 180),
  toggle: () => (audioPlayer.isPlaying() ? audioPlayer.pause() : audioPlayer.resume()),
  seekTo: audioPlayer.seekTo,
  stop: audioPlayer.close,
}

const video: VideoPort = {
  getStatus: videoPlayer.getStatus,
  subscribe: videoPlayer.subscribe,
  open: (item) => videoPlayer.start(item.durationSec ?? 180),
  play: videoPlayer.resume,
  pause: videoPlayer.pause,
  seekTo: videoPlayer.seekTo,
  close: videoPlayer.close,
}

export const demoIntegration: Integration = {
  auth: {
    isAuthenticated: async () => false,
    login: async () => {},
    logout: async () => {},
  },
  data: {
    listCreators: async () => CREATORS,
    listContent: async (creatorId) => contentForCreator(creatorId),
    search: async (query) => {
      const q = query.toLowerCase()
      return CONTENT.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          CREATORS.find((c) => c.id === item.creatorId)?.name.toLowerCase().includes(q),
      )
    },
  },
  audio,
  video,
}
