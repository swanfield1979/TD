import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeOptionEvents, realizedResults, premiumSummary, tradingResult } from '../scripts/realized-results.mjs'
import { createPortfolioSummary } from '../scripts/flex-parser.mjs'

const trade = (conid, date, quantity, price, openClose, extra = {}) => ({
  assetCategory: 'OPT', conid, underlyingSymbol: 'TEST', putCall: 'C', strike: '20',
  dateTime: `${date} 12:00:00`, quantity, tradePrice: price, openCloseIndicator: openClose,
  ibCommission: -1, ...extra,
})
const results = (trades, events = []) => realizedResults(mergeOptionEvents(trades, events))

test('EAE-aandelenlevering is beschikbaar voor verkoop op dezelfde dag, zonder fantoompositie', () => {
  const sale = trade('stock', '2026-02-06', -100, 25, 'C', { assetCategory: 'STK', fifoPnlRealized: 499 })
  const delivery = { conid: 'stock', underlyingSymbol: 'TEST', assetCategory: 'STK', date: '2026-02-06',
    quantity: 100, tradePrice: 20, transactionType: 'Buy' }
  const merged = mergeOptionEvents([sale], [delivery])
  assert.equal(merged[0].dateTime, '2026-02-06')
  assert.equal(tradingResult(realizedResults(merged), '2026-02').stockSales, 499)
  const xml = (tag, row) => `<${tag} ${Object.entries(row).map(([key, value]) => `${key}="${value}"`).join(' ')}/>`
  const summary = createPortfolioSummary({
    equityXml: '<EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-02-06" total="1499"/>',
    tradesXml: xml('Trade', sale), optionXml: xml('OptionEAE', delivery),
  })
  assert.equal(summary.stockHoldings.length, 0)
  assert.equal(summary.currentMonthProfit.stockSales, 499)
})

test('echte sluiting en heropening dezelfde dag behouden de volgorde naast datumloze expiraties', () => {
  const merged = mergeOptionEvents([
    trade('x', '2026-02-05', -1, 2, 'O'),
    trade('x', '2026-02-06', 1, 1, 'C', { dateTime: '2026-02-06 09:00:00' }),
    trade('x', '2026-02-06', -1, 3, 'O', { dateTime: '2026-02-06 14:00:00' }),
  ], [{ conid: 'x', assetCategory: 'OPT', date: '2026-02-06', quantity: 1, tradePrice: 0, transactionType: 'Expiration' }])
  assert.deepEqual(realizedResults(merged).map((row) => row.profit), [98, 299])
})

test('boekt een decemberopening pas bij sluiten in januari, inclusief beide commissies', () => {
  const ledger = results([trade('csp', '2025-12-31', -1, 3, 'O'), trade('csp', '2026-01-05', 1, 1, 'C')])
  assert.equal(tradingResult(ledger, '2025-12').value, 0)
  assert.deepEqual(premiumSummary(ledger), { received: 300, buyback: 100, commission: 2, net: 198 })
  assert.equal(tradingResult(ledger, '2026-01').value, 198)
  assert.equal(tradingResult(ledger, '2026').value, 198)
})

test('een optie geopend op 31 januari telt pas mee bij sluiten op 5 februari', () => {
  const ledger = results([trade('csp', '2026-01-31', -1, 2, 'O'), trade('csp', '2026-02-05', 1, 0.5, 'C')])
  assert.equal(tradingResult(ledger, '2026-01').value, 0)
  assert.equal(tradingResult(ledger, '2026-02').premium, 148)
})

test('open short opties, long calls en aandelen hebben geen gerealiseerd resultaat', () => {
  const ledger = results([trade('short', '2026-01-01', -2, 5, 'O'), trade('long', '2026-01-01', 1, 10, 'O'),
    trade('stock', '2026-01-01', 100, 20, 'O', { assetCategory: 'STK' })])
  assert.equal(ledger.length, 0)
  assert.equal(tradingResult(ledger, '2026-01').value, 0)
})

test('deels sluiten verdeelt openingspremie en kosten FIFO over de sluitingsmaanden', () => {
  const ledger = results([trade('x', '2026-01-01', -2, 3, 'O', { ibCommission: -2 }),
    trade('x', '2026-02-01', 1, 1, 'C'), trade('x', '2026-03-01', 1, 4, 'C')])
  assert.equal(tradingResult(ledger, '2026-01').value, 0)
  assert.equal(tradingResult(ledger, '2026-02').premium, 198)
  assert.equal(tradingResult(ledger, '2026-03').premium, -102)
  assert.equal(tradingResult(ledger, '2026').value, 96)
})

