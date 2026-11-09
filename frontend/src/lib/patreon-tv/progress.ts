/** Per-video resume points and player preferences (WebView localStorage; survives app restarts). */
const KEY = "ctv:progress:"
const PREFS = "ctv:prefs"

export interface Progress {
  pos: number
  dur: number
  at: number
}

export function getProgress(id: string): Progress | null {
  try {
    const raw = localStorage.getItem(KEY + id)
    return raw ? (JSON.parse(raw) as Progress) : null
  } catch {
    return null
  }
}

export function saveProgress(id: string, pos: number, dur: number) {
  try {
    if (!dur || pos < 5) return
    // Finished (or nearly): forget it so the next open starts from the beginning.
    if (pos > dur - 20) localStorage.removeItem(KEY + id)
    else localStorage.setItem(KEY + id, JSON.stringify({ pos: Math.floor(pos), dur: Math.floor(dur), at: Date.now() }))
  } catch {
    /* storage full/blocked: resume is best-effort */
  }
}

/** Fraction watched, for library progress bars. */
export function progressFraction(id: string): number {
  const p = getProgress(id)
  return p && p.dur ? Math.min(1, p.pos / p.dur) : 0
}

export interface PlayerPrefs {
  skip: number
  videoSpeed: number
  audioSpeed: number
}
const DEFAULTS: PlayerPrefs = { skip: 10, videoSpeed: 1, audioSpeed: 1 }
export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
export const nextSpeed = (s: number) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length] ?? 1
export const speedLabel = (s: number) => `${String(s).replace(".", ",")}×`
export const SKIP_STEPS = [5, 10, 15, 30, 60]

export function getPrefs(): PlayerPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS) || "{}") }
  } catch {
    return DEFAULTS
  }
}

export function setPrefs(next: Partial<PlayerPrefs>) {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ ...getPrefs(), ...next }))
  } catch {
    /* ignore */
  }
}
