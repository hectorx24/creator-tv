import { useEffect, useRef } from "react"
import { focusFirst, installFocusRecovery, moveFocus } from "./focus-nav"

export type TvAction = "up" | "down" | "left" | "right" | "ok" | "back" | "rewind" | "forward" | "playpause"

/** Return `true` when the action was consumed. */
export type TvHandler = (action: TvAction, event: KeyboardEvent) => boolean | void

interface Layer {
  handle: TvHandler
  modal: boolean
}

const KEY_ACTIONS: Record<string, TvAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "ok",
  " ": "ok",
  Select: "ok",
  MediaPlayPause: "playpause",
  MediaPlay: "playpause",
  MediaPause: "playpause",
  MediaFastForward: "forward",
  MediaRewind: "rewind",
  MediaTrackNext: "forward",
  MediaTrackPrevious: "rewind",
  Escape: "back",
  Backspace: "back",
  GoBack: "back",
  BrowserBack: "back",
}

// Android keycodes for TV remotes
const KEYCODE_ACTIONS: Record<number, TvAction> = {
  4: "back",
  19: "up",
  20: "down",
  21: "left",
  22: "right",
  23: "ok",
  66: "ok", // Enter
  85: "playpause", // KEYCODE_MEDIA_PLAY_PAUSE
  126: "playpause", // KEYCODE_MEDIA_PLAY
  127: "playpause", // KEYCODE_MEDIA_PAUSE
  87: "forward", // KEYCODE_MEDIA_NEXT
  88: "rewind", // KEYCODE_MEDIA_PREVIOUS
  89: "rewind", // KEYCODE_MEDIA_REWIND
  90: "forward", // KEYCODE_MEDIA_FAST_FORWARD
}

const layers: Layer[] = []
let installed = false

export function toAction(e: Pick<KeyboardEvent, "key" | "keyCode">): TvAction | undefined {
  return KEY_ACTIONS[e.key] ?? KEYCODE_ACTIONS[e.keyCode] ?? undefined
}

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** A text field keeps typing keys; a range slider is driven by the screen, not the browser. */
const isTextField = (t: EventTarget | null) =>
  isEditable(t) && !(t instanceof HTMLInputElement && t.type === "range")

const isNativeActivator = (t: EventTarget | null) =>
  t instanceof HTMLElement && !!t.closest('button, a[href], [role="button"], [role="tab"]')

const DIRECTIONAL = new Set<TvAction>(["up", "down", "left", "right"])

function onKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const action = toAction(e)
  if (!action) return

  if (isTextField(e.target)) {
    if (action === "ok") {
      try {
        ;(window as any).PersonalAudio?.showKeyboard?.()
      } catch {}
    }
    // Typing keeps its keys; Up/Down leave the field, an explicit back key closes it.
    const leaveField = action === "up" || action === "down"
    const explicitBack = action === "back" && e.key !== "Backspace"
    if (!leaveField && !explicitBack) return
  } else if (action === "ok" && isNativeActivator(e.target)) {
    // The focused control activates itself through its own click.
    return
  }

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (layer.handle(action, e) === true) {
      e.preventDefault()
      return
    }
    if (layer.modal && !DIRECTIONAL.has(action)) return
    if (layer.modal) break
  }

  // Default: spatial navigation over whatever is on screen.
  if (DIRECTIONAL.has(action) && moveFocus(action as "up" | "down" | "left" | "right")) {
    e.preventDefault()
  }
}

/** Installs the one and only key listener. Safe to call more than once. */
export function installTvInput() {
  if (installed || typeof window === "undefined") return
  installed = true
  window.addEventListener("keydown", onKeyDown)
  installFocusRecovery()
  // Give the first screen a focused control as soon as it exists.
  requestAnimationFrame(() => {
    if (!document.activeElement || document.activeElement === document.body) focusFirst()
  })
}

/**
 * Registers a screen as an input layer. The most recently mounted layer
 * receives actions first; a `modal` layer stops non-directional actions from
 * reaching layers below it. Directional keys that a layer does not consume
 * fall through to spatial navigation inside the active screen.
 */
/** Non-hook registration (used by useTvInput and by the DOM regression harness). */
export function registerTvLayer(handler: TvHandler, modal = false): () => void {
  const layer: Layer = { handle: handler, modal }
  layers.push(layer)
  return () => {
    const i = layers.indexOf(layer)
    if (i >= 0) layers.splice(i, 1)
  }
}

export function useTvInput(handler: TvHandler, { modal = false }: { modal?: boolean } = {}) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => registerTvLayer((a, e) => handlerRef.current(a, e), modal), [modal])
}
