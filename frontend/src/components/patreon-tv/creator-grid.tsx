import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { spring, stagger } from "@/lib/patreon-tv/motion-tokens"
import { contentForCreator, getCreators } from "@/integration/catalog"
import { useTvInput } from "@/navigation/tv-input"
import { focusById } from "@/navigation/focus-nav"
import { Artwork } from "./artwork"
import { AnimatedLogo } from "./logo"
import { LogOut, Settings2, Volume2, VolumeX } from "lucide-react"
import { soundsEnabled, setSoundsEnabled, uiSound } from "@/lib/patreon-tv/ui-sound"

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
    // Start on content, never on "Cerrar sesión".
    const raf = requestAnimationFrame(() => focusById(lastCreatorId ?? creators[0]?.id ?? null))
    return () => cancelAnimationFrame(raf)
  }, [])

  // BACK here leaves the app (handled natively); it must never log out. Logout asks for confirmation.
  useTvInput(() => false)

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
          <div className="h-11 w-11"><AnimatedLogo className="h-full w-full" /></div>
          <h1 className="text-2xl font-bold tracking-tight">Creadores</h1>
        </div>
        <SettingsMenu onLogout={onLogout} />
      </header>

      <div className="ptv-scroll relative z-10 -m-2 flex items-center p-2">
      <div className="flex w-full flex-wrap items-start justify-center gap-[4vw]">
        {creators.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ptv-muted)" }}>
            No hay creadores disponibles todavía.
          </p>
        )}
        {creators.map((creator, i) => {
          return (
            <motion.div
              key={creator.id}
              className="flex flex-col items-center gap-[2vh]"
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.15 + stagger(i) }}
            >
              <button
                type="button"
                data-creator-card
                data-nav-lift
                data-nav
                data-nav-id={creator.id}
                onClick={() => {
                  lastCreatorId = creator.id
                  onSelect(creator.id)
                }}
                aria-label={creator.name}
                className="h-[34vh] w-[34vh] overflow-hidden rounded-[32px]"
                style={{ background: "var(--ptv-surface)" }}
              >
                <Artwork src={creator.avatar} color={creator.color} alt="" className="ptv-zoom h-full w-full" />
              </button>
              <div className="flex max-w-[34vh] flex-col items-center text-center">
                <h2 className="text-lg font-bold leading-snug text-balance">{creator.name}</h2>

              </div>
            </motion.div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

/** Settings: interface sounds (off by default) and log out, tucked behind one gear. */
function SettingsMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const [sounds, setSounds] = useState(soundsEnabled())
  useEffect(() => {
    if (open) requestAnimationFrame(() => focusById("set-sounds"))
  }, [open])
  useTvInput((action) => {
    if (!open) return false
    if (action === "back") {
      setOpen(false)
      requestAnimationFrame(() => focusById("settings"))
      return true
    }
    return false
  })
  return (
    <div className="relative">
      <motion.button
        type="button"
        data-nav
        data-nav-id="settings"
        aria-label="Ajustes"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "var(--ptv-surface)", color: "var(--ptv-muted)" }}
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 16 }}
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+10px)] z-50 flex w-60 flex-col gap-1 rounded-3xl p-2"
            style={{ background: "rgba(24,24,28,0.97)", border: "1px solid var(--ptv-line)", transformOrigin: "top right" }}
            initial={{ opacity: 0, scale: 0.8, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 24 }}
          >
            <button
              type="button"
              data-nav
              data-nav-id="set-sounds"
              className="ptv-menu-item flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold"
              onClick={() => {
                setSoundsEnabled(!sounds)
                setSounds(!sounds)
                if (!sounds) uiSound("select")
              }}
            >
              {sounds ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              Sonidos: {sounds ? "sí" : "no"}
            </button>
            <button
              type="button"
              data-nav
              data-nav-id="set-logout"
              className="ptv-menu-item flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
