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
const { AnnualGoal, MonthDetail, NetMonthlyResults } = await server.ssrLoadModule('/src/DashboardPanels.tsx')
const summary = createPortfolioSummary({
  equityXml: '<EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-09-23" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-09-24" total="1100"/>',
  tradesXml: '', optionXml: '',
})
const snapshot = createLiveSnapshot({
  accountValues: new Map([['NetLiquidation', { value: 1500, currency: 'USD' }]]),
  positions: [{ conid: 42, position: -2, assetCategory: 'OPT', optionRight: 'P', marketValue: -100,
    localSymbol: 'SOFI 261023P00016000', symbol: 'SOFI' }], generatedAt: '2026-09-27T12:00:00Z',
})

test('dashboardjaardoel toont geen verzonnen jaarschema zonder inleg en weigert een oud doel', () => {
  const html = renderToStaticMarkup(createElement(AnnualGoal, { summary }))
  assert.match(html, /inleggegevens ontbreken/)
  assert.doesNotMatch(html, /Voor op jaarschema|Achter op jaarschema/)
  const newYear = { ...summary, balance: { ...summary.balance, toDate: '2027-01-01' } }
  assert.match(renderToStaticMarkup(createElement(AnnualGoal, { summary: newYear })), /vorige jaarafsluiting/)
})

test('maanddetails behouden historische premie en maandgrafiek verzint ontbrekende data niet', () => {
  const html = renderToStaticMarkup(createElement(MonthDetail, {
    label: 'Deze maand', result: summary.currentMonthProfit,
    premium: { ...summary.premiumPeriods.currentMonth, historicalNet: 148 },
    currency: 'USD', premiumCurrency: 'USD',
  }))
  assert.match(html, /Historisch netto/)
  assert.match(html, /148,00/)
  assert.match(html, /Opening ontbreekt/)
  assert.doesNotMatch(html, /Netto premie deze maand/)
  const oldSummary = { ...summary, monthlyTradingResults: undefined }
  assert.match(renderToStaticMarkup(createElement(NetMonthlyResults, { summary: oldSummary })), /Importeer Flex-gegevens opnieuw/)
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
  assert.deepEqual(merged.yearProfit, { ...summary.yearProfit, toDate: snapshot.asOfDate })
})

test('oktobersynchronisatie werkt maand, jaar, premie, grafieken en doelen samen bij', () => {
  const october = {
    ...snapshot,
    generatedAt: '2026-10-05T10:00:00Z',
    asOfDate: '2026-10-05',
    netLiquidation: 1600,
    positions: [],
    executions: [{
      execId: 'option-close.01', account: 'A', conid: '42', dateTime: '2026-10-03T15:00:00', quantity: 2,
      price: 0.2, symbol: 'SOFI', name: 'SOFI PUT', assetCategory: 'OPT', currency: 'USD',
      multiplier: 100, optionRight: 'P', strike: 16, expiry: '20261023', realizedPNL: 78,
    }, {
      execId: 'long-option-close.01', account: 'A', conid: '43', dateTime: '2026-10-03T15:01:00', quantity: -1,
      price: 0.2, symbol: 'SOFI', name: 'SOFI CALL', assetCategory: 'OPT', currency: 'USD',
      multiplier: 100, optionRight: 'C', strike: 16, expiry: '20261023', realizedPNL: -30,
    }, {
      execId: 'stock-sale.01', account: 'A', conid: 'stock', dateTime: '2026-10-04T15:00:00', quantity: -10,
      price: 20, symbol: 'TEST', name: 'TEST', assetCategory: 'STK', currency: 'USD',
      multiplier: 1, optionRight: null, strike: null, expiry: null, realizedPNL: 50,
    }],
  }
  const merged = resolvePortfolio(summary, october)

  assert.equal(merged.currentMonthProfit.toDate, '2026-10-05')
  assert.equal(merged.currentMonthProfit.premium, 78)
  assert.equal(merged.currentMonthProfit.longOptions, -30)
  assert.equal(merged.currentMonthProfit.stockSales, 50)
  assert.equal(merged.currentMonthProfit.value, 98)
  assert.equal(merged.previousMonthProfit.toDate, summary.currentMonthProfit.toDate)
  assert.equal(merged.yearProfit.value, summary.yearProfit.value + 98)
  assert.equal(merged.averageMonthlyProfit.monthCount, 10)
  assert.equal(merged.monthlyTradingResults.at(-1).month, '2026-10')
  assert.equal(merged.premiumPeriods.currentMonth.month, '2026-10')
  assert.equal(merged.premiumPeriods.currentMonth.liveNet, 78)
  assert.equal(merged.portfolioHistory.at(-1).month, '2026-10')
  assert.equal(merged.monthlyBalanceChanges[9].balance, 1600)
  assert.equal(merged.goalPlan.years.find((goal) => goal.status === 'current').resultDate, '2026-10-05')

  const currentHtml = renderToStaticMarkup(createElement(MonthDetail, {
    label: 'Deze maand', result: merged.currentMonthProfit, premium: merged.premiumPeriods.currentMonth,
    currency: 'USD', premiumCurrency: 'USD',
  }))
  assert.match(currentHtml, /oktober 2026/)
  assert.match(currentHtml, /Gateway netto/)
})

test('Gateway-sluitingen verschijnen in de portefeuille zonder dubbele regels na verversen', () => {
  const current = { ...snapshot, asOfDate: '2026-09-30', positions: [], executions: [{
    execId: 'roll.01', account: 'A', conid: '42', dateTime: '2026-09-30T15:00:00', quantity: 2,
    price: 0.2, symbol: 'SOFI', name: 'SOFI PUT', assetCategory: 'OPT', currency: 'USD',
    multiplier: 100, optionRight: 'P', strike: 17, expiry: '20261002', realizedPNL: 78,
  }] }
  const merged = resolvePortfolio(summary, current)
  assert.equal(merged.closedTrades.length, summary.closedTrades.length + 1)
  assert.equal(merged.closedTrades[0].profit, 78)
  assert.equal(merged.tradingActivity.closedTrades, 1)
  assert.deepEqual(resolvePortfolio(summary, current), merged)
  const imported = { ...summary, tradesThroughDate: '2026-09-30', closedTrades: merged.closedTrades }
  assert.equal(resolvePortfolio(imported, current).closedTrades.length, 1)
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
