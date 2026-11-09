/**
 * Expressive UI sounds, synthesised with WebAudio (no assets, ~0 ms latency).
 * Soft "bubble pops": a sine body with a fast downward pitch bend + a tiny filtered
 * transient, so they feel round and tactile rather than beepy. Direction changes pitch
 * (left/up lower, right/down higher); confirm = rising two-note, back = falling two-note.
 * Disable with localStorage "ctv:sounds" = "off".
 */
type Kind = "tick" | "select" | "open" | "back" | "left" | "right" | "up" | "down"

let ctx: AudioContext | null = null
let master: GainNode | null = null
let last = 0

function ac() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" })
    master = ctx.createGain()
    master.gain.value = 0.18
    // gentle low-pass keeps everything warm on TV speakers
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 5200
    master.connect(lp).connect(ctx.destination)
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function pop(c: AudioContext, at: number, freq: number, gain: number, dur = 0.09, bend = 0.55) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = "sine"
  o.frequency.setValueAtTime(freq * 1.6, at)
  o.frequency.exponentialRampToValueAtTime(freq, at + 0.018)
  o.frequency.exponentialRampToValueAtTime(freq * bend, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(master!)
  o.start(at)
  o.stop(at + dur + 0.02)
  // tactile transient: 6 ms of band-passed noise
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.006), c.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
  const n = c.createBufferSource()
  n.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = "bandpass"
  bp.frequency.value = freq * 3
  const ng = c.createGain()
  ng.gain.value = gain * 0.6
  n.connect(bp).connect(ng).connect(master!)
  n.start(at)
}

const BASE: Record<string, number> = { left: 740, up: 700, tick: 800, right: 880, down: 840 }

export const soundsEnabled = () => {
  try {
    return localStorage.getItem("ctv:sounds") === "on"
  } catch {
    return true
  }
}
export function setSoundsEnabled(on: boolean) {
  try {
    localStorage.setItem("ctv:sounds", on ? "on" : "off")
  } catch {
    /* ignore */
  }
}

export function uiSound(kind: Kind) {
  try {
    if (localStorage.getItem("ctv:sounds") !== "on") return
    const now = performance.now()
    const directional = kind in BASE
    if (directional && now - last < 55) return // key-repeat: no machine-gun
    last = now
    const c = ac()
    const t = c.currentTime + 0.005
    if (directional) pop(c, t, BASE[kind] * (0.97 + Math.random() * 0.06), 0.09, 0.07, 0.6)
    else if (kind === "select") {
      pop(c, t, 620, 0.12, 0.1, 0.8)
      pop(c, t + 0.06, 930, 0.1, 0.14, 0.85)
    } else if (kind === "back") {
      pop(c, t, 820, 0.1, 0.09, 0.7)
      pop(c, t + 0.055, 520, 0.09, 0.13, 0.7)
    } else if (kind === "open") {
      pop(c, t, 480, 0.1, 0.12, 1.4) // upward bend: "bloop"
    }
  } catch {
    /* audio unavailable: silent */
  }
}
