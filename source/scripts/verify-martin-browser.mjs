import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  let posts = 0, unavailable = false
  const base = { symbol: 'IONQ', date: '2026-10-15', close: 34, status: 'VOLGEN', adr: 6.5, dollarVolume: 200e6, dayReturn: 9, monthReturn: 15, premier: true, insideDay: true, tight: true, trigger: 35, stopReference: 32, stopPct: 8, maxStopPct: 3.25, reasons: ['Stopreferentie te breed; intraday opnieuw beoordelen'], premarket: { status: 'ONTBREEKT' } }
  const other = { ...base, symbol: 'AMD', adr: 5.5, monthReturn: 20, dayReturn: 1 }
  const report = { generatedAt: '2026-10-16T12:00:00Z', requested: 3, analyzed: 2, rows: [base, other], lists: { focus: [], potent: [base, other], leaders: [other, base], premarket: [], themes: [] }, failures: [{ symbol: 'INVALID', error: 'Geen USD-aandeel of ontbrekende data' }] }
  let state = { state: 'idle', symbols: ['IONQ', 'AMD'], checked: 0, total: 0, report: null }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/martin-scan') {
      if (unavailable) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Marktdata niet bereikbaar; probeer opnieuw.' }) })
      if (route.request().method() === 'POST') {
        posts++; assert.equal(route.request().headers()['x-requested-with'], 'trading-monitor')
        assert.equal(route.request().postDataJSON().symbols, 'IONQ, AMD')
        state = { ...state, state: 'running', checked: 1, total: 2 }
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) })
    }
    return route.fulfill({ status: path === '/api/ibkr/status' ? 200 : 404, contentType: 'application/json', body: JSON.stringify({ state: 'offline', message: 'Testverbinding', isBusy: false }) })
  })
  const url = process.env.MARTIN_URL || 'http://127.0.0.1:5198'
  await page.goto(`${url}/#martin`)
  await page.getByRole('heading', { name: 'Martin-scan', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Scan starten', exact: true }).waitFor()
  await page.getByLabel('Aandelen om te scannen').fill('')
  assert.ok(await page.getByRole('button', { name: 'Scan starten', exact: true }).isDisabled())
  await page.getByLabel('Aandelen om te scannen').fill('IONQ, AMD')
  await page.getByRole('button', { name: 'Scan starten', exact: true }).click()
  await page.getByRole('progressbar', { name: 'Voortgang Martin-scan' }).waitFor()
  assert.equal(posts, 1)
  assert.ok(await page.getByRole('button', { name: 'Scan bezig…' }).isDisabled())
  await page.getByRole('link', { name: 'Stocks', exact: true }).click()
  state = { ...state, state: 'partial', report, message: 'Scan afgerond met ontbrekende data.', restored: true }
  await page.getByRole('link', { name: 'Martin-scan', exact: true }).click()
  await page.getByText('Geen aandelen voldoen aan alle focuscriteria.', { exact: false }).waitFor()
  await page.getByText('INVALID: Geen USD-aandeel', { exact: false }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Dashboarddata ontbreekt' }).count(), 0)
  await page.getByRole('combobox', { name: 'Watchlist', exact: true }).selectOption('potent')
  assert.equal(await page.locator('tbody tr').count(), 2)
  await page.getByRole('button', { name: 'Maand %', exact: false }).click()
  assert.equal(await page.locator('tbody th').first().innerText(), 'AMD\n2026-10-15 · Premier')
  await page.getByLabel('Ticker zoeken', { exact: true }).fill('ZZZ')
  await page.getByText('Geen resultaten voor deze ticker.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Zoekfilter wissen' }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'TradingView downloaden' }).click()
  assert.equal((await downloadEvent).suggestedFilename(), 'martin-potent-tradingview.txt')
  await mkdir('data/private/martin-ui-validation', { recursive: true })
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Geen horizontale pagina-overloop bij ${width}`)
    await page.screenshot({ path: `data/private/martin-ui-validation/martin-${width}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 720, height: 500 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '200% zoom-equivalent')
  await page.setViewportSize({ width: 360, height: 1000 })
  await page.getByRole('button', { name: 'Menu openen', exact: true }).click()
  await page.getByRole('link', { name: 'Martin-scan', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  unavailable = true
  await page.reload()
  await page.getByText('Marktdata niet bereikbaar; probeer opnieuw.', { exact: true }).waitFor()
  unavailable = false
  await page.getByRole('button', { name: 'Opnieuw proberen', exact: true }).click()
  await page.getByRole('combobox', { name: 'Watchlist', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Martin-browsercontrole geslaagd: menu, start, voortgang, navigatie, opslag, lege/partiële resultaten, filters, sortering, export, fout/herstel en 360–1440px.')
} finally { await browser.close() }
