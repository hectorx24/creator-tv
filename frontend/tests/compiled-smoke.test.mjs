import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const root = path.resolve(import.meta.dirname, '..')
const demo = process.env.TEST_DEMO === 'true'
const results = path.resolve(root, '../integrated/test-results')
await mkdir(results, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    const file = path.join(root, demo ? 'dist-demo' : 'dist', req.url === '/' ? 'index.html' : req.url.split('?')[0])
    const data = await readFile(file)
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream')
    res.end(data)
  } catch { res.writeHead(404); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch()
try {
  const page = await browser.newPage({viewport:{width:960,height:540}})
  const apiCalls = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url()) })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/auth/status', route => route.fulfill({json:{authenticated:false}}))
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.locator('input[type=email]').waitFor()
  await page.waitForTimeout(2500)
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-nav-id')), 'login-email')
  await page.screenshot({path:path.join(results,'compiled-login-960x540.png')})
  assert.equal(await page.locator('input[type=email]').getAttribute('inputmode'), 'none')
  await page.locator('input[type=email]').focus()
  await page.keyboard.press('Enter')
  await page.locator('#tv-keyboard-overlay').waitFor({state:'visible'})
  assert.equal(await page.locator('.tv-keyboard-overlay').evaluate(el=>getComputedStyle(el).position), 'fixed')
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('input[type=email]').inputValue(), '1')
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  assert.equal(await page.locator('input[type=email]').inputValue(), '1q')
  await page.screenshot({path:path.join(results,'compiled-keyboard-960x540.png')})
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('#tv-keyboard-overlay').isVisible(), false)
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-nav-id')), 'login-email')
  if (demo) {
    await page.locator('[data-nav-id=login-mode-session]').click()
    const input = page.locator('input').first()
    await input.fill('synthetic-demo-session')
    await page.getByRole('button', {name:'Iniciar sesión'}).click()
    await page.getByText('Archivo Cósmico', {exact:true}).waitFor()
    assert.deepEqual(apiCalls, [], 'demo must not call the live service API')
    await page.screenshot({path:path.join(results,'demo-creators-960x540.png')})
    console.log('PASS: demo login loads synthetic creators without live service requests.')
  }
  assert.deepEqual(errors, [])
  console.log('PASS: compiled React app loads, keyboard styles and inputmode, remote opening, typing into React state, navigation, close and focus restoration; 960x540 screenshots saved.')
} finally { await browser.close(); server.close() }
