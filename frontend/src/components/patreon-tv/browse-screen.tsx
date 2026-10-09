import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { spring, exitTween } from "@/lib/patreon-tv/motion-tokens"
import { Lock, Play, Search, ChevronDown, FileText } from "lucide-react"
import type { ContentItem, ContentKind } from "@/lib/patreon-tv/types"
import { creatorById } from "@/integration/catalog"
import { formatDate, formatClock, KIND_LABEL } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { activeScreen, currentNavId, focusById } from "@/navigation/focus-nav"
import { Artwork } from "./artwork"
import { PatreonTvLogo } from "./logo"

type Tab = "latest" | ContentKind

const TABS: { id: Tab; label: string }[] = [
  { id: "latest", label: "Últimos" },
  { id: "video", label: "Vídeos" },
  { id: "audio", label: "Audio" },
  { id: "text", label: "Texto" },
]

export function BrowseScreen({
  creatorId,
  items,
  onSwitchCreator,
  onOpenSearch,
  onOpenItem,
  active = true,
}: {
  active?: boolean
  creatorId: string
  items: ContentItem[]
  onSwitchCreator: () => void
  onOpenSearch: () => void
  onOpenItem: (item: ContentItem) => void
}) {
  const creator = creatorById(creatorId)
  const [tab, setTab] = useState<Tab>("latest")
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const lastNav = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (tab === "latest") return items
    return items.filter((i) => i.kind === tab)
  }, [items, tab])

  useEffect(() => {
    setIndex(0)
  }, [tab])

  const count = filtered.length
  const current = filtered[index]
  const prev = count > 1 ? filtered[(index - 1 + count) % count] : undefined
  const next = count > 1 ? filtered[(index + 1) % count] : undefined

  const move = (dir: 1 | -1) => {
    if (count < 2) return
    setDirection(dir)
    setIndex((i) => (i + dir + count) % count)
  }

  // Remember where the remote was, and put it back when this screen is shown
  // again (after a video, the audio player, search or the reader closes).
  useEffect(() => {
    if (!active) return
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const restore = () => {
      const screen = activeScreen()
      // Wait until an exiting overlay (e.g. the audio player fading out) is gone.
      if (screen && rootRef.current && screen.contains(rootRef.current)) {
        focusById(lastNav.current ?? "hero")
      } else if (tries++ < 15) {
        timer = setTimeout(restore, 60)
      }
    }
    timer = setTimeout(restore, 0)
    return () => clearTimeout(timer)
  }, [active])

  // If the focused hero disappears (empty tab), fall back to the tab row.
  useEffect(() => {
    if (active && count === 0 && currentNavId() === "hero") focusById(`tab:${tab}`)
  }, [active, count, tab])

  useTvInput((action) => {
    if (!active) return false
    const nav = currentNavId()
    switch (action) {
      case "left":
      case "right":
        // On the hero, ←/→ page through the carousel (its neighbours sit left/right).
        if (nav === "hero") {
          move(action === "left" ? -1 : 1)
          return true
        }
        return false // otherwise: next/previous control in the same row
      case "ok":
        if (nav === "hero") {
          if (current) onOpenItem(current)
          return true
        }
        return false
      case "back":
        // First BACK from the header/tabs returns to the content; the next one leaves.
        if (nav !== "hero" && count > 0) {
          focusById("hero")
          return true
        }
        onSwitchCreator()
        return true
      default:
        return false // ↑/↓ → spatial navigation between rows
    }
  })

  return (
    <div
      ref={rootRef}
      className="ptv-screen"
      onFocusCapture={(e) => {
        const id = (e.target as HTMLElement).closest?.("[data-nav-id]")?.getAttribute("data-nav-id")
        if (id) lastNav.current = id
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(55% 45% at 20% 10%, var(--ptv-accent-soft) 0%, transparent 70%)",
        }}
      />

      <header className="relative z-10 flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-2.5">
<PatreonTvLogo className="h-8 w-8 rounded-lg object-cover shadow-[0_4px_14px_rgba(255,133,105,0.16)]" />
          <span className="text-lg font-bold tracking-tight">Patreon TV</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-nav
            data-nav-id="creator"
            onClick={onSwitchCreator}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
            style={{ color: "var(--ptv-muted)" }}
          >
            Creador: <span style={{ color: "var(--ptv-text)" }}>{creator?.name}</span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-nav
            data-nav-id="search"
            onClick={onOpenSearch}
            aria-label="Buscar"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)" }}
          >
            <Search className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="relative z-10 mt-[2.2vh] flex flex-shrink-0 justify-center">
        <div role="tablist" aria-label="Categorías" className="flex gap-1.5 rounded-full p-1.5" style={{ background: "var(--ptv-surface)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-nav
              data-nav-id={`tab:${t.id}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="rounded-full px-5 py-2 text-sm font-semibold"
              style={tab === t.id ? { background: "var(--ptv-raised)", color: "var(--ptv-text)" } : { color: "var(--ptv-muted)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="relative z-10 mt-[2.6vh] flex flex-shrink-0 items-end justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "var(--ptv-accent)" }}>
            BIBLIOTECA PERSONAL
          </p>
          <h1 className="ptv-h1 mt-1 font-bold tracking-tight text-balance">
            {tab === "latest" ? "Últimos episodios" : `Explorar ${TABS.find((t) => t.id === tab)?.label.toLowerCase()}`}
          </h1>
        </div>
        {count > 0 && (
          <p className="text-sm font-medium" style={{ color: "var(--ptv-muted-dim)" }}>
            {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </p>
        )}
      </div>

      <div className="ptv-fill relative z-10 mt-[2.4vh] flex items-center">
        {count === 0 ? (
          <div className="w-full rounded-2xl py-20 text-center" style={{ background: "var(--ptv-surface)", color: "var(--ptv-muted)" }}>
            No hay contenido en esta categoría todavía.
          </div>
        ) : (
          <div className="flex h-full w-full items-center gap-4">
            <SideCard item={prev} onClick={() => move(-1)} align="right" />

            <div
              data-nav
              data-nav-id="hero"
              data-nav-default
              tabIndex={0}
              role="group"
              aria-label={current ? `${current.title}. Pulsa OK para abrir` : undefined}
              className="ptv-hero"
            >
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                {current && (
                  <motion.div
                    key={current.id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -24, transition: exitTween }}
                    transition={spring.snappy}
                    className="grid h-full grid-cols-2"
                  >
                    <div className="relative h-full w-full overflow-hidden">
                      <Artwork src={current.art} color={current.color} alt="" className="h-full w-full" />
                      {current.locked && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(10,10,12,0.55)" }}>
                          <Lock className="h-10 w-10" style={{ color: "var(--ptv-muted)" }} aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-h-0 flex-col justify-center gap-[1.6vh] overflow-hidden px-[2.4vw] py-[2vh]">
                      <p className="text-xs font-bold tracking-[0.15em]" style={{ color: "var(--ptv-accent)" }}>
                        {KIND_LABEL[current.kind].toUpperCase()} · {formatDate(current.publishedAt)}
                      </p>
                      <h2 className="ptv-h2 line-clamp-3 font-bold text-balance">{current.title}</h2>
                      <p className="text-sm font-medium" style={{ color: "var(--ptv-muted)" }}>
                        {creator?.name}
                      </p>
                      <p className="line-clamp-3 text-sm leading-relaxed text-pretty" style={{ color: "var(--ptv-muted)" }}>
                        {current.description}
                      </p>

                      {current.locked ? (
                        <div
                          className="mt-2 flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                          style={{ background: "var(--ptv-raised)", color: "var(--ptv-muted)" }}
                        >
                          <Lock className="h-4 w-4" aria-hidden="true" />
                          Exclusivo para mecenas
                        </div>
                      ) : (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => onOpenItem(current)}
                          className="mt-2 flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                          style={{ background: "var(--ptv-text)", color: "#17141a" }}
                        >
                          {current.kind === "text" ? (
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          )}
                          {current.kind === "text" ? "Leer" : "Reproducir"}
                          {current.durationSec ? (
                            <span className="opacity-60">· {formatClock(current.durationSec)}</span>
                          ) : null}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <SideCard item={next} onClick={() => move(1)} align="left" />
          </div>
        )}
      </div>

      <footer className="relative z-10 mt-[1.6vh] flex flex-shrink-0 items-center justify-between text-xs" style={{ color: "var(--ptv-muted-dim)" }}>
        <span>← → Explorar · ↑ ↓ Moverse · OK Abrir · Atrás Volver</span>
        <span className="ptv-footer-brand">Patreon TV Personal</span>
      </footer>
    </div>
  )
}

function SideCard({
  item,
  onClick,
  align,
}: {
  item?: ContentItem
  onClick: () => void
  align: "left" | "right"
}) {
  if (!item) return <div className="ptv-side" />
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className="ptv-side relative block overflow-hidden rounded-2xl opacity-55"
      aria-label={`Ir a ${item.title}`}
    >
      <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.9) 100%)" }} />
      {item.locked && (
        <Lock className="absolute right-3 top-3 h-4 w-4" style={{ color: "var(--ptv-muted)" }} aria-hidden="true" />
      )}
      <span
        className={`absolute bottom-3 ${align === "left" ? "left-3 right-3" : "left-3 right-3"} truncate text-left text-sm font-semibold`}
      >
        {item.locked ? "Contenido bloqueado" : item.title}
      </span>
    </button>
  )
}
