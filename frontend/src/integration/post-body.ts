/**
 * Full Patreon post bodies.
 * The catalog list endpoint returns `content: null` (verified on device 2026-11-08); the native bridge
 * fetches /api/posts/{id} on demand via `PersonalAudio.postBody(id)` and answers through
 * `window.__ctvPostBody(json)`. Results are cached per id for the session.
 */
import type { ContentItem } from "@/lib/patreon-tv/types"

export type BodyState = "loading" | "ready" | "partial" | "empty" | "locked" | "error"
export interface PostBody {
  state: BodyState
  html: string
  error?: string
}

type Raw = { id?: string; content?: string; contentJson?: string; teaser?: string; canView?: boolean; error?: string }

declare global {
  interface Window {
    __ctvPostBody?: (json: string) => void
  }
}

const cache = new Map<string, PostBody>()
const waiters = new Map<string, ((b: PostBody) => void)[]>()
const TIMEOUT_MS = 15000

function toBody(raw: Raw, item: ContentItem): PostBody {
  if (raw.error === "locked" || raw.canView === false || item.locked) {
    return { state: "locked", html: raw.teaser || "" }
  }
  if (raw.error && raw.error !== "") return { state: "error", html: "", error: raw.error }
  // Patreon's current editor stores bodies as ProseMirror JSON; `content` is null for those posts.
  const content = ((raw.content || "").trim() || proseMirrorToHtml(raw.contentJson || "")).trim()
  if (content) return { state: "ready", html: content }
  if ((raw.teaser || "").trim()) return { state: "partial", html: raw.teaser || "" }
  return { state: "empty", html: "" }
}

function settle(id: string, body: PostBody) {
  if (body.state !== "error") cache.set(id, body)
  const list = waiters.get(id) || []
  waiters.delete(id)
  list.forEach((fn) => fn(body))
}

export function loadPostBody(item: ContentItem): Promise<PostBody> {
  const hit = cache.get(item.id)
  if (hit) return Promise.resolve(hit)
  const bridge = typeof window !== "undefined" ? window.PersonalAudio : undefined
  if (!bridge?.postBody) {
    // Browser/demo: whatever the catalog already had.
    const html = item.description || ""
    return Promise.resolve(html ? { state: "ready", html } : { state: "empty", html: "" })
  }
  return new Promise((resolve) => {
    const pending = waiters.get(item.id)
    if (pending) {
      pending.push(resolve)
      return
    }
    waiters.set(item.id, [resolve])
    window.__ctvPostBody = (json: string) => {
      try {
        const raw: Raw = JSON.parse(json)
        const target = getAllPending().find((p) => p.id === raw.id)
        if (target) settle(target.id, toBody(raw, target))
      } catch {
        /* ignore malformed */
      }
    }
    pendingItems.set(item.id, item)
    try {
      bridge.postBody!(item.id)
    } catch {
      settle(item.id, { state: "error", html: "", error: "bridge" })
    }
    setTimeout(() => {
      if (waiters.has(item.id)) settle(item.id, { state: "error", html: "", error: "timeout" })
    }, TIMEOUT_MS)
  })
}

const pendingItems = new Map<string, ContentItem>()
function getAllPending() {
  return [...pendingItems.values()]
}

// ---------------------------------------------------------------------------
// Sanitising: Patreon HTML → a small, TV-safe subset (no scripts, styles, iframes or handlers).
// ---------------------------------------------------------------------------
const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "blockquote", "img", "figure", "figcaption", "hr", "code", "pre", "span", "div",
])

export interface SafeNode {
  tag: string
  text?: string
  href?: string
  src?: string
  children?: SafeNode[]
}

export function sanitize(html: string): SafeNode[] {
  if (!html) return []
  if (!/[<&]/.test(html)) return html.split(/\n{2,}/).map((t) => ({ tag: "p", children: [{ tag: "#text", text: t }] }))
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const walk = (node: Node): SafeNode[] => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ tag: "#text", text: node.textContent }] : []
    if (node.nodeType !== Node.ELEMENT_NODE) return []
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    const kids = [...el.childNodes].flatMap(walk)
    if (!ALLOWED.has(tag)) return kids // unwrap unknown containers, drop their attributes
    const out: SafeNode = { tag, children: kids }
    if (tag === "a") {
      const href = el.getAttribute("href") || ""
      if (/^https?:\/\//i.test(href)) out.href = href
    }
    if (tag === "img") {
      const src = el.getAttribute("src") || ""
      if (!/^https:\/\//i.test(src)) return []
      out.src = src
      out.children = []
    }
    return [out]
  }
  return [...doc.body.firstChild!.childNodes].flatMap(walk)
}

