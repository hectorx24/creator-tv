import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./globals.css"
import "./keyboard/tv-keyboard.js"
import "./keyboard/tv-keyboard.css"
import { PatreonTvApp } from "./components/patreon-tv/patreon-tv-app"
import { DEMO_MODE, registerIntegration } from "./integration/registry"
import { hostIntegration } from "./integration/host"
import { installTvInput } from "./navigation/tv-input"

async function boot() {
  if (DEMO_MODE) {
    const { demoIntegration } = await import("./demo/demo-integration")
    registerIntegration(demoIntegration)
  } else {
    registerIntegration(hostIntegration)
  }
  installTvInput()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PatreonTvApp />
    </StrictMode>,
  )
}

void boot()
