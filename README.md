# Creator TV (Patreon TV Personal)

A modern, open-source 10-foot television interface and client application designed for **Android TV** and **Google TV** (Chromecast). Built to deliver an immersive, cinema-grade living room experience for creator content.

---

## Highlights & Features

- **10-Foot Spatial D-Pad Navigation:**
  - Robust row-based spatial navigation designed specifically for TV remote controls.
  - Dynamic focus rings with spring physics and overshoot (`data-nav-lift`).
  - Strict axis containment: UP/DOWN traverses vertical tiers; LEFT/RIGHT traverses horizontal carousels without unintentional cross-jumping.
  - Edge confinement prevents focus wrapping or unintentional defocusing.

- **Custom On-Screen TV Keyboard:**
  - Full QWERTY + numeric TV keyboard optimized for directional navigation.
  - Fast email shortcuts (`@gmail.com`, `.com`), uppercase toggle (`MAYÚS`), and backspace.
  - **Native IME Suppression:** Suppresses Android's system soft-keyboard and "type from phone" popups using `WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM` while cleanly forwarding remote `OK` events.

- **Dual-Mode Audio Engine:**
  - Fullscreen player with real-time timeline, seeking, and album art.
  - Non-overlapping docked **Mini-Player** with background audio persistence.
  - Native Android foreground service (`NativeAudioService`) with MediaSession integration.

- **Fullscreen Video Player:**
  - Real fullscreen video surface with discrete disappearing controls (`HIDE_DELAY = 3400ms`).
  - D-pad seeking (±10s) and play/pause toggle.

- **Long-Form Text Reader:**
  - Safe-area contained reader view with smooth scroll and clean typography.

- **Live Universal Search:**
  - Instant title and creator filtering directly from the 10-foot interface.

- **Responsive Multi-Resolution Support:**
  - Seamless adaptation across **720p**, **1080p**, and **4K** screens.
  - Zero whole-page scrollbars using viewport flex containers and CSS safe-area variables (`--ptv-safe-x`, `--ptv-safe-y`).

---

## Architecture & Codebase

```text
creator-tv/
├── frontend/                     # React 19 + Vite + Tailwind CSS TV client
│   ├── src/
│   │   ├── components/patreon-tv/  # Screens: Login, Browse, Player, Search, Reader
│   │   ├── keyboard/              # TV On-screen keyboard implementation
│   │   ├── navigation/            # TV spatial input & focus engine
│   │   ├── lib/patreon-tv/        # Motion tokens, formatting, types
│   │   └── integration/           # Host bridge, demo mode, catalog adapters
│   └── tests/                     # 59 automated navigation & layout DOM tests
├── android/                      # Native Android Java layer
│   └── src/main/java/com/patreontv/personal/
│       ├── NativeAudioBridge.java       # WebView bridge & IME suppression hook
│       ├── NativeAudioService.java      # Background MediaPlayer service
│       ├── PhoneRemoteServer.java       # Local phone remote HTTP server
│       ├── CatalogExtension.java        # Feed taxonomy & pagination parser
│       └── NowPlayingDreamService.java  # Daydream TV screensaver
└── scripts/
    └── build.sh                         # Production asset builder
```

---

## Development History & Credits

- **Claude:** Authored the v4.0/v4.1 UI iterations, motion tokens system, and TV navigation components.
- **Antigravity (Google DeepMind):** Completed the real-device Chromecast HD validation matrix, integrated the Android IME suppression fix (`FLAG_ALT_FOCUSABLE_IM` + `dispatchRemoteOk`), built production APK candidates, verified multi-resolution compatibility, and prepared this sanitized open-source repository.

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+ or 10+
- (Optional for Android TV APK builds) Android SDK 34+ and Java 17+

### Building the Frontend

```bash
# Clone the repository
git clone https://github.com/hectorx24/creator-tv.git
cd creator-tv/frontend

# Install dependencies
pnpm install

# Run automated tests
pnpm test

# Build production bundle
pnpm build
```

Production web assets will be generated in `frontend/dist`.

---

## License

This project is licensed under the [MIT License](LICENSE).
