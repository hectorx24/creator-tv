import type { Integration } from "./types"

/** Demo fixtures exist only when this is true (set by `.env.development` and `pnpm build:demo`). */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true"

export class IntegrationNotConfiguredError extends Error {
  constructor(public readonly port: keyof Integration) {
    super(`La integración "${port}" no está configurada en esta compilación.`)
    this.name = "IntegrationNotConfiguredError"
  }
}

const registered: Partial<Integration> = {}

export function registerIntegration(ports: Partial<Integration>) {
  Object.assign(registered, ports)
}

export function getIntegration<K extends keyof Integration>(port: K): Integration[K] | undefined {
  return registered[port]
}

export function requireIntegration<K extends keyof Integration>(port: K): Integration[K] {
  const impl = registered[port]
  if (!impl) throw new IntegrationNotConfiguredError(port)
  return impl
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ha ocurrido un error inesperado."
}
