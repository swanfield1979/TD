import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage()
page.setDefaultTimeout(15000)
const errors = []; page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0, isBusy: false, entries: [], settings: { enabled: false, stockDay: 0, stockTime: '09:00', ivAtMarketOpen: true } }) }))
try {
  await page.goto(`${process.env.LAYOUT_URL || 'http://127.0.0.1:5197'}/#dashboard`)
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor()
  await mkdir('data/private/layout-validation', { recursive: true })
  for (const width of [360, 768, 1440, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 1080 })
    const layout = await page.locator('.app-shell').evaluate(element => {
      const box = element.getBoundingClientRect()
      return { x: box.x, width: box.width, overflow: document.documentElement.scrollWidth > innerWidth + 1 }
    })
    assert.ok(!layout.overflow, 'No page overflow at ' + width)
    assert.ok(layout.width <= 1760 + 1)
    assert.ok(Math.abs(layout.x - (width - layout.width) / 2) <= 1, 'Centered at ' + width)
    if (width <= 1760) assert.ok(Math.abs(layout.width - width) <= 1, 'Available width used at ' + width)
    if ([360, 1440, 3440].includes(width)) await page.screenshot({ path: `data/private/layout-validation/dashboard-${width}.png`, fullPage: true })
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  await page.goto(`${process.env.LAYOUT_URL || 'http://127.0.0.1:5197'}/#put-spreads`)
  await page.getByRole('heading', { name: '3. Option Scan', exact: true }).waitFor()
  assert.ok(await page.locator('.app-shell').evaluate(element => element.getBoundingClientRect().width <= 1761))
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.setViewportSize({ width: 360, height: 900 })
  await page.getByRole('button', { name: 'Menu openen', exact: true }).click()
  await page.getByRole('link', { name: 'Dashboard', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Menu sluiten', exact: true }).first().click()
  assert.deepEqual(errors, [])
  console.log('Layout verified: centered maximum 1760px, full smaller widths, dashboard and spreads, 360–3440px, mobile navigation and 200% zoom; no page errors.')
} finally { await browser.close() }
