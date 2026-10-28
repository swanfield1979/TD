import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { bullPutSpread, spreadFilters } from '../shared/put-spread.mjs'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(20000)
const errors = []; page.on('pageerror', error => errors.push(error.message))
const today = '2026-10-24'
const sector = symbol => ({ sector: symbol === 'AMD' ? 'Technology' : 'Financials', sectorSource: 'Nasdaq', sectorAsOf: '2026-10-25T09:00:00Z' })
const short = { symbol: 'HOOD', expiry: '20270122', tradingClass: 'HOOD', right: 'P', currency: 'USD', multiplier: 100, strike: 75, bid: 1.2, ask: 1.4, delta: -.12, underlyingPrice: 110, ivr: 45, marketDataType: 3, quotedAt: '2026-10-24T10:00:00Z' }
const row = { ...bullPutSpread(short, { ...short, strike: 65, bid: .5, ask: .6, delta: -.08 }, today), ...sector('HOOD'), ivSource: 'historical-close', ivAsOf: '2026-10-23', avgOptionVolume: 10000, avgOptionVolumeAt: '2026-10-23T19:55:00Z', dayOptionVolume: 12000, dayOptionVolumeAt: '2026-10-23T19:55:00Z' }
let scan = { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
let failure = false, running = false, posts = 0, resumePosted = false
let stock = { state: 'idle', rows: [], failures: [], warnings: [], checked: 0, total: 0, cacheHits: 0 }
let stockPosts = 0
let stockFailure = false, stockRunning = false, stockEmpty = false
let iv = { state: 'idle', rows: [], warnings: [] }, ivPosts = 0
const blockedStocks = new Map([['AIOK', { symbol: 'AIOK', blockedAt: '2026-10-25T12:00:00Z', automatic: true, stage: 'iv', reason: 'Geen bruikbare IV of recente volledige IV-jaarhistorie.' }]])
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
      else stock = { ...stock, id: `saved-selection-${stockPosts}`, state: stockRunning ? 'running' : 'complete', filters: input.filters, universeMode: input.universeMode, symbols: input.universeMode === 'custom' ? input.symbols : [], checked: stockRunning ? 3 : 75, total: 75, cacheHits: stockPosts > 1 ? 75 : 0, finishedAt: '2026-10-25T10:00:00Z', rows: (stockEmpty ? [] : ['HOOD', 'AMD']).map(symbol => ({ symbol, ...sector(symbol), price: 110, volume: 6000000, asOf: '2026-10-23', source: 'Yahoo Finance', fetchedAt: '2026-10-25T10:00:00Z', cached: stockPosts > 1 })) }
    }
    if (status === 200) body = stock
  } else if (path === '/api/stock-filter/stop') {
    stock = { ...stock, state: 'cancelled', canResume: true }; body = stock
  } else if (path === '/api/put-spreads/iv') {
    if (req.method() === 'POST') {
      ivPosts++
      const input = req.postDataJSON()
      assert.equal(input.selectionId, stock.id)
      iv = { id: `iv-${ivPosts}`, state: 'complete', stockSelectionId: input.selectionId, filters: input.filters, universeChecked: 2, universeCount: 2, finishedAt: '2026-10-26T14:00:00Z', rows: ['HOOD', 'AMD'].map(symbol => ({ symbol, ...sector(symbol), ivr: 60, iv: 45, ivPercentile: 70, underlyingPrice: 110, ivSource: 'quote', ivAsOf: '2026-10-26', quotedAt: '2026-10-26T14:00:00Z' })), warnings: [] }
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
      assert.equal(input.chainSource, 'yahoo')
      assert.equal(input.filters.minDte, 40)
      assert.equal(input.filters.minAvgOptionVolume, 5000)
      if (failure) { status = 503; body = { message: 'Test: broker niet beschikbaar.' } }
      else scan = { chainSource: input.chainSource, state: running ? 'running' : 'partial', progress: 'Put spreads · HOOD', universeMode: input.universeMode, universeCount: 75, universeChecked: 2, remainingSymbols: 73, cacheHits: 1, chainsSkipped: 1, marketOpen: false, assessments: [{ symbol: 'LOW', status: 'filtered', reason: 'IV-rank te laag; optiechain overgeslagen.', source: 'cache', asOf: '2026-10-23T19:55:00Z' }], filters: spreadFilters(input.filters), rows: running ? [] : [{ ...row, cached: true }, { ...row, ...sector('AMD'), id: 'AMD:1', symbol: 'AMD', maxLoss: 500, returnOnRisk: 12 }], symbols: input.symbols, warnings: ['TEST: ontbrekende optiedata; overgeslagen.'], symbolsChecked: 2, contractsChecked: 4, finishedAt: running ? undefined : '2026-10-24T10:01:00Z' }
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
  await page.getByRole('region', { name: 'Geblokkeerde Stocks', exact: true }).getByText('Automatisch · IV Scan', { exact: false }).waitFor()
  await page.getByRole('region', { name: 'Geblokkeerde Stocks', exact: true }).getByText('Geen bruikbare IV of recente volledige IV-jaarhistorie.', { exact: true }).waitFor()
  await page.getByRole('region', { name: 'Geblokkeerde Stocks', exact: true }).getByRole('button', { name: 'Deblokkeer AIOK', exact: true }).click()
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Deblokkeer AIOK'))
  assert.equal(await page.getByRole('link', { name: 'IV Scan', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  assert.equal(await page.getByLabel('Aandelenuniversum', { exact: true }).inputValue(), 'us')
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  await page.getByText('75 / 75 gecontroleerd · 2 geselecteerd', { exact: true }).waitFor()
  const stockSummary = page.locator('.stock-results-disclosure > summary')
  await stockSummary.waitFor()
  assert.equal(await page.getByRole('region', { name: 'Geselecteerde aandelen', exact: true }).isVisible(), true)
  await stockSummary.focus(); await page.keyboard.press('Enter')
  await page.waitForFunction(() => !document.querySelector('.stock-results-disclosure').open)
  assert.equal(await page.locator('[aria-label="Geselecteerde aandelen"]').isVisible(), false)
  await page.getByText('75 / 75 gecontroleerd · 2 geselecteerd', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'IV Scan starten', exact: true }).isEnabled(), true)
  await page.reload()
  await stockSummary.waitFor()
  assert.equal(await page.locator('.stock-results-disclosure').getAttribute('open'), null)
  assert.equal(await page.locator('[aria-label="Geselecteerde aandelen"]').isVisible(), false)
  await stockSummary.focus(); await page.keyboard.press('Space')
  await page.getByRole('region', { name: 'Geselecteerde aandelen', exact: true }).waitFor()
  await page.getByLabel('Zoeken in aandelen', { exact: true }).fill('HOOD')
  await stockSummary.click(); await stockSummary.click()
  assert.equal(await page.getByLabel('Zoeken in aandelen', { exact: true }).inputValue(), 'HOOD')
  await page.getByLabel('Zoeken in aandelen', { exact: true }).fill('')
  assert.equal(posts, 0)
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'IV Scan starten', exact: true }).click()
  await page.getByRole('region', { name: 'IV-resultaten', exact: true }).waitFor()
  const countsBeforeFolding = [stockPosts, ivPosts, posts]
  await page.getByRole('button', { name: 'Stap 1 inklappen', exact: true }).click()
  await page.getByRole('button', { name: 'Stap 2 inklappen', exact: true }).focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.getByLabel('Minimum koers ($)', { exact: true }).isVisible(), false)
  assert.equal(await page.getByRole('region', { name: 'IV-resultaten', exact: true }).isVisible(), false)
  assert.equal(await page.getByRole('heading', { name: '3. Option Scan', exact: true }).isVisible(), true)
  await page.reload()
  await page.getByRole('button', { name: 'Stap 1 uitklappen', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Stap 2 uitklappen', exact: true }).waitFor()
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Optiescan starten')?.disabled)
  assert.equal(await page.getByLabel('Minimum IV-rank', { exact: true }).isVisible(), false)
  assert.deepEqual([stockPosts, ivPosts, posts], countsBeforeFolding)
  await mkdir('data/private/spread-validation', { recursive: true })
  await page.screenshot({ path: 'data/private/spread-validation/collapsed-steps.png', fullPage: true })
  assert.equal(await page.getByLabel('Optiechainbron', { exact: true }).inputValue(), 'ibkr')
  await page.getByLabel('Optiechainbron', { exact: true }).selectOption('yahoo')
  await page.getByRole('button', { name: 'Optiescan starten', exact: true }).click()
  await page.getByText('Yahoo-voorselectie + IBKR-controle', { exact: true }).waitFor()
  await page.getByText('2 / 75 aandelen gescand', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Stap 1 uitklappen', exact: true }).focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Stap 2 uitklappen', exact: true }).click()
  assert.equal(await page.getByLabel('Minimum IV-rank', { exact: true }).inputValue(), '40')
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
  for (const name of ['Geselecteerde aandelen', 'IV-resultaten', 'Bull-put-spreadresultaten']) {
    const region = page.getByRole('region', { name, exact: true })
    if (name === 'Bull-put-spreadresultaten') {
      assert.equal(await region.getByRole('columnheader', { name: 'Sector', exact: true }).count(), 0)
      for (const header of ['Buffer', 'DTE', 'B/L', 'Jaar-R/R']) await region.getByRole('columnheader', { name: header, exact: true }).waitFor()
      await page.screenshot({ path: 'data/private/spread-validation/compact.png', fullPage: true })
      await page.getByRole('button', { name: 'Uitgebreide tabel', exact: true }).click()
    }
    await region.getByRole('columnheader', { name: 'Sector', exact: true }).waitFor()
    await region.getByRole('cell', { name: 'Tech', exact: true }).waitFor()
    await region.getByRole('cell', { name: 'Financials', exact: true }).waitFor()
    const link = region.getByRole('link', { name: 'HOOD', exact: true })
    assert.equal(await link.getAttribute('href'), 'https://www.tradingview.com/chart/fxY1us9e/?symbol=HOOD')
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
  }
  await page.context().route('https://www.tradingview.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>TradingView-linkcontrole</title>' }))
  const linkedDetails = page.getByRole('region', { name: 'Bull-put-spreadresultaten', exact: true }).locator('tbody tr').filter({ has: page.getByRole('link', { name: 'HOOD', exact: true }) }).locator('details')
  const detailsBefore = await linkedDetails.getAttribute('open')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('region', { name: 'Bull-put-spreadresultaten', exact: true }).getByRole('link', { name: 'HOOD', exact: true }).click()
  const popup = await popupPromise
  await popup.waitForLoadState()
  assert.equal(popup.url(), 'https://www.tradingview.com/chart/fxY1us9e/?symbol=HOOD')
  assert.equal(await popup.evaluate(() => window.opener === null), true)
  assert.equal(await linkedDetails.getAttribute('open'), detailsBefore)
  await popup.close()
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
  const exported = await downloadPromise
  assert.equal(exported.suggestedFilename(), 'bull-put-spreads.csv')
  const csv = await readFile(await exported.path(), 'utf8')
  assert.match(csv, /;sector;sectorSource;sectorAsOf;/)
  assert.match(csv, /;annualizedReturnOnRisk/)
  assert.match(csv, /"Financials"/)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('annualizedReturn')
  assert.match(await page.locator('.spreads-table tbody tr').first().innerText(), /25,89%/)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('returnOnRisk')
  await page.getByRole('button', { name: 'Compacte tabel', exact: true }).click()
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
  scan = { ...scan, state: 'complete', rows: Array.from({ length: 55 }, (_, i) => ({ ...row, id: `test:${i}`, symbol: `STOCK${i}` })) }
  await page.reload(); await page.locator('.spreads-table tbody tr').first().waitFor()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 50)
  await page.getByRole('button', { name: 'Volgende', exact: true }).click()
  assert.equal(await page.locator('.spreads-table tbody tr').count(), 5)
  // Multiple candidates per stock: group before paging, retain all alternatives and CSV rows.
  scan = { ...scan, state: 'complete', rows: [
    { ...row, id: 'hood-best-ratio', returnOnRisk: 20, maxProfit: 100, maxLoss: 500 },
    { ...row, id: 'hood-most-profit', returnOnRisk: 15, maxProfit: 150, maxLoss: 1000 },
    { ...row, id: 'hood-lowest-risk', returnOnRisk: 10, maxProfit: 20, maxLoss: 200 },
    { ...row, id: 'amd-best', symbol: 'AMD', returnOnRisk: 18, maxProfit: 90, maxLoss: 500 },
  ] }
  await page.reload()
  const results = page.getByRole('region', { name: 'Bull-put-spreadresultaten', exact: true })
  await results.getByRole('button', { name: '2 andere spreads voor HOOD bekijken', exact: true }).waitFor()
  assert.equal(await results.locator('tbody tr').count(), 2)
  assert.match(await results.locator('tbody tr').first().innerText(), /HOOD/)
  assert.match(await results.locator('tbody tr').first().innerText(), /100,00/)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('maxProfit')
  assert.match(await results.locator('tbody tr').first().innerText(), /150,00/)
  const groupedDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV exporteren', exact: true }).click()
  const groupedCsv = await readFile(await (await groupedDownload).path(), 'utf8')
  assert.equal(groupedCsv.split('\r\n').length, 5, 'CSV retains all four candidates')
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('returnOnRisk')
  const scanPostsBeforeInspect = posts
  await results.getByRole('button', { name: '2 andere spreads voor HOOD bekijken', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'Andere spreads voor HOOD', exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Andere spreads voor HOOD', exact: true }).evaluate(el => el === document.activeElement), true)
  assert.equal(await results.locator('tbody tr').count(), 2)
  assert.match(await results.locator('tbody tr').first().innerText(), /15%/)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('maxProfit')
  assert.match(await results.locator('tbody tr').first().innerText(), /150,00/)
  assert.match(await results.locator('tbody tr').last().innerText(), /20,00/)
  await results.locator('summary').first().click()
  await page.screenshot({ path: 'data/private/spread-validation/stock-alternatives.png', fullPage: true })
  for (const width of [360, 768, 1024, 1600]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Grouped detail contains overflow at ' + width)
  }
  await page.getByRole('button', { name: 'Terug naar aandelen', exact: true }).click()
  const inspectHood = results.getByRole('button', { name: '2 andere spreads voor HOOD bekijken', exact: true })
  assert.equal(await inspectHood.evaluate(el => el === document.activeElement), true)
  await page.getByRole('button', { name: 'Hoog → laag', exact: true }).click()
  assert.match(await results.locator('tbody tr').last().innerText(), /150,00/, 'Changing display direction keeps the best representative')
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('maxLoss')
  assert.match(await results.locator('tbody tr').first().innerText(), /200,00/, 'Lowest-risk representative selected')
  await page.screenshot({ path: 'data/private/spread-validation/grouped-stocks.png', fullPage: true })
  assert.equal(posts, scanPostsBeforeInspect, 'Inspecting and sorting never starts a broker scan')
  scan = { ...scan, rows: Array.from({ length: 55 }, (_, i) => ({ ...row, id: 'hood:' + i, maxProfit: i + 1 })) }
  await page.reload()
  await results.getByRole('button', { name: '54 andere spreads voor HOOD bekijken', exact: true }).click()
  assert.equal(await results.locator('tbody tr').count(), 50)
  await page.getByRole('button', { name: 'Volgende', exact: true }).click()
  assert.equal(await results.locator('tbody tr').count(), 4)
  await page.getByRole('button', { name: 'Terug naar aandelen', exact: true }).click()
  assert.equal(await results.locator('tbody tr').count(), 1)
  // Exact SE regression: five candidates become one best row plus four alternatives.
  scan = { ...scan, state: 'complete', rows: [8.81, 4.17, 2.25, 2.04, 2.04].map((ratio, i) => ({ ...row, symbol: 'SE', id: 'se:' + i, returnOnRisk: ratio, maxProfit: [81, 30, 22, 20, 20][i] })) }
  await page.reload()
  const seInspect = results.getByRole('button', { name: '4 andere spreads voor SE bekijken', exact: true })
  await seInspect.waitFor()
  assert.equal(await results.locator('tbody tr').count(), 1)
  assert.match(await results.locator('tbody tr').innerText(), /8,81%/)
  const removeSe = results.getByRole('button', { name: 'Verwijder SE', exact: true })
  assert.equal(await removeSe.getAttribute('class'), 'spreads-remove')
  assert.equal(await removeSe.innerText(), '')
  await page.screenshot({ path: 'data/private/spread-validation/se-best.png', fullPage: true })
  await seInspect.click()
  await page.getByRole('heading', { name: 'Andere spreads voor SE', exact: true }).waitFor()
  assert.equal(await results.locator('tbody tr').count(), 4)
  assert.doesNotMatch(await results.locator('tbody').innerText(), /8,81%/)
  assert.match(await results.locator('tbody tr').first().innerText(), /4,17%/)
  await page.getByLabel('Sorteren op', { exact: true }).selectOption('maxProfit')
  assert.match(await results.locator('tbody tr').first().innerText(), /30,00/)
  await page.screenshot({ path: 'data/private/spread-validation/se-alternatives.png', fullPage: true })
  for (const width of [360, 768, 1024, 1600]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'SE alternatives contain overflow at ' + width)
  }
  await page.getByRole('button', { name: 'Terug naar aandelen', exact: true }).click()
  assert.equal(await results.locator('tbody tr').count(), 1)
  await results.getByRole('button', { name: 'Verwijder SE', exact: true }).click()
  await page.getByRole('region', { name: 'Geblokkeerde Stocks', exact: true }).getByRole('button', { name: 'Deblokkeer SE', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('[aria-label="Bull-put-spreadresultaten"]'))
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
  iv.rows[0] = { ...iv.rows[0], sector: undefined, sectorSource: undefined, sectorAsOf: undefined }
  await page.reload()
  await page.getByRole('region', { name: 'IV-resultaten', exact: true }).getByRole('cell', { name: 'Onbekend', exact: true }).waitFor()
  stockEmpty = true
  await page.getByRole('button', { name: 'Aandelenfilter starten', exact: true }).click()
  await page.getByText('Geen passende aandelen. Pas de criteria aan en start opnieuw.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Optiescan starten', exact: true }).isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('Three-stage scan verified: Stock Filter > IV Scan > Option Scan, standalone IV navigation removed, blocked stocks persist and unblock, weekly schedule persists, dirty/empty/loading guards, stock stop/resume, option amounts, sorting, search, quotes, CSV, persistence, errors, option stop/resume, 360–1600px and 200% zoom; no page errors.')
} finally { await browser.close() }
