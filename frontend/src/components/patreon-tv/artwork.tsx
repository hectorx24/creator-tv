import { useState } from "react"

/** Natural aspect ratio per image URL (w/h), learnt on first load; lets cards match each banner. */
const ratios = new Map<string, number>()
export const knownRatio = (src?: string) => (src ? ratios.get(src) : undefined)
import type { ArtColor } from "@/lib/patreon-tv/types"

const COLOR_GRADIENTS: Record<ArtColor, string> = {
  gold: "radial-gradient(circle at 30% 25%, #ffb66b 0%, #8a4a1f 45%, #241510 100%)",
  purple: "radial-gradient(circle at 30% 25%, #c08bff 0%, #4a2d7a 45%, #19121f 100%)",
  green: "radial-gradient(circle at 30% 25%, #7fd9ab 0%, #245a45 45%, #0f1a16 100%)",
  coral: "radial-gradient(circle at 30% 25%, #ff9d85 0%, #8a3f2f 45%, #241410 100%)",
  slate: "radial-gradient(circle at 30% 25%, #9db3d6 0%, #3a4a66 45%, #141a21 100%)",
}

export function Artwork({
  src,
  color,
  alt = "",
  className = "",
  onRatio,
}: {
  src?: string
  color: ArtColor
  alt?: string
  className?: string
  onRatio?: (ratio: number) => void
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={className}
        style={{ backgroundImage: COLOR_GRADIENTS[color] }}
        role="img"
        aria-label={alt}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-cover`}
      loading="lazy"
      decoding="async"
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth && img.naturalHeight) {
          const r = img.naturalWidth / img.naturalHeight
          ratios.set(src, r)
          onRatio?.(r)
        }
      }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}
