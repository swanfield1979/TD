import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { bullPutSpread, spreadFilters } from '../shared/put-spread.mjs'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const errors = []; page.on('pageerror', error => errors.push(error.message))
const today = '2026-10-24'
const short = { symbol: 'HOOD', expiry: '20270122', tradingClass: 'HOOD', right: 'P', currency: 'USD', multiplier: 100, strike: 75, bid: 1.2, ask: 1.4, delta: -.12, underlyingPrice: 110, ivr: 45, marketDataType: 3, quotedAt: '2026-10-24T10:00:00Z' }
const row = { ...bullPutSpread(short, { ...short, strike: 65, bid: .5, ask: .6, delta: -.08 }, today), ivSource: 'historical-close', ivAsOf: '2026-10-23', avgOptionVolume: 10000, avgOptionVolumeAt: '2026-10-23T19:55:00Z', dayOptionVolume: 12000, dayOptionVolumeAt: '2026-10-23T19:55:00Z' }
let scan = { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
let failure = false, running = false, posts = 0, resumePosted = false
await page.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname
  let status = 200, body = {}
  if (path === '/api/put-spreads') {
    if (req.method() === 'POST') {
      posts++
      const input = req.postDataJSON()
      if (input.resume) resumePosted = true
      assert.deepEqual(input.symbols, input.universeMode === 'us' ? [] : ['HOOD', 'AMD'])
      assert.equal(input.filters.minDte, 40)
      assert.equal(input.filters.minAvgOptionVolume, 5000)
      if (failure) { status = 503; body = { message: 'Test: broker niet beschikbaar.' } }
      else scan = { state: running ? 'running' : 'partial', progress: 'Put spreads · HOOD', universeMode: input.universeMode, universeCount: 75, universeChecked: 2, remainingSymbols: 73, cacheHits: 1, chainsSkipped: 1, marketOpen: false, assessments: [{ symbol: 'LOW', status: 'filtered', reason: 'IV-rank te laag; optiechain overgeslagen.', source: 'cache', asOf: '2026-10-23T19:55:00Z' }], filters: spreadFilters(input.filters), rows: running ? [] : [{ ...row, cached: true }, { ...row, id: 'AMD:1', symbol: 'AMD', maxLoss: 500, returnOnRisk: 12 }], symbols: input.symbols, warnings: ['TEST: ontbrekende optiedata; overgeslagen.'], symbolsChecked: 2, contractsChecked: 4, finishedAt: running ? undefined : '2026-10-24T10:01:00Z' }
    }
    if (status === 200) body = scan
  } else if (path === '/api/put-spreads/stop') { scan = { ...scan, state: 'cancelled' }; body = scan }
  else if (path === '/api/iv-scan') body = { state: 'complete', rows: [{ symbol: 'HOOD' }, { symbol: 'AMD' }], warnings: [] }
  else if (path === '/api/ibkr/status') body = { state: 'offline', message: 'Testverbinding', isBusy: false }
  else status = 404
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto(`${process.env.SPREAD_URL || 'http://127.0.0.1:5197'}/#put-spreads`)
  await page.getByRole('heading', { name: 'Bull put spread', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Scan starten', exact: true }).waitFor({ state: 'visible' })
  assert.equal(await page.getByLabel('Aandelenuniversum', { exact: true }).inputValue(), 'us')
  await page.getByRole('button', { name: 'Scan starten', exact: true }).click()
  await page.getByText('IV-rank te laag; optiechain overgeslagen.', { exact: true }).waitFor()
  await page.getByText('Optiemarkt gesloten · oude chains waar beschikbaar', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'IV-resultaten overnemen', exact: true }).click()
  await page.getByLabel('Tickers (maximaal 50)').inputValue().then(value => assert.equal(value, 'HOOD, AMD'))
  await page.getByRole('button', { name: 'Scan starten', exact: true }).click()
  await page.getByRole('heading', { name: 'Gevonden spreads', exact: true }).waitFor()
  await page.locator('.spreads-table tbody tr').first().waitFor()
  await page.getByText('Dag-IV 2026-10-23', { exact: true }).first().waitFor()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 2)
  await page.getByRole('columnheader', { name: 'Gem. optievolume', exact: true }).waitFor()
  await page.getByRole('columnheader', { name: 'Laatste dagvolume', exact: true }).waitFor()
  assert.match(await page.locator('.spreads-table tbody tr').first().innerText(), /AMD/)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('maxLoss')
  assert.match(await page.locator('.spreads-table tbody tr').first().innerText(), /HOOD/)
  await page.getByLabel('Ticker zoeken', { exact: true }).fill('HOOD')
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 1)
  await page.locator('.spreads-table tbody summary').click()
  await page.getByText('Vertraagd · 24-10-2026', { exact: false }).first().waitFor()
  assert.match(await page.locator('.spreads-table tbody').innerText(), /940,00/)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV exporteren', exact: true }).click()
  assert.equal((await downloadPromise).suggestedFilename(), 'bull-put-spreads.csv')
  await page.getByLabel('Ticker zoeken', { exact: true }).fill('ZZZ')
  await page.getByRole('heading', { name: 'Geen spreads voor deze ticker' }).waitFor()
  await page.getByRole('button', { name: 'Zoekfilter wissen' }).click()
  await page.locator('.spreads-table tbody summary').first().click()
  await mkdir('data/private/spread-validation', { recursive: true })
  await page.screenshot({ path: 'data/private/spread-validation/desktop.png', fullPage: true })
  for (const width of [360, 768, 1024, 1600]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No page overflow at ${width}`)
  }
  await page.setViewportSize({ width: 360, height: 900 })
  await page.waitForFunction(() => document.querySelector('.side-nav').getBoundingClientRect().right <= 0)
  await page.getByRole('button', { name: 'Menu openen', exact: true }).click()
  await page.getByRole('button', { name: 'Menu sluiten', exact: true }).first().click()
  await page.waitForFunction(() => document.querySelector('.side-nav').getBoundingClientRect().right <= 0)
  await page.screenshot({ path: 'data/private/spread-validation/mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.getByLabel('Ticker zoeken', { exact: true }).focus()
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'spread-sort')
  await page.getByRole('button', { name: 'Donkere modus: aan', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  await page.screenshot({ path: 'data/private/spread-validation/light.png', fullPage: true })
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow at 200% zoom')
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  await page.reload(); await page.locator('.spreads-table tbody tr').first().waitFor()
  assert.equal(await page.getByLabel('Tickers (maximaal 50)').inputValue(), 'HOOD, AMD')
  failure = true
  await page.getByRole('button', { name: 'Scan starten', exact: true }).click()
  await page.getByText('Test: broker niet beschikbaar.', { exact: true }).waitFor()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 2)
  failure = false; running = true
  await page.getByRole('button', { name: 'Scan starten', exact: true }).click()
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Scan bezig…' }).isDisabled(), true)
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).click()
  await page.getByText('Scan gestopt', { exact: true }).waitFor()
  assert.equal(posts, 4)
  scan = { ...scan, state: 'complete', rows: Array.from({ length: 55 }, (_, i) => ({ ...row, id: `test:${i}` })) }
  await page.reload(); await page.locator('.spreads-table tbody tr').first().waitFor()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 50)
  await page.getByRole('button', { name: 'Volgende', exact: true }).click()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 5)
  scan = { ...scan, state: 'paused', remainingSymbols: 0, retryFrom: 0, message: 'Test: gepauzeerd na vijf IV-fouten.' }
  await page.reload()
  await page.getByText('Test: gepauzeerd na vijf IV-fouten.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Scan hervatten', exact: true }).click()
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).waitFor()
  assert.equal(resumePosted, true)
  assert.deepEqual(errors, [])
  console.log('Spread workflow verified: IV selection, conservative amounts, sorting, search, quotes, CSV, persistence, errors, stop, 360–1600px; no page errors.')
} finally { await browser.close() }
