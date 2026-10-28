import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'

const url = process.env.LAYOUT_URL || 'http://127.0.0.1:5197'
const output = 'data/private/option-groups-validation'
const baseline = JSON.parse(await readFile('public/data/portfolio-summary.json', 'utf8'))
const leg = (conid, overrides = {}) => ({ conid, symbol: 'SMCI', name: conid, quantity: -1,
  optionRight: 'P', strike: 25, expiry: '2027-01-15', openedAt: '2026-10-26', chosenDte: 81,
  averageOpenPrice: 1.21, currentPrice: .92, currentValue: -92, difference: 28.98, differencePercentage: 24,
  strategy: 'SHORT_PUT', ...overrides })
const holdings = [
  leg('SMCI-short'), leg('SMCI-long', { quantity: 1, strike: 20, averageOpenPrice: .43, currentPrice: .31, currentValue: 31.32, difference: -11.73, strategy: 'LONG_PUT' }),
  leg('SYN-call', { symbol: 'SYN', optionRight: 'C', quantity: 2, strike: 50, averageOpenPrice: 3, currentPrice: 4, currentValue: 800, difference: 200, strategy: 'SYNT_LONG' }),
  leg('SYN-put', { symbol: 'SYN', quantity: -2, strike: 50, openedAt: '2026-10-20', chosenDte: 87, averageOpenPrice: 2, currentPrice: 1, currentValue: -200, difference: 200, strategy: 'SYNT_LONG' }),
  leg('SOLO-put', { symbol: 'SOLO', quantity: 1, strike: 10, strategy: 'LONG_PUT', currentValue: 20, difference: -10 }),
]
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ state: 'offline', message: 'Testgegevens', isBusy: false }) }))
await page.route('**/data/portfolio-summary.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...baseline, optionHoldings: holdings, balance: { ...baseline.balance, toDate: '2026-10-28' } }) }))
await mkdir(output, { recursive: true })
try {
  await page.goto(`${url}/#options`)
  const spread = page.getByRole('button', { name: /^Put Spread SMCI,/ })
  const synt = page.getByRole('button', { name: /^SYNT long SYN,/ })
  await spread.waitFor()
  const visibleRows = () => page.locator('.options-table tbody tr:visible').count()
  assert.equal(await visibleRows(), 3)
  const spreadRow = page.locator('tr').filter({ has: spread })
  assert.match(await spreadRow.textContent(), /Week 44/)
  assert.match(await spreadRow.textContent(), /20,00/)
  assert.match(await spreadRow.textContent(), /25,00/)
  assert.match(await spreadRow.textContent(), /0,78/)
  assert.match(await spreadRow.textContent(), /17,25/)
  const totalBefore = await page.locator('.options-table tfoot').textContent()
  await spread.focus(); await page.keyboard.press('Enter')
  assert.equal(await spread.getAttribute('aria-expanded'), 'true')
  assert.equal(await visibleRows(), 5)
  assert.equal(await page.locator('.options-table__row--leg:visible').count(), 2)
  await synt.click()
  assert.equal(await visibleRows(), 7)
  assert.match(await page.locator('tr').filter({ has: synt }).textContent(), /Week 43/)
  assert.match(await page.locator('tr').filter({ has: synt }).textContent(), /Week 44/)
  assert.equal(await page.locator('.options-table tfoot').textContent(), totalBefore)
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 1440, height: 1000 })
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Donkere modus/ }).click()
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.screenshot({ path: `${output}/options-${theme}-${width}.png`, fullPage: true })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}/${width}: overflow`)
    }
  }
  await spread.focus(); await page.keyboard.press('Space')
  assert.equal(await spread.getAttribute('aria-expanded'), 'false')
  assert.equal(await visibleRows(), 5)
  await synt.click()
  assert.equal(await visibleRows(), 3)
  assert.deepEqual(errors, [])
  console.log('Options verified: put spread/SYNT collapsed once, two legs on expansion, keyboard controls, distinct opening weeks, net summary values and unchanged footer totals; both themes at 375/768/1440px; no page errors.')
} finally { await browser.close() }
