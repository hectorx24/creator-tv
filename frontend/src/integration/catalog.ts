import type { ContentItem, Creator } from "@/lib/patreon-tv/types"
import { requireIntegration } from "./registry"

let creators: Creator[] = []
let contentByCreator = new Map<string, ContentItem[]>()

export async function loadCatalog() {
  const data = requireIntegration("data")
  const list = await data.listCreators()
  const entries = await Promise.all(list.map(async (c) => [c.id, await data.listContent(c.id)] as const))
  creators = list
  contentByCreator = new Map(entries)
}

export function resetCatalog() {
  creators = []
  contentByCreator = new Map()
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
