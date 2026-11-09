import { test } from "node:test"
import assert from "node:assert/strict"
import { parseChapters } from "../src/integration/post-body.ts"

test("parses common timestamp formats", () => {
  const text = `Hoy hablamos de:\n00:00 Intro\n[05:12] Noticias\n12:30 - Phantom Blade Zero\n1:02:03 – Despedida\nGracias`
  assert.deepEqual(parseChapters(text), [
    { start: 0, title: "Intro" },
    { start: 312, title: "Noticias" },
    { start: 750, title: "Phantom Blade Zero" },
    { start: 3723, title: "Despedida" },
  ])
})

test("needs at least two chapters starting early", () => {
  assert.deepEqual(parseChapters("Solo 12:30 una mención"), [])
  assert.deepEqual(parseChapters("20:00 a\n30:00 b"), [])
})

test("drops chapters beyond duration and duplicates", () => {
  const out = parseChapters("0:00 a\n0:00 dup\n2:00 b\n9:00 fuera", 300)
  assert.deepEqual(out, [{ start: 0, title: "a" }, { start: 120, title: "b" }])
})

test("ignores clock times inside long prose lines", () => {
  const long = "x".repeat(170) + " 10:00 " + "y"
  assert.deepEqual(parseChapters(`0:00 a\n${long}\n1:00 b`), [{ start: 0, title: "a" }, { start: 60, title: "b" }])
})

import { proseMirrorToHtml } from "../src/integration/post-body.ts"
test("converts Patreon ProseMirror bodies to safe HTML", () => {
  const doc = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Hola <b>", marks: [{ type: "bold" }] }, { type: "hard_break" }, { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://x.com/a" } }] }] },
    { type: "bullet_list", content: [{ type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "00:00 Intro" }] }] }] },
    { type: "image", attrs: { src: "javascript:alert(1)" } },
  ] }
  assert.equal(proseMirrorToHtml(JSON.stringify(doc)),
    '<p><strong>Hola &lt;b&gt;</strong><br><a href="https://x.com/a">link</a></p><ul><li><p>00:00 Intro</p></li></ul>')
  assert.equal(proseMirrorToHtml("not json"), "")
})

test("strips orphan brackets around timestamps", () => {
  assert.deepEqual(parseChapters("(00:00) Introducción\n(05:00) Juegos"), [{ start: 0, title: "Introducción" }, { start: 300, title: "Juegos" }])
})
