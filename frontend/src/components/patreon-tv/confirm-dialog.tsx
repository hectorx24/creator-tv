import { useEffect } from "react"
import { motion } from "motion/react"
import { useTvInput } from "@/navigation/tv-input"
import { focusById } from "@/navigation/focus-nav"

/** Modal confirmation. The safe action ("cancel") always receives the initial focus. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => focusById("dialog-cancel"))
    return () => cancelAnimationFrame(raf)
  }, [])

  useTvInput(
    (action) => {
      if (action === "back") {
        onCancel()
        return true
      }
      return false
    },
    { modal: true },
  )

  return (
    <motion.div
      className="ptv-overlay z-[80] flex items-center justify-center"
      data-tv-screen
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26 }}
      style={{ background: "rgba(6,6,8,0.78)" }}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ptv-dialog-title"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 210, damping: 34 }}
        className="flex w-[min(560px,80vw)] flex-col gap-4 rounded-3xl p-8"
        style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}
      >
        <h2 id="ptv-dialog-title" className="text-2xl font-bold">
          {title}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--ptv-muted)" }}>
          {body}
        </p>
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            data-nav
            data-nav-id="dialog-cancel"
            data-nav-default
            onClick={onCancel}
            className="rounded-full px-6 py-3 text-sm font-bold"
            style={{ background: "var(--ptv-text)", color: "#17141a" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            data-nav
            data-nav-id="dialog-confirm"
            onClick={onConfirm}
            className="rounded-full px-6 py-3 text-sm font-semibold"
            style={{ background: "var(--ptv-raised)", color: "#ff8a7a", border: "1px solid rgba(255,138,122,0.35)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
