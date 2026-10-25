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
let stock = { state: 'idle', rows: [], failures: [], warnings: [], checked: 0, total: 0, cacheHits: 0 }
let stockPosts = 0
let stockFailure = false, stockRunning = false, stockEmpty = false
let iv = { state: 'idle', rows: [], warnings: [] }, ivPosts = 0
const blockedStocks = new Map()
let planning = { settings: { enabled: true, stockDay: 0, stockTime: '09:00', ivAtMarketOpen: true }, state: 'idle', running: false }
await page.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname
  let status = 200, body = {}
  if (path === '/api/stock-filter') {
    if (req.method() === 'POST') {
      stockPosts++
      const input = req.postDataJSON()
      assert.equal(input.filters.minVolume, 5000000)
      if (stockFailure) { status = 503; body = { message: 'Test: aandelenbron niet beschikbaar.' } }
      else stock = { ...stock, id: `saved-selection-${stockPosts}`, state: stockRunning ? 'running' : 'complete', filters: input.filters, universeMode: input.universeMode, symbols: input.universeMode === 'custom' ? input.symbols : [], checked: stockRunning ? 3 : 75, total: 75, cacheHits: stockPosts > 1 ? 75 : 0, finishedAt: '2026-10-25T10:00:00Z', rows: (stockEmpty ? [] : ['HOOD', 'AMD']).map(symbol => ({ symbol, price: 110, volume: 6000000, asOf: '2026-10-23', source: 'Yahoo Finance', fetchedAt: '2026-10-25T10:00:00Z', cached: stockPosts > 1 })) }
    }
    if (status === 200) body = stock
  } else if (path === '/api/stock-filter/stop') {
    stock = { ...stock, state: 'cancelled', canResume: true }; body = stock
  } else if (path === '/api/put-spreads/iv') {
    if (req.method() === 'POST') {
      ivPosts++
      const input = req.postDataJSON()
      assert.equal(input.selectionId, stock.id)
      iv = { id: `iv-${ivPosts}`, state: 'complete', stockSelectionId: input.selectionId, filters: input.filters, universeChecked: 2, universeCount: 2, finishedAt: '2026-10-26T14:00:00Z', rows: ['HOOD', 'AMD'].map(symbol => ({ symbol, ivr: 60, iv: 45, ivPercentile: 70, underlyingPrice: 110, ivSource: 'quote', ivAsOf: '2026-10-26', quotedAt: '2026-10-26T14:00:00Z' })), warnings: [] }
    }
    body = iv
  } else if (path === '/api/put-spreads/blocked') {
    if (req.method() === 'POST') {
      const input = req.postDataJSON()
      if (input.blocked) blockedStocks.set(input.symbol, { symbol: input.symbol, blockedAt: '2026-10-25T12:00:00Z' })
      else blockedStocks.delete(input.symbol)
    }
    body = { entries: [...blockedStocks.values()] }
  } else if (path === '/api/put-spreads/schedule') {
    if (req.method() === 'POST') planning = { ...planning, settings: req.postDataJSON() }
    body = planning
  } else if (path === '/api/put-spreads') {
    if (req.method() === 'POST') {
      posts++
      const input = req.postDataJSON()
      if (input.resume) resumePosted = true
      if (!input.resume) { assert.equal(input.selectionId, stock.id); assert.equal(input.ivSelectionId, iv.id); assert.equal(input.filters.minIvr, iv.filters.minIvr) }
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
  if (Array.isArray(body.rows)) body = { ...body, rows: body.rows.filter(row => !blockedStocks.has(row.symbol)) }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto(`${process.env.SPREAD_URL || 'http://127.0.0.1:5197'}/#put-spreads`)
  await page.getByRole('heading', { name: '1. Stock Filter', exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'IV Scan', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  assert.equal(await page.getByLabel('Aandelenuniversum', { exact: true }).inputValue(), 'us')
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  await page.getByText('75 / 75 gecontroleerd · 2 geselecteerd', { exact: true }).waitFor()
  assert.equal(posts, 0)
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'IV Scan starten', exact: true }).click()
  await page.getByRole('region', { name: 'IV-resultaten', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByText('2 / 75 aandelen gescand', { exact: true }).waitFor()
  assert.equal(await page.getByText('IV-rank te laag; optiechain overgeslagen.', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('region', { name: 'Aandelenbeoordelingen' }).count(), 0)
  assert.equal(await page.getByText('TEST: ontbrekende optiedata; overgeslagen.', { exact: true }).count(), 0)
  await page.getByLabel('Aandelenuniversum', { exact: true }).selectOption('custom')
  await page.getByLabel('Tickers (maximaal 50)').fill('HOOD, AMD')
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'IV Scan starten', exact: true }).click()
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
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
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByText('Test: broker niet beschikbaar.', { exact: true }).waitFor()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 2)
  failure = false; running = true
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
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
  await page.getByText('Scan gepauzeerd', { exact: true }).waitFor()
  assert.equal(await page.getByText('Test: gepauzeerd na vijf IV-fouten.', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Scan hervatten', exact: true }).click()
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).waitFor()
  assert.equal(resumePosted, true)
  await page.getByRole('button', { name: 'Scan stoppen', exact: true }).click()
  await page.getByLabel('Minimum koers ($)', { exact: true }).fill('6')
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  stockFailure = true
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  await page.getByText('Test: aandelenbron niet beschikbaar.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('region', { name: 'Geselecteerde aandelen' }).locator('tbody tr').count(), 2)
  stockFailure = false; stockRunning = true
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  await page.getByRole('button', { name: 'Aandelenfilter stoppen', exact: true }).waitFor()
  assert.equal(await page.getByLabel('Minimum koers ($)', { exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Aandelenfilter stoppen', exact: true }).click()
  await page.getByRole('button', { name: 'Aandelenfilter hervatten', exact: true }).waitFor()
  stockRunning = false
  await page.getByRole('button', { name: 'Aandelenfilter hervatten', exact: true }).click()
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).waitFor({ state: 'visible' })
  await page.getByLabel('Zoeken in aandelen', { exact: true }).fill('ZZZ')
  await page.getByText('Geen aandelen voor deze zoekterm.', { exact: true }).waitFor()
  await page.getByLabel('Zoeken in aandelen', { exact: true }).fill('')
  await page.getByRole('region', { name: 'Geselecteerde aandelen', exact: true }).getByRole('button', { name: 'Verwijder HOOD', exact: true }).click()
  await page.getByRole('region', { name: 'Geblokkeerde Stocks', exact: true }).getByRole('button', { name: 'Deblokkeer HOOD', exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelector('[aria-label="Geselecteerde aandelen"] tbody').querySelectorAll('tr').length === 1)
  await page.reload()
  await page.getByRole('region', { name: 'Geblokkeerde Stocks', exact: true }).getByRole('button', { name: 'Deblokkeer HOOD', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Geselecteerde aandelen"] tbody').querySelectorAll('tr').length === 2)
  assert.equal(await page.getByLabel('Dag Stock Filter', { exact: true }).inputValue(), '0')
  assert.equal(await page.getByLabel('Tijd Stock Filter (Nederland)', { exact: true }).inputValue(), '09:00')
  await page.getByLabel('Tijd Stock Filter (Nederland)', { exact: true }).fill('10:15')
  await page.getByRole('button', { name: 'Weekplanning opslaan', exact: true }).click()
  await page.getByText('Weekplanning opgeslagen.', { exact: true }).waitFor()
  await page.reload()
  await page.waitForFunction(() => document.querySelector('input[type="time"]')?.value === '10:15')
  await page.getByRole('button', { name: 'IV Scan starten', exact: true }).click()
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Optiescan starten')?.disabled)
  await page.getByLabel('Minimum IV-rank', { exact: true }).fill('50')
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  stockEmpty = true
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  await page.getByText('Geen passende aandelen. Pas de criteria aan en start opnieuw.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('Three-stage scan verified: Stock Filter > IV Scan > Option Scan, standalone IV navigation removed, blocked stocks persist and unblock, weekly schedule persists, dirty/empty/loading guards, stock stop/resume, option amounts, sorting, search, quotes, CSV, persistence, errors, option stop/resume, 360–1600px and 200% zoom; no page errors.')
} finally { await browser.close() }
