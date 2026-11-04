import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createPortfolioSummary } from './flex-parser.mjs'
const summary = createPortfolioSummary({ equityXml: '<EquitySummaryByReportDateInBase reportDate="2024-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-10-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-11-04" total="1100"/>', tradesXml: '', optionXml: '' })
summary.annualTradingResults[0] = { ...summary.annualTradingResults[0], value: 1200, premium: 1000, longOptions: 150, stockSales: 50, direction: 'positive', premiumDetails: { month: '2026-', received: 4000, buyback: 2900, commission: 100, net: 1000 } }
summary.annualTradingResults[1] = { ...summary.annualTradingResults[1], value: -250, premium: -400, longOptions: 100, stockSales: 50, direction: 'negative', premiumDetails: { month: '2025-', received: 1000, buyback: 1300, commission: 100, net: -400 } }
summary.averageMonthlyProfit.value = 109.09
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', route => route.fulfill({ json: { state: 'offline', isBusy: false } }))
await page.route('**/data/portfolio-summary.json*', route => route.fulfill({ json: summary }))
await mkdir('data/private/year-details-validation', { recursive: true })
try {
 await page.goto('http://127.0.0.1:5197/#dashboard')
 await page.getByRole('heading', { name: 'Dit jaar · 2026', exact: true }).waitFor()
 await page.getByRole('heading', { name: 'Vorig jaar · 2025', exact: true }).waitFor()
 const cards = page.locator('.month-detail')
 assert.equal(await cards.count(), 2)
 assert.match(await cards.nth(0).textContent(), /1\.200,00/)
 assert.match(await cards.nth(1).textContent(), /250,00/)
 assert.match(await cards.nth(0).textContent(), /4\.000,00/)
 assert.match(await page.locator('.activity-grid').textContent(), /109,09/)
 assert.equal(await page.getByText(/Deze maand|Vorige maand/).count(), 0)
 for (const theme of ['dark', 'light']) {
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Donkere modus/ }).click()
  for (const width of [375, 1440]) {
   await page.setViewportSize({ width, height: 1000 })
   await cards.first().scrollIntoViewIfNeeded()
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
   await page.screenshot({ path: `data/private/year-details-validation/${theme}-${width}.png`, fullPage: true })
  }
 }
 assert.deepEqual(errors, [])
 console.log('Year details verified: 2026/2025 totals, premium details, unchanged monthly average, light/dark at 375/1440px; no overflow or page errors.')
} finally { await browser.close() }
