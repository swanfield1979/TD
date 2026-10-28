import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
// Browser integration uses generated local data; screenshots remain private.
const url = process.env.LAYOUT_URL || 'http://127.0.0.1:5197'
const output = 'data/private/stats-validation'
const baseline = JSON.parse(await readFile('public/data/portfolio-summary.json', 'utf8'))
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1080 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ state: 'offline', message: 'Test zonder live broker', isBusy: false }) }))
await mkdir(output, { recursive: true })
try {
  await page.goto(`${url}/#stats`)
  await page.getByRole('heading', { name: 'Cumulatief nettoresultaat', exact: true }).waitFor()
  assert.ok(await page.locator('.stats-symbols-table tbody tr').count() > 0)
  assert.equal(await page.getByRole('heading', { name: /Open holdings|Open trades/i }).count(), 0)
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 1440, height: 1080 })
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Donkere modus/ }).click()
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1080 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}/${width}: overflow`)
      await page.screenshot({ path: `${output}/stats-${theme}-${width}.png`, fullPage: true })
    }
  }
  const search = page.getByRole('searchbox', { name: 'Zoek aandeel' })
  await search.fill('zzzz-unmatched')
  await page.getByRole('status').filter({ hasText: 'Geen aandelen gevonden' }).waitFor()
  await search.fill('')
  const original = await page.locator('.stats-symbols-table tbody tr th').first().textContent()
  await page.getByRole('button', { name: 'Aandeel', exact: false }).filter({ hasText: 'Aandeel' }).click()
  assert.equal(await page.locator('.stats-symbols-table thead th').first().getAttribute('aria-sort'), 'ascending')
  const symbols = await page.locator('.stats-symbols-table tbody th').allTextContents()
  assert.deepEqual(symbols, [...symbols].sort((a, b) => a.localeCompare(b)))
  await search.fill(original.trim())
  assert.ok(await page.locator('.stats-symbols-table tbody tr').count() > 0)
  await search.fill('')
  await page.getByText('Dagresultaten bekijken', { exact: true }).focus()
  await page.keyboard.press('Enter')
  assert.ok(await page.locator('.realized-chart details').getAttribute('open') !== null)
  const years = page.getByRole('group', { name: 'Kies een analysejaar', exact: true }).getByRole('button')
  for (let index = 0; index < await years.count(); index++) {
    const year = await years.nth(index).textContent()
    await years.nth(index).click()
    const expected = (baseline.closedTrades ?? []).filter(trade => trade.closedAt.startsWith(year))
    assert.equal(await page.locator('.stats-kpi-grid article').first().locator('strong').textContent(), String(expected.length))
    assert.equal(await page.locator('.stats-symbols-table tbody tr').count(), new Set(expected.map(trade => trade.symbol)).size)
  }
  await page.route('**/data/portfolio-summary.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...baseline, closedTrades: [], portfolioHistory: [] }) }))
  await page.reload()
  await page.getByText('Nog geen afgesloten optietrades in deze periode.', { exact: true }).waitFor()
  assert.equal(await page.locator('.stats-symbols-table tbody tr').count(), 0)
  assert.deepEqual(errors, [])
  console.log('Stats verified: both themes at 375/768/1440px; no overflow, sorting, search, keyboard details, year filtering and empty history; no page errors.')
} finally { await browser.close() }
