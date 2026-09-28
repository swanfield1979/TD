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

test('saldoverandering en percentage volgen het live saldo tegenover de laatste rapportdag', () => {
  const merged = resolvePortfolio(summary, snapshot)
  const html = renderToStaticMarkup(createElement(DailyProfitCard, {
    metric: merged.dailyProfit, balance: merged.balance, currency: summary.currency,
  }))
  assert.equal(merged.dailyProfit.value, 400)
  assert.match(html, /\+36,36%/)
  assert.match(html, /24 sep 2026/)
  assert.match(html, /27 sep 2026/)
  assert.match(html, /Saldoverandering live/)
  assert.match(html, /rapportsaldo/)
})

test('recentere vorige dagmeting krijgt voorrang en blijft vast bij meerdere live updates', () => {
  const live = { ...snapshot, previousBalance: { date: '2026-09-26', value: 1600 } }
  const merged = resolvePortfolio(summary, live)
  assert.equal(merged.dailyProfit.value, -100)
  assert.equal(merged.dailyProfit.fromDate, '2026-09-26')
  assert.equal(resolvePortfolio(summary, { ...live, netLiquidation: 1650 }).dailyProfit.value, 50)
  const html = renderToStaticMarkup(createElement(DailyProfitCard, {
    metric: merged.dailyProfit, balance: merged.balance, currency: merged.currency,
  }))
  assert.match(html, /-6,25%/)
  assert.match(html, /laatste meting/)
})

test('live op dezelfde rapportdag gebruikt de vorige rapportdag; nulbasis krijgt geen fictief percentage', () => {
  const merged = resolvePortfolio(summary, { ...snapshot, asOfDate: summary.balance.toDate })
  assert.equal(merged.dailyProfit.value, 500)
  assert.equal(merged.dailyProfit.fromDate, '2026-09-23')
  const html = renderToStaticMarkup(createElement(DailyProfitCard, {
    metric: { value: 100, toDate: '2026-09-27', direction: 'positive' },
    balance: { value: 100 }, currency: 'USD',
  }))
  assert.doesNotMatch(html, /0,00%/)
  assert.match(html, /—/)
})

test('zonder eerdere dagstand blijft live saldo bruikbaar maar is saldoverandering onbekend', () => {
  const singleDay = { ...summary, dailyProfit: { ...summary.dailyProfit, fromDate: undefined } }
  const merged = resolvePortfolio(singleDay, { ...snapshot, asOfDate: summary.balance.toDate })
  assert.equal(merged.dailyProfit.unavailable, true)
  const html = renderToStaticMarkup(createElement(DailyProfitCard, {
    metric: merged.dailyProfit, balance: merged.balance, currency: merged.currency,
  }))
  assert.match(html, /Vorige dagstand ontbreekt/)
  assert.doesNotMatch(html, /0,00%/)
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

test('Goals toont saldovoortgang ook als rendement negatief is', () => {
  const goalPlan = structuredClone(summary.goalPlan)
  const goal = goalPlan.years.find(row => row.status === 'current')
  Object.assign(goal, { startValue: 82465, targetValue: 119204.50, growthValue: 24739.50 })
  const html = renderToStaticMarkup(createElement(GoalsPage, {
    goalPlan, balance: { ...summary.balance, value: 86097.12 }, currency: 'USD',
    contributionPeriods: [{ year: 2026, net: 7238.53, toDate: '2026-09-25' }],
  }))
  assert.match(html, /72,2%/)
  assert.match(html, /aria-valuenow="72"/)
  assert.match(html, /width:72\./)
  assert.match(html, /-3\.606,41/)
  assert.match(html, /van het jaardoel bereikt/)
})
