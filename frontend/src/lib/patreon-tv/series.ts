import type { ContentItem } from "./types"

/**
 * Series ("programas") inside a creator's feed. Patreon collections/tags are used when the API
 * sends them; otherwise the show name is taken from the title pattern creators use, e.g.
 * "Recarga Activa #5.203…", "Podcast Reload - Temporada 18…", "Preguntitas: …".
 */
export function seriesOf(item: ContentItem): string | null {
  const cat = item.categories?.find((c) => c && c.length < 60)
  if (cat) return cat
  const m = item.title.match(/^(.{3,40}?)\s*(?:[-–—:|#(]|\b(?:T|S)\d|\bep(?:isodio)?\.?\s*\d|\bcap(?:ítulo)?\.?\s*\d)/i)
  return m ? m[1].trim().replace(/[.,;]+$/, "") : null
}

export interface Series {
  name: string
  items: ContentItem[]
}

/** Shows with at least two posts, newest first; one-off posts are left to "Todo". */
export function groupSeries(items: ContentItem[]): Series[] {
  const map = new Map<string, Series>()
  for (const it of items) {
    const name = seriesOf(it)
    if (!name) continue
    const key = name.toLowerCase()
    const s = map.get(key) ?? { name, items: [] }
    s.items.push(it)
    map.set(key, s)
  }
  return [...map.values()].filter((s) => s.items.length >= 2)
}
