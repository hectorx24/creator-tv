/**
 * Spatial D-pad focus navigation (DOM-level, framework-free).
 *
 * Every focusable control opts in with `data-nav`. Controls are grouped into
 * visual ROWS by the vertical centre of their bounding box, and rows are
 * ordered top → bottom, so navigation always matches what is on screen:
 *   LEFT / RIGHT  → previous / next control inside the current row
 *   UP / DOWN     → previous / next row (closest horizontal position)
 */

export type Dir = "up" | "down" | "left" | "right"

export interface NavBox {
  id: number
  cx: number
  cy: number
  h: number
}

/** Elements whose centres are within this many px vertically share a row. */
export const ROW_TOLERANCE = 24

export function groupRows(boxes: NavBox[], tolerance = ROW_TOLERANCE): NavBox[][] {
  const sorted = [...boxes].sort((a, b) => a.cy - b.cy || a.cx - b.cx)
  const rows: NavBox[][] = []
  let rowTop = Number.NEGATIVE_INFINITY
  for (const box of sorted) {
    if (rows.length === 0 || box.cy - rowTop > tolerance) {
      rows.push([box])
      rowTop = box.cy
    } else {
      rows[rows.length - 1].push(box)
    }
  }
  return rows.map((row) => row.sort((a, b) => a.cx - b.cx))
}

/** Pure target selection. Returns the id to focus, or `null` at an edge. */
export function pickTarget(boxes: NavBox[], currentId: number | null, dir: Dir, tolerance = ROW_TOLERANCE): number | null {
  if (boxes.length === 0) return null
  const rows = groupRows(boxes, tolerance)
  const current = boxes.find((b) => b.id === currentId)
  if (!current) return rows[0][0].id // nothing focused → first control, top-left

  const rowIndex = rows.findIndex((row) => row.some((b) => b.id === current.id))
  const row = rows[rowIndex]
  const col = row.findIndex((b) => b.id === current.id)

  if (dir === "left") return col > 0 ? row[col - 1].id : null
  if (dir === "right") return col < row.length - 1 ? row[col + 1].id : null

  const target = rows[rowIndex + (dir === "down" ? 1 : -1)]
  if (!target) return null
  let best = target[0]
  for (const b of target) if (Math.abs(b.cx - current.cx) < Math.abs(best.cx - current.cx)) best = b
  return best.id
}

// ───────────────────────── DOM layer ─────────────────────────

const NAV_SELECTOR = "[data-nav]"

function isVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const style = getComputedStyle(el)
  return style.visibility !== "hidden" && style.display !== "none"
}

/** The screen that currently owns the remote: the last visible `[data-tv-screen]`. */
export function activeScreen(doc: Document = document): HTMLElement | null {
  const screens = Array.from(doc.querySelectorAll<HTMLElement>("[data-tv-screen]"))
  for (let i = screens.length - 1; i >= 0; i--) {
    const rect = screens[i].getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(screens[i]).display !== "none") return screens[i]
  }
  return null
}

/** Controls reachable right now: the active screen plus any docked widget it allows. */
export function navigables(doc: Document = document): HTMLElement[] {
  const screen = activeScreen(doc)
  if (!screen) return []
  const found = new Set<HTMLElement>(screen.querySelectorAll<HTMLElement>(NAV_SELECTOR))
  if (screen.hasAttribute("data-tv-dock-ok")) {
    doc.querySelectorAll<HTMLElement>(`[data-tv-dock] ${NAV_SELECTOR}`).forEach((el) => found.add(el))
  }
  return Array.from(found).filter(isVisible)
}

function toBox(el: HTMLElement, id: number): NavBox {
  const r = el.getBoundingClientRect()
  return { id, cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height }
}

export function focusEl(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  el.focus({ preventScroll: true })
  el.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  return document.activeElement === el
}

export function focusFirst(doc: Document = document): boolean {
  const els = navigables(doc)
  if (els.length === 0) return false
  const preferred = els.find((el) => el.hasAttribute("data-nav-default")) ?? null
  if (preferred) return focusEl(preferred)
  const boxes = els.map((el, i) => toBox(el, i))
  const first = pickTarget(boxes, null, "down")
  return focusEl(first === null ? els[0] : els[first])
}

/** Move focus one step. Returns true when the key was handled (even at an edge). */
export function moveFocus(dir: Dir, doc: Document = document): boolean {
  const els = navigables(doc)
  if (els.length === 0) return false
  const active = doc.activeElement as HTMLElement | null
  let currentIdx = active ? els.findIndex((el) => el === active || el.contains(active)) : -1
  if (currentIdx < 0) return focusFirst(doc)
  const boxes = els.map((el, i) => toBox(el, i))
  const targetIdx = pickTarget(boxes, currentIdx, dir)
  if (targetIdx === null) return true // edge: stay put, never escape the screen
  return focusEl(els[targetIdx]) || true
}

/** Focus a control by its stable `data-nav-id`, else fall back to the first control. */
export function focusById(id: string | null | undefined, doc: Document = document): boolean {
  if (id) {
    const el = navigables(doc).find((n) => n.getAttribute("data-nav-id") === id)
    if (el) return focusEl(el)
  }
  return focusFirst(doc)
}

export function currentNavId(doc: Document = document): string | null {
  const el = doc.activeElement as HTMLElement | null
  return el?.closest?.("[data-nav-id]")?.getAttribute("data-nav-id") ?? null
}

/**
 * Safety net: if focus falls onto <body> (the focused node was unmounted or
 * hidden), put it back on a visible control on the next frame.
 */
export function installFocusRecovery(doc: Document = document): () => void {
  let raf = 0
  const check = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const a = doc.activeElement
      if ((!a || a === doc.body || a === doc.documentElement) && navigables(doc).length > 0) focusFirst(doc)
    })
  }
  doc.addEventListener("focusout", check, true)
  // React may mount the first screen after the startup animation, with no
  // previously focused control to emit focusout. Recover on DOM mounts too.
  const observer = new MutationObserver(check)
  observer.observe(doc.documentElement, { childList: true, subtree: true })
  check()
  return () => {
    doc.removeEventListener("focusout", check, true)
    observer.disconnect()
    cancelAnimationFrame(raf)
  }
}
