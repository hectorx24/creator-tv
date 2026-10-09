import type { ContentItem, Creator } from "@/lib/patreon-tv/types"

/** What the login form collects. The host decides how these map to Patreon. */
export type LoginCredentials =
  | { method: "password"; email: string; password: string }
  | { method: "session"; sessionId: string }

export interface AuthPort {
  /** Optional. When present, the app skips the login screen if it resolves true. */
  isAuthenticated?(): Promise<boolean>
  login(credentials: LoginCredentials): Promise<void>
  logout(): Promise<void>
}

/**
 * Real creators, posts, artwork and search. The host adapter maps its own
 * response shapes to the presentation types in `lib/patreon-tv/types.ts`.
 */
export interface DataPort {
  listCreators(): Promise<Creator[]>
  listContent(creatorId: string): Promise<ContentItem[]>
  /** Optional. Without it, search filters the already loaded catalog locally. */
  search?(query: string): Promise<ContentItem[]>
}

export type AudioState = "closed" | "loading" | "playing" | "paused" | "buffering" | "error"
export type VideoState = "closed" | "opening" | "poster" | "buffering" | "ready" | "playing" | "paused" | "error"

export interface PlaybackStatus<S extends string> {
  state: S
  /** Seconds. */
  position: number
  /** Seconds. 0 while unknown. */
  duration: number
  error?: string
}

/**
 * `getStatus` MUST return the same object reference until the status changes,
 * and `subscribe` listeners MUST be called after every change (React
 * `useSyncExternalStore` contract).
 */
export interface PlaybackSource<S extends string> {
  getStatus(): PlaybackStatus<S>
  subscribe(listener: () => void): () => void
}

/** Native audio (`window.PersonalAudio`) is the authority; the UI only sends commands and renders status. */
export interface AudioPort extends PlaybackSource<AudioState> {
  play(item: ContentItem): void
  toggle(): void
  seekTo(seconds: number): void
  stop(): void
}

/** Native Media3/ExoPlayer is the authority; the UI never creates a video element. */
export interface VideoPort extends PlaybackSource<VideoState> {
  open(item: ContentItem): void
  play(): void
  pause(): void
  seekTo(seconds: number): void
  close(): void
}

export interface Integration {
  auth: AuthPort
  data: DataPort
  audio: AudioPort
  video: VideoPort
}
