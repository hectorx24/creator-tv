import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Lock, Search as SearchIcon } from "lucide-react"
import type { ContentItem } from "@/lib/patreon-tv/types"
import { creatorById, searchCatalog } from "@/integration/catalog"
import { useTvInput } from "@/navigation/tv-input"
import { formatDate, KIND_LABEL } from "@/lib/patreon-tv/format"
import { Artwork } from "./artwork"

export function SearchScreen({
  onBack,
  onOpenItem,
}: {
  onBack: () => void
  onOpenItem: (item: ContentItem) => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useTvInput(
    (action) => {
      if (action !== "back") return false
      onBack()
      return true
    },
    { modal: true },
  )

  const [results, setResults] = useState<ContentItem[]>([])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    const id = setTimeout(() => {
      searchCatalog(q)
        .then((found) => {
          if (!cancelled) setResults(found)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query])

  return (
    <div className="ptv-screen" data-tv-screen>
      <header className="flex flex-shrink-0 items-center gap-4">
        <button
          type="button"
          data-nav
          data-nav-id="search-back"
          onClick={onBack}
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div
          className="flex flex-1 items-center gap-3 rounded-full px-5 py-3"
          style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)" }}
        >
          <SearchIcon className="h-4.5 w-4.5 flex-shrink-0" style={{ color: "var(--ptv-muted-dim)" }} aria-hidden="true" />
          <input
            inputMode="search"
            ref={inputRef}
            data-nav
            data-nav-id="search-input"
            data-nav-default
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={() => {
              try {
                ;(window as any).PersonalAudio?.showKeyboard?.()
              } catch {}
            }}
            type="search"
            placeholder="Buscar en todos los creadores…"
            className="ptv-input-bare w-full bg-transparent text-base"
            style={{ color: "var(--ptv-text)" }}
          />
        </div>
      </header>

      <div className="ptv-scroll mt-[3vh]">
        {query.trim().length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ptv-muted-dim)" }}>
            Escribe para buscar títulos, descripciones o creadores.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ptv-muted-dim)" }}>
            Sin resultados para &quot;{query}&quot;.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((item) => {
              const creator = creatorById(item.creatorId)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-nav
                    data-nav-id={`result:${item.id}`}
                    onClick={() => onOpenItem(item)}
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left hover:bg-[var(--ptv-surface)]"
                  >
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                      <Artwork src={item.art} color={item.color} alt="" className="h-full w-full" />
                      {item.locked && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(10,10,12,0.55)" }}>
                          <Lock className="h-3.5 w-3.5" style={{ color: "var(--ptv-muted)" }} aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="truncate text-xs" style={{ color: "var(--ptv-muted-dim)" }}>
                        {creator?.name} · {KIND_LABEL[item.kind]} · {formatDate(item.publishedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
