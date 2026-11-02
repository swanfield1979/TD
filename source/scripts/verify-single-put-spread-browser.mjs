import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { bullPutSpread } from '../shared/put-spread.mjs'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
page.setDefaultTimeout(15000)
const errors = [], requests = []
page.on('pageerror', error => errors.push(error.message))
const short = { symbol: 'AAPL', expiry: '20261218', tradingClass: 'AAPL', right: 'P', currency: 'USD', multiplier: 100, strike: 180, bid: 3, ask: 3.1, delta: -.2, underlyingPrice: 200, ivr: 60, ivPercentile: 75, marketDataType: 1, quotedAt: '2026-11-02T10:00:00Z' }
const base = bullPutSpread(short, { ...short, strike: 175, bid: 1.9, ask: 2, delta: -.1 }, '2026-11-02')
const rows = [15, 25, 35].map((returnOnRisk, i) => ({ ...base, id: `AAPL:${i}`, returnOnRisk, maxProfit: [60, 100, 140][i], maxLoss: 400, dte: 45, shortStrike: 180 - i, longStrike: 175 - i }))
const empty = { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
let single = { ...empty }, input, posts = 0, fail = false, running = false, noResults = false
await page.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname
  requests.push(`${req.method()} ${path}`)
  let status = 200, body
  if (path === '/api/single-put-spread') {
    if (req.method() === 'POST') {
      posts++; input = req.postDataJSON()
      assert.equal(input.symbol, 'AAPL')
      assert.equal(input.selectionId, undefined)
      assert.equal(input.ivSelectionId, undefined)
      assert.equal(input.filters.minDte, 30)
      assert.equal(input.filters.maxDte, 60)
      if (fail) { status = 503; body = { message: 'Test: IBKR niet bereikbaar.' } }
      else single = { ...empty, state: running ? 'running' : 'complete', symbols: ['AAPL'], chainSource: input.chainSource, filters: input.filters, rows: running || noResults ? [] : rows, universeCount: 1, universeChecked: running ? 0 : 1, remainingSymbols: running ? 1 : 0, contractsChecked: 6, progress: running ? 'AAPL: quotes ophalen' : 'AAPL afgerond', assessments: noResults ? [{ symbol: 'AAPL', status: 'no-match', reason: 'Geen spreads binnen de ingestelde criteria.' }] : [] }
    }
    body ??= single
  } else if (path === '/api/single-put-spread/stop') {
    single = { ...single, state: 'cancelled', progress: 'Scan gestopt.', remainingSymbols: 1 }; body = single
  } else if (path === '/api/put-spreads') body = { ...empty, state: 'complete', symbols: ['MSFT'], rows: [{ ...base, symbol: 'MSFT', id: 'MSFT:1' }] }
  else if (path === '/api/stock-filter') body = { state: 'idle', rows: [], failures: [], warnings: [], checked: 0, total: 0, cacheHits: 0 }
  else if (path === '/api/put-spreads/iv') body = { state: 'idle', rows: [], warnings: [] }
  else if (path === '/api/put-spreads/blocked') body = { entries: [] }
  else if (path === '/api/put-spreads/schedule') body = { settings: { enabled: false, stockDay: 0, stockTime: '09:00', ivAtMarketOpen: true }, state: 'idle', running: false }
  else if (path === '/api/ibkr/status') body = { state: 'offline', message: 'Testverbinding', isBusy: false }
  else { status = 404; body = {} }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
const tableRows = () => page.locator('.spreads-table > tbody > tr')
try {
  await page.goto(`${process.env.SPREAD_URL || 'http://127.0.0.1:5197'}/#single-put-spread`)
  await page.getByRole('heading', { name: 'Single Put Spread', exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Single Put Spread', exact: true }).getAttribute('aria-current'), 'page')
  assert.equal(await page.getByRole('heading', { name: '1. Stock Filter', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  assert.equal(await page.getByLabel('Optiechainbron', { exact: true }).inputValue(), 'ibkr')
  await page.getByText('Scancriteria aanpassen', { exact: true }).click()
  assert.equal(await page.getByLabel('Minimum DTE (dagen)', { exact: true }).inputValue(), '30')
  await page.getByText('Scancriteria aanpassen', { exact: true }).click()
  await page.getByLabel('Ticker', { exact: true }).fill('aapl,amd')
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByRole('alert').getByText('Vul één geldige ticker in, bijvoorbeeld AAPL.', { exact: true }).waitFor()
  assert.equal(posts, 0)
  await page.getByLabel('Ticker', { exact: true }).fill('aapl')
  await page.getByText('Scancriteria aanpassen', { exact: true }).click()
  await page.getByLabel('Minimum DTE (dagen)', { exact: true }).fill('')
  await page.getByText('Scancriteria aanpassen', { exact: true }).click()
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByRole('alert').getByText('Vul alle filters in.', { exact: true }).waitFor()
  assert.equal(posts, 0)
  await page.getByText('Scancriteria aanpassen', { exact: true }).click()
  await page.getByLabel('Minimum DTE (dagen)', { exact: true }).fill('30')
  await page.getByText('Scancriteria aanpassen', { exact: true }).click()

  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await tableRows().first().waitFor()
  assert.equal(posts, 1)
  assert.equal(input.filters.minAvgOptionVolume, 0)
  assert.equal(input.filters.minIvr, 0)
  assert.equal(input.filters.minIvPercentile, 0)
  assert.equal(await tableRows().count(), 3, 'All spreads for one ticker are visible')
  assert.deepEqual(await tableRows().evaluateAll(rows => rows.map(row => row.dataset.returnHighlight)), ['strong', 'medium', 'light'])
  assert.equal(await page.locator('.spreads-inspect').count(), 0)
  assert.equal(requests.some(path => /api\/(stock-filter|put-spreads\/iv)/.test(path)), false)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('maxProfit')
  await page.getByRole('button', { name: 'Hoog → laag', exact: true }).click()
  assert.equal(await tableRows().first().getAttribute('data-return-highlight'), 'light')
  await tableRows().first().locator('.spreads-expand-target').click()
  await page.getByRole('table', { name: 'Quotegegevens voor AAPL', exact: true }).waitFor()
  await tableRows().first().locator('.spreads-expand-target').click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV exporteren', exact: true }).click()
  const download = await downloadPromise, csv = await readFile(await download.path(), 'utf8')
  assert.equal(csv.split('\r\n').length, 4)
  await page.getByRole('button', { name: 'Uitgebreide tabel', exact: true }).click()
  assert.equal(await tableRows().count(), 3)
  await page.getByRole('button', { name: 'Compacte tabel', exact: true }).click()
  await mkdir('data/private/single-spread-validation', { recursive: true })
  for (const theme of ['dark', 'light']) {
    const toggle = page.getByRole('button', { name: /Donkere modus: / })
    if ((await toggle.getAttribute('aria-pressed') === 'true') !== (theme === 'dark')) await toggle.click()
    await page.screenshot({ path: `data/private/single-spread-validation/${theme}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForFunction(() => document.querySelector('.side-nav').getBoundingClientRect().right <= 0)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'data/private/single-spread-validation/mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.reload()
  await tableRows().first().waitFor()
  assert.equal(await tableRows().count(), 3)
  assert.equal(await page.getByLabel('Ticker', { exact: true }).inputValue(), 'AAPL')
  await page.getByRole('link', { name: 'Put spreads', exact: true }).click()
  await page.getByRole('heading', { name: '1. Stock Filter', exact: true }).waitFor()
  await page.getByRole('link', { name: 'MSFT', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Single Put Spread', exact: true }).click()
  await tableRows().first().waitFor()
  assert.equal(await tableRows().count(), 3)
  fail = true
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByRole('alert').getByText('Test: IBKR niet bereikbaar.', { exact: true }).waitFor()
  assert.equal(await tableRows().count(), 3)
  fail = false; running = true
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).waitFor()
  assert.equal(await page.getByLabel('Ticker', { exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).click()
  await page.getByRole('button', { name: 'Scan hervatten', exact: true }).waitFor()
  running = false
  await page.getByRole('button', { name: 'Scan hervatten', exact: true }).click()
  await tableRows().first().waitFor()
  assert.equal(input.resume, true)
  noResults = true
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByRole('heading', { name: 'Nog geen passende spreads', exact: true }).waitFor()
  await page.getByText('AAPL: Geen spreads binnen de ingestelde criteria.', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Single Put Spread verified: navigation, ticker validation, direct scan, all spreads, filters, sorting, quote details, CSV, themes, mobile, isolated state/preferences, reload, errors, stop/resume and empty results; no page errors.')
} finally { await browser.close() }
