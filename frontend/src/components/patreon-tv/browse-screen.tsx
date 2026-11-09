import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { spring, exitTween } from "@/lib/patreon-tv/motion-tokens"
import { Lock, Play, Search, ChevronDown, FileText } from "lucide-react"
import type { ContentItem, ContentKind } from "@/lib/patreon-tv/types"
import { creatorById, loadMore } from "@/integration/catalog"
import { groupSeries, seriesOf } from "@/lib/patreon-tv/series"
import { formatDate, formatClock, KIND_LABEL } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"
import { activeScreen, currentNavId, focusById } from "@/navigation/focus-nav"
import { Artwork, knownRatio } from "./artwork"
import { AnimatedLogo } from "./logo"
import { getProgress, progressFraction } from "@/lib/patreon-tv/progress"

type Tab = "latest" | "series" | Exclude<ContentKind, "text"> | "posts"

const TABS: { id: Tab; label: string }[] = [
  { id: "latest", label: "Todo" },
  { id: "series", label: "Series" },
  { id: "video", label: "Vídeos" },
  { id: "audio", label: "Audio" },
  { id: "posts", label: "Texto" },
]

export function BrowseScreen({
  creatorId,
  items,
  onSwitchCreator,
  onOpenSearch,
  onOpenItem,
  onReadItem,
  active = true,
}: {
  active?: boolean
  creatorId: string
  items: ContentItem[]
  onSwitchCreator: () => void
  onOpenSearch: () => void
  onOpenItem: (item: ContentItem) => void
  onReadItem?: (item: ContentItem) => void
}) {
  const creator = creatorById(creatorId)
  const [tab, setTab] = useState<Tab>("latest")
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const lastNav = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [logoRun, setLogoRun] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setLogoRun((n) => n + 1), 180_000)
    return () => clearInterval(t)
  }, [active])

  // A chosen series narrows every tab; BACK clears it.
  const [show, setShow] = useState<string | null>(null)
  const series = useMemo(() => groupSeries(items), [items])
  const filtered = useMemo(() => {
    const pool = show ? items.filter((i) => seriesOf(i)?.toLowerCase() === show.toLowerCase()) : items
    // Series tab: one card per show, represented by its newest post.
    if (tab === "series") return series.map((s) => ({ ...s.items[0], id: `series:${s.name}`, title: s.name }))
    if (tab === "latest" || tab === "posts") return pool
    return pool.filter((i) => i.kind === tab)
  }, [items, tab, show, series])

  useEffect(() => {
    setIndex(0)
  }, [tab, show])

  const openSeries = (name: string) => {
    setShow(name)
    setTab("latest")
    requestAnimationFrame(() => focusById("hero"))
  }

  const count = filtered.length
  const current = filtered[index]
  const reading = tab === "posts" || current?.kind === "text"
  const prev = count > 1 ? filtered[(index - 1 + count) % count] : undefined
  const next = count > 1 ? filtered[(index + 1) % count] : undefined

  useEffect(() => {
    if (count && index >= count - 4) void loadMore(creatorId)
  }, [index, count, creatorId])

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
          if (current && tab === "series") openSeries(current.title)
          else if (current) (tab === "posts" || current.kind === "text") && onReadItem ? onReadItem(current) : onOpenItem(current)
          return true
        }
        return false
      case "back":
        if (show) {
          setShow(null)
          return true
        }
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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(55% 45% at 20% 10%, var(--ptv-accent-soft) 0%, transparent 70%), radial-gradient(45% 40% at 85% 95%, var(--ptv-accent-soft) 0%, transparent 70%)" }} />

      <header className="relative z-10 flex flex-shrink-0 items-center justify-between">
        <div className="h-10 w-10">
          <AnimatedLogo className="h-full w-full" runKey={logoRun} delay={0.15} />
        </div>

        <div className="flex items-center gap-3">
        <AnimatePresence>
          {show && (
            <motion.span
              className="rounded-full px-4 py-2 text-sm font-bold"
              style={{ background: "var(--ptv-accent)", color: "#17141a" }}
              initial={{ opacity: 0, scale: 0.6, x: -12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 520, damping: 18 }}
            >
              {show}
            </motion.span>
          )}
        </AnimatePresence>
        <div role="tablist" aria-label="Categorías" className="flex gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.06)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-nav-lift
              data-nav
              data-nav-id={`tab:${t.id}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="relative rounded-full px-5 py-2 text-sm font-semibold"
              style={{ color: tab === t.id ? "#17141a" : "var(--ptv-muted)" }}
            >
              {tab === t.id && (
                <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--ptv-text)" }} transition={{ type: "spring", stiffness: 520, damping: 20, mass: 0.8 }} />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-nav
            data-nav-id="creator"
            onClick={onSwitchCreator}
            aria-label="Cambiar de creador"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
            style={{ background: "var(--ptv-surface)" }}
          >
            {creator?.avatar ? <Artwork src={creator.avatar} color={creator.color} alt="" className="h-full w-full" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            data-nav
            data-nav-id="search"
            onClick={onOpenSearch}
            aria-label="Buscar"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "var(--ptv-surface)" }}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="ptv-fill relative z-10 mt-[3vh] flex min-h-0 flex-col">
        {count === 0 ? (
          <div className="m-auto text-center text-lg" style={{ color: "var(--ptv-muted)" }}>
            Nada por aquí todavía
          </div>
        ) : (
          <>
            {/* Original album layout: peek – hero card – peek. Each artwork keeps its own format
                (square podcasts, wide videos). Everything slides on one expressive spring. */}
            <div className="flex min-h-0 flex-1 items-center justify-center gap-[2vw]">
              <Peek item={prev} dir={direction} side={-1} onClick={() => move(-1)} />

              <div
                data-nav
                data-nav-id="hero"
                data-nav-default
                tabIndex={0}
                role="group"
                aria-label={current ? current.title : undefined}
                className="ptv-stage ptv-ring relative h-[50vh] w-[66vw] min-w-0 flex-shrink-0 overflow-hidden rounded-[28px]"
                style={{ background: "var(--ptv-surface)" }}
              >
                <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                  {current && (
                    <motion.div
                      key={current.id}
                      className="flex h-full"
                      initial={{ opacity: 0, x: direction * 90 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -90, transition: { duration: 0.14 } }}
                      transition={SPRING}
                    >
                      <HeroArt item={current} />
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[1.6vh] px-[2vw]" style={{ ["--title" as string]: wide(current) ? "2.6vh" : "3.6vh" }}>
                        <motion.p
                          className="text-xs font-bold tracking-[0.16em]"
                          style={{ color: "var(--ptv-accent)" }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...SPRING, delay: 0.04 }}
                        >
                          {tab === "series" ? "SERIE" : `${KIND_LABEL[current.kind].toUpperCase()} · ${formatDate(current.publishedAt)}`}
                        </motion.p>
                        <motion.h2
                          className="line-clamp-4 font-bold leading-tight text-balance" style={{ fontSize: "var(--title)" }}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...SPRING, delay: 0.08 }}
                        >
                          {current.title}
                        </motion.h2>
                        {current.locked ? (
                          <div className="flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold" style={{ background: "var(--ptv-raised)", color: "var(--ptv-muted)" }}>
                            <Lock className="h-4 w-4" aria-hidden="true" /> Bloqueado
                          </div>
                        ) : (
                          <motion.span
                            className="ptv-cta mt-1 flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 520, damping: 16, delay: 0.12 }}
                            onClick={() => (tab === "series" ? openSeries(current.title) : reading && onReadItem ? onReadItem(current) : onOpenItem(current))}
                          >
                            {reading ? <FileText className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
                            {wide(current) ? null : tab === "series" ? "Ver episodios" : reading ? "Leer" : progressFraction(current.id) > 0 ? "Continuar" : "Reproducir"}
                            {current.durationSec && !reading && !wide(current) ? <span className="opacity-55">{formatClock(current.durationSec)}</span> : null}
                          </motion.span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Peek item={next} dir={direction} side={1} onClick={() => move(1)} />
            </div>

            {/* position dots: an expressive pill that stretches to the current item */}
            <div className="mt-[2.4vh] flex flex-shrink-0 justify-center gap-1.5">
              {filtered.slice(Math.max(0, index - 6), index + 7).map((it) => {
                const on = it.id === current?.id
                return (
                  <motion.span
                    key={it.id}
                    className="h-[6px] rounded-full"
                    animate={{ width: on ? 26 : 6, opacity: on ? 1 : 0.3 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    style={{ background: on ? "var(--ptv-text)" : "#fff" }}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const SPRING = { type: "spring", stiffness: 420, damping: 24, mass: 0.9 } as const

/** Square-ish art stays square, banners stay wide; never cropped beyond 1:1…16:9. */
function fit(r?: number, kind?: string) {
  const ratio = r ?? (kind === "audio" ? 1 : 16 / 9)
  return Math.min(16 / 9, Math.max(1, ratio))
}

/** Wide thumbnails (videos) get a true 16:9 box, everything else a square: never a bad crop. */
const isWide = (r?: number, kind?: string) => (r ? r > 1.3 : kind === "video")
function wide(item: ContentItem) {
  return isWide(knownRatio(item.art), item.kind)
}

function HeroArt({ item }: { item: ContentItem }) {
  const [w, setW] = useState(() => wide(item))
  return (
    <motion.div
      className="relative h-full flex-shrink-0 overflow-hidden"
      initial={false}
      animate={{ width: w ? `${(50 * 16) / 9}vh` : "50vh" }}
      transition={SPRING}
    >
      <Artwork src={item.art} color={item.color} alt="" className="ptv-zoom h-full w-full" onRatio={(r) => setW(isWide(r, item.kind))} />
      {progressFraction(item.id) > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-[5px] bg-black/40">
          <div className="h-full w-full origin-left" style={{ transform: `scaleX(${progressFraction(item.id)})`, background: "var(--ptv-accent)" }} />
        </div>
      )}
    </motion.div>
  )
}

function Peek({ item, dir, side, onClick }: { item?: ContentItem; dir: number; side: -1 | 1; onClick: () => void }) {
  const ratio = fit(knownRatio(item?.art), item?.kind)
  return (
    <div className="relative h-[38vh] w-[8vw] flex-shrink-0" style={{ display: "flex", justifyContent: side < 0 ? "flex-end" : "flex-start", alignItems: "center" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {item && (
          <motion.button
            key={item.id}
            type="button"
            tabIndex={-1}
            onClick={onClick}
            className="h-full flex-shrink-0 overflow-hidden rounded-[22px]"
            style={{ width: "8vw" }}
            initial={{ opacity: 0, x: dir * 70, scale: 0.85 }}
            animate={{ opacity: 0.4, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: dir * -70, scale: 0.85, transition: { duration: 0.14 } }}
            transition={SPRING}
            aria-label={item.title}
          >
            <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