test('gekochte calls blijven in het register maar tellen niet mee in nettoresultaat', () => {
  const ledger = results([trade('long', '2026-01-01', 1, 5, 'O'), trade('long', '2026-02-01', -1, 8, 'C')])
  assert.deepEqual(tradingResult(ledger, '2026-02'), { premium: 0, stockSales: 0, value: 0 })
  assert.equal(premiumSummary(ledger).net, 0)
})

test('aandelen en covered-call ETFs gebruiken alleen verkochte FIFO-aanschafwaarde', () => {
  const ledger = results([trade('spcx', '2026-01-01', 100, 20, 'O', { assetCategory: 'STK', ibCommission: -2 }),
    trade('spcx', '2026-02-01', -40, 25, 'C', { assetCategory: 'STK' }),
    trade('spcx', '2026-03-01', -60, 18, 'C', { assetCategory: 'STK' })])
  assert.equal(tradingResult(ledger, '2026-01').value, 0)
  assert.equal(tradingResult(ledger, '2026-02').stockSales, 198.2)
  assert.equal(tradingResult(ledger, '2026-03').stockSales, -122.2)
})

test('CC-assignment telt premie en aandelenwinst eenmaal, ongeacht IBKR doorgeschoven premie', () => {
  const trades = [trade('stock', '2026-01-01', 100, 15, 'O', { assetCategory: 'STK' }),
    trade('cc', '2026-01-02', -1, 2, 'O'), trade('cc', '2026-02-01', 1, 0, 'C', { ibCommission: 0 }),
    trade('stock', '2026-02-01', -100, 20, 'C', { assetCategory: 'STK', fifoPnlRealized: 697 })]
  const events = [{ ...trades[2], date: '2026-02-01', transactionType: 'Assignment', tradeID: 'assignment' }]
  const ledger = results(trades, events)
  assert.equal(tradingResult(ledger, '2026-02').premium, 199)
  assert.equal(tradingResult(ledger, '2026-02').stockSales, 498)
  assert.equal(tradingResult(ledger, '2026-02').value, 697)
})

test('CSP-assignment realiseert premie en aankoop aandelen kost op dat moment geen resultaat', () => {
  const trades = [trade('csp', '2026-01-01', -1, 3, 'O', { putCall: 'P' }),
    trade('csp', '2026-02-01', 1, 0, 'C', { putCall: 'P', ibCommission: 0 }),
    trade('stock', '2026-02-01', 100, 20, 'O', { assetCategory: 'STK' }),
    trade('stock', '2026-03-01', -100, 22, 'C', { assetCategory: 'STK', fifoPnlRealized: 497 })]
  const ledger = results(trades)
  assert.equal(tradingResult(ledger, '2026-02').value, 299)
  assert.equal(tradingResult(ledger, '2026-03').value, 198)
})

test('expiratie uit OptionEAE sluit af, overlappende rapporten en split executions tellen eenmaal', () => {
  const open = trade('x', '2026-01-01', -2, 3, 'O', { ibCommission: -2 })
  const event = { ...trade('x', '2026-02-01', 2, 0, 'C', { ibCommission: 0 }), date: '2026-02-01', transactionType: 'Expiration', tradeID: 'expiry' }
  const fromEvents = results([open], [event, event])
  assert.equal(tradingResult(fromEvents, '2026-02').premium, 598)
  const fromBoth = results([open, trade('x', '2026-02-01', 1, 0, 'C', { ibCommission: 0 }),
    trade('x', '2026-02-01', 1, 0, 'C', { ibCommission: 0 })], [event, event])
  assert.equal(tradingResult(fromBoth, '2026-02').premium, 598)
})

test('een verlopen long call realiseert de aanschafkosten als verlies', () => {
  const ledger = results([trade('x', '2026-01-01', 1, 3, 'O')],
    [{ conid: 'x', assetCategory: 'OPT', date: '2026-02-01', quantity: -1, tradePrice: 0, transactionType: 'Expiration' }])
  assert.equal(ledger[0].profit, -301)
  assert.equal(tradingResult(ledger, '2026-02').value, 0)
})

