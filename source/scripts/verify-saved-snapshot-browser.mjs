import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createPortfolioSummary } from './flex-parser.mjs'
import { createLiveSnapshot } from '../server/ibkr-domain.mjs'

const summary = createPortfolioSummary({ equityXml: '<EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-10-01" total="1100"/>', tradesXml: '', optionXml: '' })
const snapshot = value => createLiveSnapshot({ accountValues: new Map([['NetLiquidation', { value, currency: 'USD' }]]), positions: [], generatedAt: value === 12345 ? '2026-10-29T18:00:00Z' : '2026-10-30T18:00:00Z' })
let saved = snapshot(12345), snapshotStatus = 200, statusStatus = 200, refreshes = 0
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage()
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.clock.install()
await page.route('**/data/portfolio-summary.json*', route => route.fulfill({ json: summary }))
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname
  if (route.request().method() === 'POST') refreshes++
  if (path === '/api/ibkr/status') return route.fulfill({ status: statusStatus, json: { state: 'offline', isBusy: false, lastUpdatedAt: null, message: 'Gateway offline' } })
  if (path === '/api/ibkr/snapshot') return route.fulfill({ status: snapshotStatus, json: snapshotStatus === 200 ? saved : { message: 'Geen snapshot' } })
  return route.fulfill({ status: 404, json: {} })
})
const url = process.env.LAYOUT_URL || 'http://127.0.0.1:5197'
async function expectBalance(value) {
  await page.waitForFunction(value => document.querySelector('.portfolio-summary')?.textContent.includes(value), value)
}
try {
  await page.goto(url)
  await expectBalance('12.345,00')
  assert.equal(await page.getByText('IBKR niet verbonden', { exact: true }).count(), 1)
  assert.match(await page.locator('.ibkr-control small').innerText(), /Laatste synchronisatie/)
  assert.match(await page.locator('.data-freshness').innerText(), /Laatste IBKR-synchronisatie/)
  for (const route of ['stats', 'trades', 'dashboard']) {
    await page.goto(`${url}/#${route}`)
    await page.waitForFunction(() => document.querySelector('.data-freshness')?.textContent.includes('Laatste IBKR-synchronisatie'))
  }
  await page.reload(); await expectBalance('12.345,00')
  statusStatus = 503
  await page.reload(); await expectBalance('12.345,00')
  // A later server-side sync must arrive without a gateway connection or a refresh click.
  statusStatus = 200; saved = snapshot(23456)
  await page.clock.fastForward(16000)
  await expectBalance('23.456,00')
  snapshotStatus = 500
  await page.clock.fastForward(16000)
  await expectBalance('23.456,00')
  // Missing and malformed saved data retain the historical basis on a fresh page.
  snapshotStatus = 404
  await page.reload(); await expectBalance('1.100,00')
  snapshotStatus = 200; saved = {}
  await page.reload(); await expectBalance('1.100,00')
  saved = snapshot(12345)
  await page.reload(); await expectBalance('12.345,00')
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 950 })
    await page.getByText('IBKR niet verbonden', { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  await mkdir('data/private/snapshot-validation', { recursive: true })
  await page.screenshot({ path: 'data/private/snapshot-validation/offline-saved.png', fullPage: true })
  assert.equal(refreshes, 0, 'Opening and polling saved data never requests a gateway refresh')
  assert.deepEqual(errors, [])
  console.log('Saved snapshot verified: offline initial load, reload, unavailable status endpoint, background sync polling, failed reads retain current data, missing/malformed fallback, mobile/desktop and no gateway refresh requests.')
} finally { await browser.close() }
