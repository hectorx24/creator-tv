/**
 * Un solo lenguaje de movimiento para toda la app.
 * - Entradas: muelles (spring) con algo de inercia; salidas: tween corto, para que
 *   `AnimatePresence mode="wait"` no se quede esperando a que un muelle se asiente.
 * - Solo se anima opacidad y transform (nada de layout), para ir fluido en el WebView del Chromecast.
 */
export const spring = {
  /** Controles y paneles pequeños: rápido, casi sin rebote. */
  snappy: { type: "spring", stiffness: 560, damping: 40, mass: 0.8 },
  /** Pantallas y overlays: asienta suave. */
  soft: { type: "spring", stiffness: 320, damping: 32, mass: 0.9 },
  /** Tarjetas y elementos que "caen" en su sitio: un toque de rebote. */
  bouncy: { type: "spring", stiffness: 420, damping: 24, mass: 0.8 },
} as const

/** Salida estándar (tween corto). */
export const exitTween = { duration: 0.14, ease: "easeIn" } as const

/** Retraso escalonado con tope, para que una rejilla grande no tarde en aparecer. */
export const stagger = (i: number, step = 0.03, max = 8) => Math.min(i, max) * step
