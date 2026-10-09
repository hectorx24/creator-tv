// Regenerates harness.js (bundle of the REAL tv-input/focus-nav) and v4.css
// (the v4 section of src/globals.css). Needs esbuild (comes with vite/tsx).
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const dir = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(process.env.ESBUILD_PATH ?? "esbuild")
await esbuild.build({ entryPoints: [path.join(dir, "harness.ts")], bundle: true, outfile: path.join(dir, "harness.js"), format: "iife", target: "es2020", nodePaths: (process.env.NODE_PATH ?? "").split(":").filter(Boolean) })
const s = fs.readFileSync(path.join(dir, "../../src/globals.css"), "utf8")
const tokens = s.slice(s.indexOf("/* Patreon TV — immersive"), s.indexOf(".ptv {"))
const v4 = s.slice(s.indexOf("/* ───────────────────────── v4: television layout"))
fs.writeFileSync(path.join(dir, "v4.css"), tokens + "\n.ptv{color:#faf8f7;font-family:sans-serif;background:var(--ptv-bg)}\n" + v4)
console.log("fixtures rebuilt")
