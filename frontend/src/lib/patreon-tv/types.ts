export type ContentKind = "video" | "audio" | "text"

export type ArtColor = "gold" | "purple" | "green" | "coral" | "slate"

export interface Creator {
  id: string
  name: string
  tagline: string
  avatar: string
  color: ArtColor
}

export interface ContentItem {
  id: string
  creatorId: string
  kind: ContentKind
  title: string
  description: string
  publishedAt: string
  durationSec?: number
  art: string
  color: ArtColor
  locked?: boolean
}