test('ontbrekende opening gebruikt IBKR-nettoresultaat zonder nogmaals commissie af te trekken', () => {
  const ledger = results([trade('x', '2026-02-01', 1, 1, 'C', { fifoPnlRealized: 148 })])
  assert.equal(premiumSummary(ledger).net, 148)
  assert.equal(premiumSummary(ledger).historicalNet, 148)
  assert.equal(ledger[0].openedAt, null)
})

test('ontbrekende kostprijs zonder bruikbaar nettoresultaat wordt niet als nulwinst gepubliceerd', () => {
  assert.throws(() => results([trade('x', '2026-02-01', 1, 1, 'C')]), /Onvoldoende openingshistorie/)
  assert.throws(() => results([trade('x', '2026-01-01', -1, 2, 'O'),
    trade('x', '2026-02-01', 2, 1, 'C', { fifoPnlRealized: 100 })]), /Onvoldoende openingshistorie/)
})

test('rolls en heropeningen laten nieuwe premie open en gebruiken de juiste FIFO-lots', () => {
  const ledger = results([trade('x', '2026-01-01', -1, 2, 'O'), trade('x', '2026-01-02', -1, 4, 'O'),
    trade('x', '2026-02-01', 1, 1, 'C'), trade('x', '2026-03-01', 1, 1, 'C'),
    trade('x', '2026-03-02', -1, 9, 'O'), trade('roll', '2026-03-01', -1, 6, 'O')])
  assert.equal(tradingResult(ledger, '2026-02').value, 98)
  assert.equal(tradingResult(ledger, '2026-03').value, 298)
})

test('uitoefenen van een gekochte call schuift aanschafkosten door tot aandelenverkoop', () => {
  const trades = [trade('call', '2026-01-01', 1, 3, 'O'), trade('call', '2026-02-01', -1, 0, 'C', { ibCommission: 0 }),
    trade('stock', '2026-02-01', 100, 20, 'O', { assetCategory: 'STK' }),
    trade('stock', '2026-03-01', -100, 25, 'C', { assetCategory: 'STK' })]
  const ledger = results(trades, [{ ...trades[1], date: '2026-02-01', transactionType: 'Exercise' }])
  assert.equal(tradingResult(ledger, '2026-02').value, 0)
  assert.equal(tradingResult(ledger, '2026-03').stockSales, 197)
})

test('dashboard gebruikt dezelfde afsluitmaand en peildatum voor maand, jaar, premie en trades', () => {
  const trades = [trade('x', '2026-01-31', -1, 3, 'O'), trade('x', '2026-02-05', 1, 1, 'C'),
    trade('future', '2026-02-21', -1, 9, 'O'), trade('future', '2026-02-22', 1, 0, 'C')]
  const summary = createPortfolioSummary({ equityXml: '<EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1300"/><EquitySummaryByReportDateInBase reportDate="2026-02-20" total="5000"/>',
    tradesXml: trades.map((trade) => `<Trade ${Object.entries(trade).map(([key, value]) => `${key}="${value}"`).join(' ')}/>`).join(''), optionXml: '' })
  assert.equal(summary.previousMonthProfit.value, 0)
  assert.equal(summary.currentMonthProfit.value, 198)
  assert.equal(summary.yearProfit.value, 198)
  assert.equal(summary.averageMonthlyProfit.value, 99)
  assert.equal(summary.premiumPeriods.currentMonth.net, 198)
  assert.equal(summary.closedTrades.length, 1)
  assert.equal(summary.closedTrades[0].profit, 198)
  assert.deepEqual(summary.monthlyTradingResults.map(({ month, value, toDate }) => ({ month, value, toDate })), [
    { month: '2026-01', value: 0, toDate: '2026-01-31' },
    { month: '2026-02', value: 198, toDate: '2026-02-20' },
  ])
  assert.equal(summary.monthlyTradingResults.reduce((total, row) => total + row.value, 0), summary.yearProfit.value)
})


test('maand en jaar sluiten zowel winst als verlies van gekochte opties uit', () => {
  const ledger = results([trade('short', '2026-01-01', -1, 3, 'O'), trade('short', '2026-02-01', 1, 1, 'C'),
    trade('long-win', '2026-01-01', 1, 2, 'O'), trade('long-win', '2026-02-01', -1, 5, 'C'),
    trade('long-loss', '2026-01-01', 1, 5, 'O'), trade('long-loss', '2026-03-01', -1, 1, 'C')])
  assert.equal(tradingResult(ledger, '2026-02').value, 198)
  assert.equal(tradingResult(ledger, '2026-03').value, 0)
  assert.equal(tradingResult(ledger, '2026').value, 198)
})