export function plainText(html: string): string {
  if (!html) return ""
  if (!/[<&]/.test(html)) return html
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n"), "text/html")
  return doc.body.textContent || ""
}

// ---------------------------------------------------------------------------
// Chapters: "00:00 Intro", "1:02:33 - Tema", "[12:30] Algo", "Tema (12:30)"
// ---------------------------------------------------------------------------
export interface Chapter {
  start: number
  title: string
}

const TS = /(?:^|[\s[(])((?:\d{1,2}:)?\d{1,2}:\d{2})(?=[\s\])\-–—:.]|$)/

function toSeconds(ts: string) {
  return ts.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0)
}

export function parseChapters(text: string, duration = 0): Chapter[] {
  const out: Chapter[] = []
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim()
    if (!line || line.length > 160) continue
    const m = line.match(TS)
    if (!m) continue
    const start = toSeconds(m[1])
    let title = line.replace(m[0], " ").replace(/[()[\]]/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s\-–—:.|·•[\]()]+|[\s\-–—:.|·•[\]()]+$/g, "").trim()
    if (!title) title = `Capítulo ${out.length + 1}`
    if (duration && start >= duration) continue
    out.push({ start, title })
  }
  out.sort((a, b) => a.start - b.start)
  const dedup = out.filter((c, i) => i === 0 || c.start > out[i - 1].start)
  // A real chapter list has ≥2 entries, starts near the beginning and increases.
  if (dedup.length < 2 || dedup[0].start > 600) return []
  return dedup
}

// ---------------------------------------------------------------------------
// ProseMirror (content_json_string) → minimal HTML. Text is escaped; unknown nodes keep their text.
// ---------------------------------------------------------------------------
type PMNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type?: string; attrs?: Record<string, unknown> }[]; content?: PMNode[] }

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function proseMirrorToHtml(json: string): string {
  if (!json) return ""
  let doc: PMNode
  try {
    doc = JSON.parse(json)
  } catch {
    return ""
  }
  const inner = (n: PMNode): string => (n.content || []).map(node).join("")
  const node = (n: PMNode): string => {
    const t = (n.type || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase()) // snake → camel
    if (t === "text") {
      let out = esc(n.text || "")
      for (const m of n.marks || []) {
        const mt = m.type || ""
        if (mt === "bold" || mt === "strong") out = `<strong>${out}</strong>`
        else if (mt === "italic" || mt === "em") out = `<em>${out}</em>`
        else if (mt === "underline") out = `<u>${out}</u>`
        else if (mt === "strike" || mt === "strikethrough") out = `<s>${out}</s>`
        else if (mt === "code") out = `<code>${out}</code>`
        else if (mt === "link") out = `<a href="${esc(String(m.attrs?.href || ""))}">${out}</a>`
      }
      return out
    }
    switch (t) {
      case "doc":
        return inner(n)
      case "paragraph":
        return `<p>${inner(n)}</p>`
      case "heading": {
        const lvl = Math.min(4, Math.max(1, Number(n.attrs?.level) || 2))
        return `<h${lvl}>${inner(n)}</h${lvl}>`
      }
      case "bulletList":
        return `<ul>${inner(n)}</ul>`
      case "orderedList":
        return `<ol>${inner(n)}</ol>`
      case "listItem":
        return `<li>${inner(n)}</li>`
      case "blockquote":
        return `<blockquote>${inner(n)}</blockquote>`
      case "hardBreak":
        return "<br>"
      case "horizontalRule":
        return "<hr>"
      case "codeBlock":
        return `<pre>${inner(n)}</pre>`
      case "image": {
        const src = String(n.attrs?.src || "")
        return /^https:\/\//i.test(src) ? `<figure><img src="${esc(src)}">${n.attrs?.title ? `<figcaption>${esc(String(n.attrs.title))}</figcaption>` : ""}</figure>` : ""
      }
      default:
        return inner(n) // embeds, mentions, unknown blocks: keep any text they carry
    }
  }
  return node(doc)
}
