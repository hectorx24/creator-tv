// Run: node --import tsx --test tests/nav-core.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { groupRows, pickTarget, type NavBox } from "../src/navigation/focus-nav.ts"

// Mirrors the Browse screen: header (2), tabs (4), hero (1)
const box = (id: number, cx: number, cy: number): NavBox => ({ id, cx, cy, h: 40 })
const header = [box(0, 600, 40), box(1, 900, 42)]
const tabs = [box(2, 300, 110), box(3, 420, 110), box(4, 540, 110), box(5, 660, 110)]
const hero = [box(6, 520, 300)]
const all = [...hero, ...tabs, ...header] // deliberately unordered

test("rows are grouped by vertical position, top to bottom, left to right", () => {
  const rows = groupRows(all).map((r) => r.map((b) => b.id))
  assert.deepEqual(rows, [[0, 1], [2, 3, 4, 5], [6]])
})

test("UP / DOWN move between rows, never along a row", () => {
  assert.equal(pickTarget(all, 6, "up"), 4) // hero → nearest tab by x (540 ≈ 520)
  assert.equal(pickTarget(all, 4, "up"), 0) // tab → header (600 is nearest to 540)
  assert.equal(pickTarget(all, 0, "down"), 4)
  assert.equal(pickTarget(all, 4, "down"), 6)
})

test("LEFT / RIGHT move along the current row only", () => {
  assert.equal(pickTarget(all, 3, "left"), 2)
  assert.equal(pickTarget(all, 3, "right"), 4)
  assert.equal(pickTarget(all, 0, "right"), 1)
})

test("edges do not wrap and do not jump rows", () => {
  assert.equal(pickTarget(all, 2, "left"), null)
  assert.equal(pickTarget(all, 5, "right"), null)
  assert.equal(pickTarget(all, 0, "up"), null)
  assert.equal(pickTarget(all, 6, "down"), null)
})

test("nothing focused → first control, top-left (focus is never lost)", () => {
  assert.equal(pickTarget(all, null, "down"), 0)
  assert.equal(pickTarget(all, 999, "left"), 0)
})

test("empty screen is safe", () => {
  assert.equal(pickTarget([], null, "down"), null)
})

test("docked mini-player row sits below the hero and is reachable", () => {
  const mini = [box(7, 700, 480), box(8, 860, 480), box(9, 920, 480)]
  const withMini = [...all, ...mini]
  assert.equal(pickTarget(withMini, 6, "down"), 7)
  assert.equal(pickTarget(withMini, 7, "right"), 8)
  assert.equal(pickTarget(withMini, 8, "right"), 9)
  assert.equal(pickTarget(withMini, 9, "up"), 6)
})

test("a 4-column creator grid navigates like a grid", () => {
  const grid: NavBox[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) grid.push(box(r * 4 + c, 150 + c * 220, 200 + r * 180))
  assert.equal(pickTarget(grid, 5, "down"), 9)
  assert.equal(pickTarget(grid, 5, "up"), 1)
  assert.equal(pickTarget(grid, 5, "right"), 6)
  assert.equal(pickTarget(grid, 7, "right"), null)
})
