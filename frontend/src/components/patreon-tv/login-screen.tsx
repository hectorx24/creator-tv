import { useState, type FormEvent } from "react"
import { motion } from "motion/react"
import { spring } from "@/lib/patreon-tv/motion-tokens"
import type { LoginCredentials } from "@/integration/types"
import { PatreonTvLogo } from "./logo"

export function LoginScreen({
  onLogin,
  busy = false,
  error = null,
}: {
  onLogin: (credentials: LoginCredentials) => void
  busy?: boolean
  error?: string | null
}) {
  const [mode, setMode] = useState<"password" | "session">("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [sessionId, setSessionId] = useState("")

  const canSubmit = mode === "password" ? email.trim().length > 0 && password.trim().length > 0 : sessionId.trim().length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    onLogin(
      mode === "password"
        ? { method: "password", email: email.trim(), password }
        : { method: "session", sessionId: sessionId.trim() },
    )
  }

  return (
    <div className="ptv-screen items-center justify-center" data-tv-screen>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 28%, var(--ptv-accent-soft) 0%, transparent 70%), radial-gradient(40% 40% at 85% 85%, #ff856912 0%, transparent 70%)",
        }}
      />

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring.soft}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
  <PatreonTvLogo className="h-14 w-14 rounded-2xl object-cover shadow-[0_8px_28px_rgba(255,133,105,0.16)]" />
          <h1 className="text-4xl font-bold tracking-tight text-balance">Patreon TV</h1>
          <p className="text-sm" style={{ color: "var(--ptv-muted)" }}>
            Tu biblioteca personal de contenido para mecenas
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Método de acceso"
          className="mb-6 grid grid-cols-2 gap-2 rounded-2xl p-1.5"
          style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)" }}
        >
          <button
            type="button"
            role="tab"
            data-nav
            data-nav-id="login-mode-password"
            aria-selected={mode === "password"}
            onClick={() => setMode("password")}
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={
              mode === "password"
                ? { background: "var(--ptv-accent)", color: "#1a0f0a" }
                : { color: "var(--ptv-muted)" }
            }
          >
            Email y contraseña
          </button>
          <button
            type="button"
            role="tab"
            data-nav
            data-nav-id="login-mode-session"
            aria-selected={mode === "session"}
            onClick={() => setMode("session")}
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={
              mode === "session"
                ? { background: "var(--ptv-accent)", color: "#1a0f0a" }
                : { color: "var(--ptv-muted)" }
            }
          >
            ID de sesión
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {mode === "password" ? (
            <>
              <input
                data-nav
                data-nav-id="login-email"
                data-nav-default
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onClick={() => {
                  try {
                    ;(window as any).PersonalAudio?.showKeyboard?.()
                  } catch {}
                }}
                className="w-full rounded-xl px-4 py-3.5 text-base"
                style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", color: "var(--ptv-text)" }}
              />
              <input
                data-nav
                data-nav-id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onClick={() => {
                  try {
                    ;(window as any).PersonalAudio?.showKeyboard?.()
                  } catch {}
                }}
                className="w-full rounded-xl px-4 py-3.5 text-base"
                style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", color: "var(--ptv-text)" }}
              />
            </>
          ) : (
            <input
              data-nav
              data-nav-id="login-session"
              data-nav-default
              type="text"
              placeholder="Pega tu ID de sesión"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              onClick={() => {
                try {
                  ;(window as any).PersonalAudio?.showKeyboard?.()
                } catch {}
              }}
              className="w-full rounded-xl px-4 py-3.5 text-base"
              style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", color: "var(--ptv-text)" }}
            />
          )}

          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--ptv-accent)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            data-nav
            data-nav-id="login-submit"
            disabled={!canSubmit || busy}
            className="mt-2 w-full rounded-xl py-3.5 text-base font-bold disabled:opacity-40"
            style={{ background: "var(--ptv-accent)", color: "#1a0f0a" }}
          >
            {busy ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>

          <button
            type="button"
            data-nav
            data-nav-id="login-demo"
            onClick={() => onLogin({ method: "session", sessionId: "demo" })}
            className="w-full rounded-xl py-3 text-sm font-semibold"
            style={{ background: "var(--ptv-surface)", border: "1px solid var(--ptv-line)", color: "var(--ptv-muted)" }}
          >
            Explorar Modo Demo
          </button>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-balance" style={{ color: "var(--ptv-muted-dim)" }}>
          Usa tu correo y contraseña de Patreon. Si te registraste con Google, Facebook o Apple, usa la pestaña de ID
          de sesión.
        </p>
      </motion.form>
    </div>
  )
}
