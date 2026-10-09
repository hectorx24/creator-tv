// Real-Chromium regression test for D-pad navigation + TV layout, using the
// project's actual tv-input.ts / focus-nav.ts (bundled) and the v4 layout CSS.
// Run: node tests/tv-dom.test.mjs   (needs playwright + chromium)
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright")
const dir = path.dirname(fileURLToPath(import.meta.url))
const url = "file://" + path.join(dir, "fixtures/browse.html")

let failed = 0, passed = 0
const ok = (cond, name, extra = "") => { if (cond) { passed++; console.log("  ✓", name) } else { failed++; console.log("  ✗", name, extra) } }

const browser = await chromium.launch()
const nav = async (page) => page.evaluate(() => H.currentNavId())
const press = async (page, key) => { await page.keyboard.press(key); await page.waitForTimeout(30) }

// ───────── 1. D-pad navigation (1280×720 panel as scaled by the WebView ≈ 960×540) ─────────
console.log("D-pad navigation @960×540 CSS px")
{
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  await page.goto(url); await page.waitForFunction(() => H.currentNavId() === "hero", { timeout: 3000 })
  ok((await nav(page)) === "hero", "initial focus lands on the hero (never on <body>)", await nav(page))

  await press(page, "ArrowUp");   ok(["tab:video","tab:audio"].includes(await nav(page)), "UP from hero → tab row", await nav(page))
  await press(page, "ArrowRight"); const t = await nav(page)
  ok(t.startsWith("tab:"), "RIGHT inside tabs stays in the tab row", t)
  await press(page, "ArrowUp");   ok(["creator","search"].includes(await nav(page)), "UP from tabs → header row", await nav(page))
  await press(page, "ArrowLeft"); ok((await nav(page)) === "creator", "LEFT in header → Creador")
  await press(page, "ArrowLeft"); ok((await nav(page)) === "creator", "LEFT at the edge stays put (no wrap, no jump)")
  await press(page, "ArrowUp");   ok((await nav(page)) === "creator", "UP at the top edge stays put")
  await press(page, "ArrowDown"); await press(page, "ArrowDown")
  ok((await nav(page)) === "hero", "DOWN, DOWN returns to the hero", await nav(page))
  await press(page, "ArrowDown"); ok((await nav(page)) === "hero", "DOWN at the bottom edge stays on the hero")

  // hero consumes LEFT/RIGHT/OK through its layer
  await press(page, "ArrowRight"); await press(page, "ArrowLeft"); await press(page, "Enter")
  const hp = await page.evaluate(() => window.heroPresses)
  ok(JSON.stringify(hp) === JSON.stringify(["right","left","ok"]), "hero handles ←/→/OK itself (carousel)", JSON.stringify(hp))

  // Tabs row: LEFT/RIGHT walk all four tabs without leaving the row
  await press(page, "ArrowUp")
  for (let i = 0; i < 6; i++) await press(page, "ArrowLeft")
  ok((await nav(page)) === "tab:latest", "6×LEFT on tabs stops at first tab")
  for (let i = 0; i < 6; i++) await press(page, "ArrowRight")
  ok((await nav(page)) === "tab:text", "6×RIGHT on tabs stops at last tab")

  // docked mini-player
  await page.evaluate(() => openDock()); await page.waitForTimeout(50)
  await page.evaluate(() => H.focusById("hero"))
  await press(page, "ArrowDown"); ok((await nav(page)) === "mini-expand", "DOWN from hero reaches the mini-player", await nav(page))
  await press(page, "ArrowRight"); ok((await nav(page)) === "mini-play", "RIGHT → play/pause")
  await press(page, "ArrowRight"); ok((await nav(page)) === "mini-close", "RIGHT → close")
  await press(page, "ArrowUp"); ok((await nav(page)) === "hero", "UP from mini-player returns to the hero", await nav(page))

  // Focus recovery: the focused control disappears
  await page.evaluate(() => H.focusById("mini-play"))
  await page.evaluate(() => closeDock()); await page.waitForTimeout(120)
  ok((await nav(page)) !== null, "focus is recovered when the focused control is removed", String(await nav(page)))

  // Android keycodes (no .key): DPAD via keyCode
  await page.evaluate(() => H.focusById("hero"))
  await page.evaluate(() => { const e = new KeyboardEvent("keydown", { key: "Unidentified", cancelable: true }); Object.defineProperty(e, "keyCode", { get: () => 19 }); window.dispatchEvent(e) })
  await page.waitForTimeout(30)
  ok(["tab:video","tab:audio"].includes(await nav(page)), "Android keyCode 19 (DPAD_UP) is understood", await nav(page))
  await page.evaluate(() => { window.heroPresses.length = 0 })
  await page.evaluate(() => H.focusById("hero"))
  await page.evaluate(() => { const e = new KeyboardEvent("keydown", { key: "Unidentified", cancelable: true }); Object.defineProperty(e, "keyCode", { get: () => 4 }); window.dispatchEvent(e) })
  ok((await page.evaluate(() => window.heroPresses)).includes("back"), "Android keyCode 4 (BACK) reaches the screen handler")
  await page.close()
}

