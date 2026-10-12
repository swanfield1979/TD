// Optional browser QA: npm install --no-save playwright, then run this script.
// PLAYWRIGHT_PACKAGE may point to the bundled Playwright package.json.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import {
  DEFAULT_CONFIG,
  analyzeStock,
  rankStocks,
} from '../shared/leadership.mjs'

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)
const { chromium } = require('playwright')
const base = process.env.BREAKOUT_TEST_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
  headless: true,
})
const errors = []
await mkdir(new URL('../data/private/', import.meta.url), { recursive: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/#breakout`)
  await page
    .getByRole('heading', { name: 'Sterke aandelen. Geordende bases.' })
    .waitFor()
  assert.equal(await page.title(), 'Breakout · Trading Monitor')
  // First verify real API/empty state before using isolated browser-route test fixtures.
  await page.getByRole('button', { name: 'Scan starten' }).waitFor()
  await page.getByRole('button', { name: 'Instellingen', exact: true }).click()
  await page.getByLabel('Universum', { exact: true }).selectOption('custom')
  await page.getByLabel('Tickers', { exact: true }).fill('TEST')
  await page.getByLabel('Configuratie (JSON)').fill('{bad json')
  await page.getByRole('button', { name: 'Scan starten' }).click()
  await page.getByRole('alert').waitFor()
  assert.ok((await page.getByRole('alert').innerText()).length > 0)
  await page
    .getByLabel('Configuratie (JSON)')
    .fill(JSON.stringify(DEFAULT_CONFIG, null, 2))
  const bars = []
  const add = (close, range = 1) =>
    bars.push({
      date: new Date(Date.UTC(2025, 0, 1 + bars.length * 2))
        .toISOString()
        .slice(0, 10),
      open: close - 0.1,
      high: close + range / 2,
      low: close - range / 2,
      close,
      volume: 100000,
    })
  for (let i = 0; i < 140; i++) add(45 + i * 0.025)
  for (let i = 1; i <= 10; i++) add(48.5 + i * 3.5, 2)
  for (let i = 0; i < 24; i++) add(82 + i * 0.1, 6 - i * 0.21)
  add(90, 5)
  const fixture = {
    state: 'complete',
    rows: rankStocks([analyzeStock('TEST', bars)]),
    warnings: [],
    config: DEFAULT_CONFIG,
    total: 1,
    progress: 1,
    universe: 'custom',
    symbols: 'TEST',
    asOf: bars.at(-1).date,
    source: 'TESTFIXTURE · browsercontrole',
  }
  await page.route('**/api/breakout', (route) =>
    route.fulfill({ json: fixture }),
  )
  await page.getByRole('button', { name: 'Scan starten' }).click()
  await page.getByRole('button', { name: 'TEST', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Instellingen', exact: true }).click()
  await page.getByRole('button', { name: 'TEST', exact: true }).click()
  await page.getByRole('region', { name: 'Setupdetails TEST' }).waitFor()
  assert.ok(
    (
      await page.getByRole('region', { name: 'Setupdetails TEST' }).innerText()
    ).includes('Breakout actief'),
  )
  await page.getByRole('button', { name: '3M', exact: false }).click()
  await page.getByRole('button', { name: 'Top 5%', exact: true }).click()
  await page.getByLabel('Setupstatus', { exact: true }).selectOption('failed')
  await page
    .getByRole('heading', { name: 'Geen leiders in deze selectie' })
    .waitFor()
  await page.getByLabel('Setupstatus', { exact: true }).selectOption('all')
  await page.getByLabel('Ticker zoeken').fill('NONE')
  await page
    .getByRole('heading', { name: 'Geen leiders in deze selectie' })
    .waitFor()
  await page.getByLabel('Ticker zoeken').fill('TEST')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV exporteren' }).click()
  assert.match((await download).suggestedFilename(), /^breakout-/)
  await page.screenshot({
    path: new URL(
      '../data/private/breakout-desktop.png',
      import.meta.url,
    ).pathname.slice(process.platform === 'win32' ? 1 : 0),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(
    () =>
      document.querySelector('.side-nav').getBoundingClientRect().right <= 0,
  )
  await page.getByRole('button', { name: 'Menu openen', exact: true }).click()
  await page
    .getByRole('button', { name: 'Menu sluiten', exact: true })
    .last()
    .click()
  await page.waitForFunction(
    () =>
      document.querySelector('.side-nav').getBoundingClientRect().right <= 0,
  )
  await page.screenshot({
    path: new URL(
      '../data/private/breakout-mobile.png',
      import.meta.url,
    ).pathname.slice(process.platform === 'win32' ? 1 : 0),
    fullPage: true,
  })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    'Mobile page must not overflow viewport',
  )
  assert.deepEqual(errors, [])
  console.log(
    'Browsercontrole geslaagd: API laden, validatie, scanresultaat, details, sortering, filters, zoekveld, CSV en mobiel (390 px). Testfixtures uitsluitend via browserroute.',
  )
} finally {
  await browser.close()
}
