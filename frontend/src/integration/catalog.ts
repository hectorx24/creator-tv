import type { ContentItem, Creator } from "@/lib/patreon-tv/types"
import { requireIntegration } from "./registry"

let creators: Creator[] = []
let contentByCreator = new Map<string, ContentItem[]>()
const cursors = new Map<string, string | null>()
const loadingMore = new Set<string>()
let loadedAt = 0
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version++
  listeners.forEach((fn) => fn())
}
export const subscribeCatalog = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export const catalogVersion = () => version
export const catalogAge = () => Date.now() - loadedAt

async function firstPage(id: string) {
  const data = requireIntegration("data")
  if (data.listContentPage) return data.listContentPage(id, null)
  return { items: await data.listContent(id), next: null as string | null }
}

export async function loadCatalog() {
  const list = await requireIntegration("data").listCreators()
  const pages = await Promise.all(list.map(async (c) => [c.id, await firstPage(c.id)] as const))
  creators = list
  contentByCreator = new Map(pages.map(([id, p]) => [id, p.items]))
  pages.forEach(([id, p]) => cursors.set(id, p.next))
  loadedAt = Date.now()
  emit()
}

/** Newest page for every creator; unseen posts are prepended. Deeper pages and positions survive. */
export async function refreshCatalog() {
  try {
    const list = await requireIntegration("data").listCreators()
    const pages = await Promise.all(list.map(async (c) => [c.id, await firstPage(c.id)] as const))
    let changed = list.length !== creators.length
    for (const [id, p] of pages) {
      const old = contentByCreator.get(id) || []
      const known = new Set(old.map((i) => i.id))
      const fresh = p.items.filter((i) => !known.has(i.id))
      if (fresh.length || !old.length) {
        contentByCreator.set(id, [...fresh, ...old])
        if (!old.length) cursors.set(id, p.next)
        changed = true
      }
    }
    creators = list
    loadedAt = Date.now()
    if (changed) emit()
  } catch {
    /* offline: keep what we have */
  }
}

/** Next page for a creator (no-op at the end or while a page is in flight). */
export async function loadMore(creatorId: string) {
  const cursor = cursors.get(creatorId)
  const data = requireIntegration("data")
  if (!cursor || !data.listContentPage || loadingMore.has(creatorId)) return
  loadingMore.add(creatorId)
  try {
    const p = await data.listContentPage(creatorId, cursor)
    const old = contentByCreator.get(creatorId) || []
    const known = new Set(old.map((i) => i.id))
    contentByCreator.set(creatorId, [...old, ...p.items.filter((i) => !known.has(i.id))])
    cursors.set(creatorId, p.next)
    emit()
  } catch {
    /* retried on the next approach to the end */
  } finally {
    loadingMore.delete(creatorId)
  }
}

export function resetCatalog() {
  creators = []
  contentByCreator = new Map()
  cursors.clear()
  emit()
}

export const getCreators = () => creators
export const creatorById = (id: string) => creators.find((c) => c.id === id)
export const contentForCreator = (id: string) => contentByCreator.get(id) ?? []
export const getAllContent = () => [...contentByCreator.values()].flat()

export async function searchCatalog(query: string): Promise<ContentItem[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const data = requireIntegration("data")
  if (data.search) return data.search(query.trim())
  return getAllContent().filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      creatorById(item.creatorId)?.name.toLowerCase().includes(q),
  )
}
