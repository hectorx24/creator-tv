export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export function formatDate(iso: string) {
  try {
    return DATE_FORMATTER.format(new Date(iso)).toUpperCase()
  } catch {
    return ""
  }
}

export const KIND_LABEL: Record<string, string> = {
  video: "Vídeo",
  audio: "Audio",
  text: "Texto",
}
