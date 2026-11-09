import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./globals.css"
import { PatreonTvApp } from "./components/patreon-tv/patreon-tv-app"
import { DEMO_MODE, registerIntegration } from "./integration/registry"
import { hostIntegration } from "./integration/host"
import { installTvInput } from "./navigation/tv-input"

async function boot() {
  if (DEMO_MODE) {
    const { demoIntegration } = await import("./demo/demo-integration")
    registerIntegration(demoIntegration)
  }
  registerIntegration(hostIntegration)
  installTvInput()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PatreonTvApp />
    </StrictMode>,
  )
}

void boot()

// Leaving the app pauses background audio (Google TV gives non-partner apps no system controls);
// the native side keeps it playing if the screensaver is what hid us.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    import("./integration/host").then(({ videoController }) => videoController.videoEl?.pause()).catch(() => {})
    try {
      window.PersonalAudio?.appHidden?.()
    } catch {
      /* no bridge in the browser */
    }
  }
})
