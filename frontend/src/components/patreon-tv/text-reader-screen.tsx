import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion } from "motion/react"
import { ArrowLeft, Lock, Play, RotateCw } from "lucide-react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import { creatorById } from "@/integration/catalog"
import { formatDate, KIND_LABEL } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { focusById } from "@/navigation/focus-nav"
import { loadPostBody, sanitize, type PostBody, type SafeNode } from "@/integration/post-body"
import { Artwork } from "./artwork"

const BLOCK: Record<string, string> = {
  p: "my-[1.1em]",
  h1: "mt-8 mb-3 text-3xl font-bold",
  h2: "mt-8 mb-3 text-2xl font-bold",
  h3: "mt-6 mb-2 text-xl font-bold",
  h4: "mt-6 mb-2 text-lg font-bold",
  ul: "my-4 list-disc pl-8",
  ol: "my-4 list-decimal pl-8",
  li: "my-1.5",
  blockquote: "my-6 border-l-4 pl-5 italic",
  pre: "my-4 overflow-hidden whitespace-pre-wrap rounded-xl p-4 text-base",
  figure: "my-6",
  figcaption: "mt-2 text-sm",
  hr: "my-8 border-0 h-px",
}

function render(nodes: SafeNode[], key = "n"): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`
    if (n.tag === "#text") return n.text
    const kids = render(n.children || [], k)
    switch (n.tag) {
      case "br":
        return <br key={k} />
      case "hr":
        return <hr key={k} className={BLOCK.hr} style={{ background: "var(--ptv-line)" }} />
      case "img":
        return (
          <img
            key={k}
            src={n.src}
            alt=""
            loading="lazy"
            decoding="async"
            className="my-6 max-h-[60vh] w-auto max-w-full rounded-2xl"
          />
        )
      case "a":
        // No browser on the TV: show the link text with the destination host, not clickable.
        return (
          <span key={k} className="font-semibold underline decoration-2 underline-offset-4" style={{ color: "var(--ptv-accent)" }}>
            {kids}
            {n.href && !textOf(n).includes(host(n.href)) ? (
              <span className="ml-1 text-sm no-underline" style={{ color: "var(--ptv-muted-dim)" }}>
                ({host(n.href)})
              </span>
            ) : null}
          </span>
        )
      case "strong":
      case "b":
        return <strong key={k} style={{ color: "var(--ptv-text)" }}>{kids}</strong>
      case "em":
      case "i":
        return <em key={k}>{kids}</em>
      case "u":
        return <u key={k}>{kids}</u>
      case "s":
        return <s key={k}>{kids}</s>
      case "code":
        return <code key={k} className="rounded px-1.5" style={{ background: "var(--ptv-surface)" }}>{kids}</code>
      case "span":
      case "div":
        return n.tag === "div" ? <div key={k}>{kids}</div> : <span key={k}>{kids}</span>
      default: {
        const Tag = n.tag as "p"
        return (
          <Tag key={k} className={BLOCK[n.tag]} style={n.tag === "blockquote" ? { borderColor: "var(--ptv-accent)" } : n.tag === "pre" ? { background: "var(--ptv-surface)" } : undefined}>
            {kids}
          </Tag>
        )
      }
    }
  })
}

function textOf(n: SafeNode): string {
  return n.tag === "#text" ? n.text || "" : (n.children || []).map(textOf).join("")
}

function host(href: string) {
  try {
    return new URL(href).host.replace(/^www\./, "")
  } catch {
    return ""
  }
}

const STATE_COPY: Record<string, { title: string; body: string }> = {
  empty: { title: "Esta publicación no tiene texto", body: "El creador solo publicó el contenido multimedia." },
  locked: { title: "Contenido bloqueado", body: "Tu nivel de membresía no incluye esta publicación." },
  error: { title: "No se pudo cargar la publicación", body: "Comprueba la conexión y vuelve a intentarlo." },
}

export function TextReaderScreen({
  item,
  onBack,
  onPlay,
}: {
  item: ContentItem
  onBack: () => void
  onPlay?: (item: ContentItem) => void
}) {
  const creator = creatorById(item.creatorId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [body, setBody] = useState<PostBody>({ state: "loading", html: "" })
  const [attempt, setAttempt] = useState(0)
  const playable = item.kind !== "text" && !item.locked && onPlay

  useEffect(() => {
    let alive = true
    setBody({ state: "loading", html: "" })
    loadPostBody(item).then((b) => alive && setBody(b))
    return () => {
      alive = false
    }
  }, [item, attempt])

  useEffect(() => {
    if (body.state === "error") requestAnimationFrame(() => focusById("reader-retry"))
  }, [body.state])

  useTvInput(
    (action) => {
      if (action === "back") {
        onBack()
        return true
      }
      if (action === "up" || action === "down") {
        const el = scrollRef.current
        if (!el) return false
        const atTop = el.scrollTop <= 2
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
        if (action === "up" && atTop) return false // let focus reach the header buttons
        if (action === "down" && atBottom) return true
        el.scrollBy({ top: (action === "down" ? 1 : -1) * el.clientHeight * 0.6, behavior: "smooth" })
        return true
      }
      return false
    },
    { modal: true },
  )

  const nodes = body.state === "ready" || body.state === "partial" || (body.state === "locked" && body.html) ? sanitize(body.html) : []
  const copy = STATE_COPY[body.state]

  return (
    <div className="ptv-screen" data-tv-screen>
      <header className="flex flex-shrink-0 items-center justify-between gap-4">
        <button
          type="button"
          data-nav
          data-nav-id="reader-back"
          data-nav-default={playable ? undefined : true}
          onClick={onBack}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
          style={{ color: "var(--ptv-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Biblioteca
        </button>
        {playable && (
          <button
            type="button"
            data-nav
            data-nav-id="reader-play"
            data-nav-default
            onClick={() => onPlay!(item)}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--ptv-text)", color: "#17141a" }}
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            {item.kind === "video" ? "Ver vídeo" : "Escuchar"}
          </button>
        )}
      </header>

      <div ref={scrollRef} className="ptv-scroll mt-[2.5vh]" style={{ scrollbarWidth: "none" }}>
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl pb-16"
        >
          {item.art && (
            <div className="mb-6 h-[24vh] w-full overflow-hidden rounded-3xl">
              <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
            </div>
          )}
          <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "var(--ptv-accent)" }}>
            {creator?.name.toUpperCase()} · {KIND_LABEL[item.kind].toUpperCase()} · {formatDate(item.publishedAt)}
          </p>
          <h1 className="ptv-h1 mt-3 font-bold text-balance">{item.title}</h1>

          <div className="mt-6 text-[1.35rem] leading-[1.7] text-pretty" style={{ color: "var(--ptv-muted)" }}>
            {body.state === "loading" && (
              <div aria-label="Cargando publicación" className="flex flex-col gap-3">
                {[92, 100, 84, 96, 60].map((w, i) => (
                  <div key={i} className="ptv-skeleton h-5 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />
                ))}
              </div>
            )}
            {nodes.length > 0 && render(nodes)}
            {body.state === "partial" && (
              <p className="mt-6 text-base" style={{ color: "var(--ptv-muted-dim)" }}>
                Vista previa: Patreon solo envió un extracto de esta publicación.
              </p>
            )}
            {copy && (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl p-6" style={{ background: "var(--ptv-surface)" }}>
                <p className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--ptv-text)" }}>
                  {body.state === "locked" && <Lock className="h-5 w-5" aria-hidden="true" />}
                  {copy.title}
                </p>
                <p className="text-base">{copy.body}</p>
                {body.state === "error" && (
                  <button
                    type="button"
                    data-nav
                    data-nav-id="reader-retry"
                    onClick={() => setAttempt((a) => a + 1)}
                    className="mt-2 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                    style={{ background: "var(--ptv-raised)", color: "var(--ptv-text)" }}
                  >
                    <RotateCw className="h-4 w-4" aria-hidden="true" /> Reintentar
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.article>
      </div>
    </div>
  )
}
