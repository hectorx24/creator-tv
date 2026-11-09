# Creator TV

A personal 10-foot client for **Android TV / Google TV** (built and tested on Chromecast with Google TV HD) to watch, listen to and read the content of the creators you support. It talks to your own **Patreon** membership from the TV; it is an independent personal project, not affiliated with Patreon.

**Latest build:** see [Releases](https://github.com/hectorx24/creator-tv/releases) → `CreatorTV-4.3.2.apk`.

> No screenshots on purpose: every screen shows private, paid creator content.

## What it does

- **Library** — one card per post in an "album" carousel. Videos keep a true 16:9 thumbnail, podcasts a square cover; the card size never changes, only the image/text split. Tabs: *Todo · Series · Vídeos · Audio · Texto* (series are grouped from the show names in post titles). New posts load automatically when you come back to the app; older ones page in as you scroll.
- **Video** — cover until the first frame, resume where you left off, ←/→ seek (each press adds 10 s, the jump lands when you stop), OK play/pause, ⚙ menu (↓) with speed 0.75–2×, chapters parsed from timestamps in the description, and visual dimming (auto after a pause, or manual). Headset/AirPods media buttons work. The screen is kept awake only while a video plays, so the TV screensaver still runs otherwise.
- **Audio** — native foreground service with MediaSession: keeps playing under the screensaver; leaving the app (HOME/BACK) pauses it, because Google TV only shows system media controls for an allowlist of partner apps (see docs/HANDOFF.md). Same remote model as video (←/→ seek, OK play/pause, ↓ speed). Material 3 Expressive wavy progress bar; mini-player while you browse.
- **Texto** — full post bodies (Patreon's ProseMirror `content_json_string`) rendered as clean HTML: paragraphs, bold, links, lists, images; distinct empty / locked / preview / error states.
- **Polish** — logo that assembles itself on launch (no login flash when a session exists), spring physics on focus and transitions (transform/opacity only for smooth playback on Chromecast HD), optional UI sounds (off by default, ⚙ on the creators screen), logout behind a confirmation.

## Repository layout

```text
frontend/   React 19 + Vite + Tailwind + Motion TV client (WebView)
  src/components/patreon-tv/   screens: intro, creators, library, players, reader, search
  src/integration/             native bridge adapters, catalog (refresh + paging), post bodies & chapters
  src/navigation/              D-pad spatial navigation
  tests/                       unit (chapters, ProseMirror, nav) + 59 DOM layout tests
android/    Native Java layer (audio service, bridge, catalog hooks, phone remote, screensaver)
scripts/    build.sh (frontend) · repack.sh (APK assembly from a local base build)
docs/       HANDOFF.md — architecture, verified behaviour, findings and pending items
```

## Build

```bash
cd frontend && npm ci && npm test && npm run build
```

`scripts/repack.sh` assembles the APK from a locally kept base build plus `frontend/dist` and the Java layer, then signs it with your local debug key. The base binary, keys, cookies and session data are not part of this repository.

## Install on the TV

```bash
adb pair <tv-ip>:<pair-port>        # Settings → Developer options → Wireless debugging
adb connect <tv-ip>:<port>
adb install -r CreatorTV-4.3.2.apk    # -r keeps your session
```

## Credits

Built iteratively with AI coding agents (Claude, Codex, Antigravity); see `docs/HANDOFF.md` for the technical log.