// ───────── 2. Layout: no clipping, no page scroll, content inside safe area ─────────
const viewports = [
  { name: "960×540  (1280×720 panel, WebView scale 1.33)", w: 960, h: 540 },
  { name: "1280×720 (1:1)", w: 1280, h: 720 },
  { name: "1920×1080 (1:1)", w: 1920, h: 1080 },
  { name: "960×540  (1920×1080 panel, WebView scale 2)", w: 960, h: 540 },
]
for (const vp of viewports) {
  for (const dock of [false, true]) {
    console.log(`Layout ${vp.name}${dock ? " + mini-player" : ""}`)
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
    await page.goto(url); await page.waitForTimeout(100)
    if (dock) await page.evaluate(() => openDock())
    await page.waitForTimeout(60)
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect()
      const de = document.documentElement
      const dock = document.getElementById("dock")
      return {
        vh: innerHeight, vw: innerWidth, scrollH: de.scrollHeight, scrollW: de.scrollWidth,
        hero: r("#hero"), footer: r("#footer"), screen: r("#screen"),
        dock: dock.hidden ? null : dock.getBoundingClientRect(),
        safeY: parseFloat(getComputedStyle(document.querySelector("#screen")).paddingTop),
        safeX: parseFloat(getComputedStyle(document.querySelector("#screen")).paddingLeft),
      }
    })
    ok(m.scrollH <= m.vh && m.scrollW <= m.vw, "page never scrolls (no overflow)", `${m.scrollW}×${m.scrollH} in ${m.vw}×${m.vh}`)
    ok(m.footer.bottom <= m.vh - m.safeY + 1, "footer fully visible inside bottom safe area", `footer.bottom=${m.footer.bottom.toFixed(1)} limit=${(m.vh - m.safeY).toFixed(1)}`)
    ok(m.hero.top >= m.safeY && m.hero.height > 120, "hero is visible and not collapsed", `h=${m.hero.height.toFixed(0)}`)
    ok(m.hero.bottom <= m.footer.top + 1, "hero does not overlap the footer", `${m.hero.bottom.toFixed(1)} vs ${m.footer.top.toFixed(1)}`)
    if (m.dock) {
      ok(m.dock.bottom <= m.vh - m.safeY + 12 && m.dock.right <= m.vw - m.safeX + 1, "mini-player stays inside the safe area", JSON.stringify({b:m.dock.bottom, r:m.dock.right}))
      ok(m.dock.top >= m.hero.bottom - 1, "mini-player does not cover the hero", `dock.top=${m.dock.top.toFixed(1)} hero.bottom=${m.hero.bottom.toFixed(1)}`)
    }
    await page.close()
  }
}
await browser.close()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
