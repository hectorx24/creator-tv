import { useEffect } from "react"
import { motion } from "motion/react"
import { spring, stagger } from "@/lib/patreon-tv/motion-tokens"
import { contentForCreator, getCreators } from "@/integration/catalog"
import { useTvInput } from "@/navigation/tv-input"
import { focusById } from "@/navigation/focus-nav"
import { Artwork } from "./artwork"
import { PatreonTvLogo } from "./logo"

/** Remembers the last creator so BACK from a library lands on the same card. */
let lastCreatorId: string | null = null

export function CreatorGrid({
  onSelect,
  onLogout,
}: {
  onSelect: (creatorId: string) => void
  onLogout: () => void
}) {
  const creators = getCreators()

  useEffect(() => {
    const raf = requestAnimationFrame(() => focusById(lastCreatorId))
    return () => cancelAnimationFrame(raf)
  }, [])

  useTvInput((action) => {
    if (action !== "back") return false
    // BACK at top level backgrounds/leaves the app gracefully, preserving the authenticated session.
    // Only the explicit "Cerrar sesión" button triggers logout.
    try {
      ;(window as any).PersonalAudio?.moveTaskToBack?.()
    } catch {}
    return true
  })

  return (
    <div className="ptv-screen" data-tv-screen data-tv-dock-ok>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(50% 40% at 80% 90%, var(--ptv-accent-soft) 0%, transparent 70%)",
        }}
      />

      <header className="relative z-10 mb-[3vh] flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <PatreonTvLogo className="h-10 w-10 rounded-xl object-cover shadow-[0_6px_20px_rgba(255,133,105,0.16)]" />
          <div>
            <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "var(--ptv-accent)" }}>
              PATREON TV
            </p>
            <h1 className="ptv-h1 mt-1 font-bold tracking-tight">Tus creadores</h1>
          </div>
        </div>
        <button
          type="button"
          data-nav
          data-nav-id="logout"
          onClick={onLogout}
          className="rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", color: "var(--ptv-muted)" }}
        >
          Cerrar sesión
        </button>
      </header>

      <div className="ptv-scroll relative z-10 -m-1 p-1">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {creators.length === 0 && (
          <p className="col-span-full text-sm" style={{ color: "var(--ptv-muted)" }}>
            No hay creadores disponibles todavía.
          </p>
        )}
        {creators.map((creator, i) => {
          const count = contentForCreator(creator.id).length
          return (
            <motion.button
              key={creator.id}
              type="button"
              data-creator-card
              data-nav
              data-nav-id={creator.id}
              onClick={() => {
                lastCreatorId = creator.id
                onSelect(creator.id)
              }}
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring.bouncy, delay: stagger(i) }}
              className="group flex flex-col overflow-hidden rounded-2xl text-left"
              style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)" }}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Artwork
                  src={creator.avatar}
                  color={creator.color}
                  alt=""
                  className="h-full w-full"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.9) 100%)" }}
                />
                <span
                  className="absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: "rgba(10,10,12,0.75)", color: "var(--ptv-muted)" }}
                >
                  {count} publicaciones
                </span>
              </div>
              <div className="flex flex-col gap-1 px-4 py-4">
                <h2 className="text-lg font-bold leading-snug text-balance">{creator.name}</h2>
                <p className="text-sm leading-snug text-balance" style={{ color: "var(--ptv-muted)" }}>
                  {creator.tagline}
                </p>
              </div>
            </motion.button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
