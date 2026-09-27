import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createPortfolioSummary } from '../scripts/flex-parser.mjs'
import { createLiveSnapshot } from '../server/ibkr-domain.mjs'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { resolvePortfolio } = await server.ssrLoadModule('/src/ibkr.ts')
const { default: GoalsPage } = await server.ssrLoadModule('/src/GoalsPage.tsx')
const { DailyProfitCard } = await server.ssrLoadModule('/src/App.tsx')
const summary = createPortfolioSummary({
  equityXml: '<EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-09-23" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-09-24" total="1100"/>',
  tradesXml: '', optionXml: '',
})
const snapshot = createLiveSnapshot({
  accountValues: new Map([['NetLiquidation', { value: 1500, currency: 'USD' }]]),
  positions: [{ conid: 42, position: -2, assetCategory: 'OPT', optionRight: 'P', marketValue: -100,
    localSymbol: 'SOFI 261023P00016000', symbol: 'SOFI' }], generatedAt: '2026-09-27T12:00:00Z',
})

test('snapshot voor of na Flex en opnieuw laden behouden dezelfde actuele portefeuille', () => {
  assert.equal(resolvePortfolio(null, snapshot), null)
  assert.equal(resolvePortfolio(summary, null), summary)
  const merged = resolvePortfolio(summary, snapshot)
  const reloaded = resolvePortfolio(structuredClone(summary), snapshot)
  assert.deepEqual(reloaded, merged)
  assert.equal(merged.balance.value, 1500)
  assert.equal(merged.tradingActivity.openTrades, 1)
  assert.equal(merged.tradingActivity.totalTrades, merged.tradingActivity.closedTrades + 1)
  assert.equal(merged.optionHoldings[0].expiry, '2026-10-23')
  assert.equal(merged.optionHoldings[0].chosenDte, null)
  assert.equal(merged.portfolioAllocation.categories[1].value, 3100)
  assert.equal(merged.portfolioAllocation.categories.reduce((sum, row) => sum + row.value, 0), 1500)
  assert.deepEqual(merged.yearProfit, summary.yearProfit)
})

test('oudere of anders gewaardeerde snapshots vervangen de Flex-portefeuille niet', () => {
  assert.equal(resolvePortfolio(summary, { ...snapshot, asOfDate: '2026-09-20' }), summary)
  assert.equal(resolvePortfolio(summary, { ...snapshot, currency: 'EUR' }), summary)
})

test('oude snapshotbestanden met dubbele posities tellen alleen de laatste contractstand', () => {
  const duplicate = { ...snapshot, positions: [...snapshot.positions, { ...snapshot.positions[0], quantity: 0 }] }
  const merged = resolvePortfolio(summary, duplicate)
  assert.equal(merged.optionHoldings.length, 0)
  assert.equal(merged.tradingActivity.openTrades, 0)
})

test('dagpercentage blijft bij het oorspronkelijke rapport en verandert niet met live saldo', () => {
  const merged = resolvePortfolio(summary, snapshot)
  const html = renderToStaticMarkup(createElement(DailyProfitCard, {
    metric: merged.dailyProfit, balance: summary.balance, currency: summary.currency,
  }))
  assert.match(html, /\+10,00%/)
  assert.match(html, /24 sep 2026/)
  assert.match(html, /Saldoverandering rapportdag/)
})

test('Goals weigert een nieuwjaarsaldo te combineren met de planning van vorig jaar', () => {
  const html = renderToStaticMarkup(createElement(GoalsPage, {
    goalPlan: summary.goalPlan, balance: { ...summary.balance, toDate: '2027-01-02', value: 2500 },
    currency: 'USD', contributionPeriods: [],
  }))
  assert.match(html, /Jaardoel bijwerken/)
  assert.match(html, /Flex-jaarafsluiting/)
  assert.doesNotMatch(html, /Winst \/ rendement behaald/)
})
