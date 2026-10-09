import { useRef } from "react"
import { motion } from "motion/react"
import { ArrowLeft } from "lucide-react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import { creatorById } from "@/integration/catalog"
import { formatDate, KIND_LABEL } from "@/lib/patreon-tv/format"
import { useTvInput } from "@/navigation/tv-input"

export function TextReaderScreen({ item, onBack }: { item: ContentItem; onBack: () => void }) {
  const creator = creatorById(item.creatorId)

  const scrollRef = useRef<HTMLDivElement>(null)

  useTvInput(
    (action) => {
      if (action === "back") {
        onBack()
        return true
      }
      // Long text: ↑/↓ scroll the article (the back button stays reachable with ←/→ or BACK).
      if (action === "up" || action === "down") {
        const el = scrollRef.current
        if (!el) return false
        const atTop = el.scrollTop <= 0
        if (action === "up" && atTop) return false // nothing above → let focus reach the back button
        el.scrollBy({ top: (action === "down" ? 1 : -1) * el.clientHeight * 0.7, behavior: "smooth" })
        return true
      }
      return false
    },
    { modal: true },
  )

  return (
    <div className="ptv-screen" data-tv-screen>
      <header className="flex flex-shrink-0 items-center justify-between">
        <button
          type="button"
          data-nav
          data-nav-id="reader-back"
          data-nav-default
          onClick={onBack}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
          style={{ color: "var(--ptv-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Biblioteca
        </button>
        <p className="text-sm font-medium" style={{ color: "var(--ptv-muted-dim)" }}>
          Leyendo
        </p>
      </header>

      <div ref={scrollRef} className="ptv-scroll mt-[3vh]">
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="mx-auto max-w-2xl pb-6"
      >
        <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "var(--ptv-accent)" }}>
          {creator?.name.toUpperCase()} · {KIND_LABEL[item.kind].toUpperCase()} · {formatDate(item.publishedAt)}
        </p>
        <h1 className="ptv-h1 mt-3 font-bold text-balance">{item.title}</h1>
        <p className="mt-8 text-lg leading-relaxed text-pretty" style={{ color: "var(--ptv-muted)" }}>
          {item.description}
        </p>
      </motion.article>
      </div>

      <footer className="mt-[1.6vh] flex flex-shrink-0 items-center justify-between text-xs" style={{ color: "var(--ptv-muted-dim)" }}>
        <span>↑ ↓ Desplazar · Atrás Volver</span>
        <span className="ptv-footer-brand">Patreon TV Personal</span>
      </footer>
    </div>
  )
}
