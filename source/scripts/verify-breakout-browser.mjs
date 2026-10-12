// Optional browser QA: npm install --no-save playwright, then run this script.
// PLAYWRIGHT_PACKAGE may point to the bundled Playwright package.json.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

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
  const health = await page.request.get(`${base}/api/health`)
  assert.equal(health.headers()['x-breakout-test'], 'true', 'Start tests.smoke_server:app; deze test mag uitsluitend de testbackend wijzigen.')
  await page.request.post(`${base}/api/broker/disconnect`, {
    headers: { Origin: new URL(base).origin, 'X-Requested-With': 'trading-monitor' },
  })
  await page.goto(`${base}/#breakout`)
  await page
    .getByRole('heading', { name: 'Sterke aandelen. Geordende bases.' })
    .waitFor()
  assert.equal(await page.title(), 'Breakout · Trading Monitor')
  // Real React -> HTTP -> FastAPI -> SQLite -> Python analysis, with test-only broker injection.
  // Start backend with tests.smoke_server:app on 8788; no route interception or production fake mode.
  await page.getByRole('region', { name: 'Scannerverbinding' }).waitFor()
  assert.ok(
    (
      await page.getByRole('region', { name: 'Scannerverbinding' }).innerText()
    ).includes('Read-only — geen orderuitvoering'),
  )
  await page
    .getByRole('button', { name: 'Scanner verbinden', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Scanner loskoppelen', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Scan starten' }).waitFor()
  await page.getByRole('button', { name: 'Instellingen', exact: true }).click()
  await page.getByLabel('Universum', { exact: true }).selectOption('cached')
  await page
    .getByLabel('Universum-CSV uploaden')
    .setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'symbol,exchange,currency,company,sector\nTEST,NASDAQ,USD,Test company,Tech',
      ),
    })
  await page
    .getByRole('status')
    .filter({ hasText: 'aandelen geïmporteerd' })
    .waitFor()
  await page.getByLabel('Configuratie (JSON)').fill('{bad json')
  await page.getByRole('button', { name: 'Scan starten' }).click()
  await page.getByRole('alert').waitFor()
  assert.ok((await page.getByRole('alert').innerText()).length > 0)
  const settings = await (await page.request.get(`${base}/api/settings`)).json()
  await page
    .getByLabel('Configuratie (JSON)')
    .fill(JSON.stringify(settings.analysis, null, 2))
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
  await page.getByLabel('Minimumprijs', { exact: true }).fill('1000')
  await page
    .getByRole('heading', { name: 'Geen leiders in deze selectie' })
    .waitFor()
  await page.getByRole('button', { name: 'Filters wissen' }).click()
  await page.getByLabel('Beursfilter').selectOption('NASDAQ')
  await page.getByLabel('Sectorfilter').selectOption('Tech')
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
    'Browsercontrole geslaagd: API laden, validatie, scanresultaat, details, sortering, filters, zoekveld, CSV en mobiel (390 px). Echte FastAPI/SQLite-werkstroom met uitsluitend testbroker in tests.smoke_server; geen productie-demodata.',
  )
} finally {
  await browser.close()
}
