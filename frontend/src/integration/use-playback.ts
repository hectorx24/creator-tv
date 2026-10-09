import { useCallback, useSyncExternalStore } from "react"
import { getIntegration } from "./registry"
import type { AudioState, PlaybackSource, PlaybackStatus, VideoState } from "./types"

const IDLE_AUDIO: PlaybackStatus<AudioState> = { state: "closed", position: 0, duration: 0 }
const IDLE_VIDEO: PlaybackStatus<VideoState> = { state: "closed", position: 0, duration: 0 }
const noopSubscribe = () => () => {}

function usePlaybackStatus<S extends string>(source: PlaybackSource<S> | undefined, idle: PlaybackStatus<S>) {
  const subscribe = useCallback((l: () => void) => (source ? source.subscribe(l) : noopSubscribe()), [source])
  const getSnapshot = useCallback(() => (source ? source.getStatus() : idle), [source, idle])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const useAudioStatus = () => usePlaybackStatus(getIntegration("audio"), IDLE_AUDIO)
export const useVideoStatus = () => usePlaybackStatus(getIntegration("video"), IDLE_VIDEO)
