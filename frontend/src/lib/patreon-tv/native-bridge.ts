export interface NativeAudioStatus {
  state?: "closed" | "loading" | "playing" | "paused" | "buffering" | "error"
  position?: number
  duration?: number
  title?: string
  creator?: string
  artwork?: string
  error?: string
}

export interface PersonalAudioBridge {
  play?: (...args: unknown[]) => unknown
  playTrack?: (...args: unknown[]) => unknown
  toggle?: (...args: unknown[]) => unknown
  seek?: (...args: unknown[]) => unknown
  seekTo?: (...args: unknown[]) => unknown
  stop?: (...args: unknown[]) => unknown
  status?: (...args: unknown[]) => NativeAudioStatus | Promise<NativeAudioStatus>
}

declare global { interface Window { PersonalAudio?: PersonalAudioBridge } }

export function getAudioBridge() { return typeof window !== "undefined" ? window.PersonalAudio : undefined }
export function sendAudioCommand(command: keyof PersonalAudioBridge, ...args: unknown[]) {
  const fn = getAudioBridge()?.[command]
  return typeof fn === "function" ? fn(...args) : undefined
}

export const API_ENDPOINTS = {
  authStatus: "/api/auth/status", authLogin: "/api/auth/login", authSession: "/api/auth/session", authLogout: "/api/auth/logout",
  campaigns: "/api/campaigns", campaignPosts: (id: string) => `/api/campaigns/${encodeURIComponent(id)}/posts`,
} as const

export type NativeVideoState = "closed" | "opening" | "poster" | "buffering" | "ready" | "playing" | "paused" | "error"
