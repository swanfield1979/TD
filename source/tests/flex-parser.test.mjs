import assert from 'node:assert/strict'
import test from 'node:test'
import { createPortfolioSummary, extractTags, parseAttributes } from '../scripts/flex-parser.mjs'

test('leest XML-attributen en entities', () => {
  assert.deepEqual(parseAttributes(' symbol="A&amp;B" total="12.50"'), { symbol: 'A&B', total: '12.50' })
})

test('haalt zelfsluitende tags uit een Flex-rapport', () => {
  assert.equal(extractTags('<Root><Trade value="1"/><Trade value="2" /></Root>', 'Trade').length, 2)
})

test('berekent dashboardstatistieken uit dagsaldi', () => {
  const equityXml = `<FlexQueryResponse><FlexStatement whenGenerated="2026-03-20 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2024-12-31" total="900" />
    <EquitySummaryByReportDateInBase reportDate="2025-01-31" total="950" />
    <EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000" />
    <EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1100" />
    <EquitySummaryByReportDateInBase reportDate="2026-02-28" total="1050" />
    <EquitySummaryByReportDateInBase reportDate="2026-03-20" total="1200" />
  </FlexStatement></FlexQueryResponse>`
  const result = createPortfolioSummary({
    equityXml,
    tradesXml: '<Trades><Trade/><Trade/></Trades>',
    optionXml: '<Options><OptionEAE/></Options>',
    generatedAt: '2026-03-20T10:00:00.000Z',
  })

  assert.equal(result.balance.value, 1200)
  assert.deepEqual(result.startingBalance, { value: 900, date: '2024-12-31' })
  assert.equal(result.dailyProfit.value, 150)
  assert.equal(result.yearProfit.value, 0)
  assert.deepEqual(result.currentMonthProfit, {
    value: 0,
    fromDate: '2026-02-28',
    toDate: '2026-03-20',
    direction: 'neutral',
    premium: 0,
    longOptions: 0,
    stockSales: 0,
  })
  assert.deepEqual(result.previousMonthProfit, {
    value: 0,
    fromDate: '2026-01-31',
    toDate: '2026-02-28',
    direction: 'neutral',
    premium: 0,
    longOptions: 0,
    stockSales: 0,
  })
  assert.equal(result.averageMonthlyProfit.value, 0)
  assert.equal(result.sourceCounts.trades, 2)
  assert.deepEqual(
    result.monthlyBalanceChanges.slice(0, 4).map(({ month, value, balance }) => ({ month, value, balance })),
    [
      { month: '2026-01', value: 100, balance: 1100 },
      { month: '2026-02', value: -50, balance: 1050 },
      { month: '2026-03', value: 150, balance: 1200 },
      { month: '2026-04', value: null, balance: null },
    ],
  )
  assert.equal(result.monthlyBalanceChanges.length, 12)
  assert.deepEqual(result.portfolioHistory, [
    { month: '2024-12', date: '2024-12-31', balance: 900 },
    { month: '2025-01', date: '2025-01-31', balance: 950 },
    { month: '2025-12', date: '2025-12-31', balance: 1000 },
    { month: '2026-01', date: '2026-01-31', balance: 1100 },
    { month: '2026-02', date: '2026-02-28', balance: 1050 },
    { month: '2026-03', date: '2026-03-20', balance: 1200 },
  ])
  assert.deepEqual(
    result.previousYearMonthlyBalanceChanges.map(({ month, value }) => ({ month, value })),
    [
      { month: '2025-01', value: 50 },
      { month: '2025-02', value: null },
      { month: '2025-03', value: null },
      { month: '2025-04', value: null },
      { month: '2025-05', value: null },
      { month: '2025-06', value: null },
      { month: '2025-07', value: null },
      { month: '2025-08', value: null },
      { month: '2025-09', value: null },
      { month: '2025-10', value: null },
      { month: '2025-11', value: null },
      { month: '2025-12', value: 50 },
    ],
  )
  assert.deepEqual(result.portfolioAllocation.categories, [
    { key: 'stocks', label: 'Aandelen', value: 0, percentage: 0 },
    { key: 'options', label: 'Opties', value: 0, percentage: 0 },
    { key: 'cash', label: 'Geld / overig', value: 1200, percentage: 100 },
  ])
  assert.deepEqual(result.goalPlan, {
    baseYear: 2025,
    baseYearEndDate: '2025-12-31',
    baseYearEndValue: 1000,
    annualGrowthPercentage: 30,
    annualContribution: 12000,
    years: [
      {
        year: 2025,
        startValue: 900,
        growthValue: 270,
        contribution: 12000,
        targetValue: 13170,
        resultValue: 1000,
        resultDate: '2025-12-31',
        status: 'completed',
      },
      {
        year: 2026,
        startValue: 1000,
        growthValue: 300,
        contribution: 12000,
        targetValue: 13300,
        resultValue: 1200,
        resultDate: '2026-03-20',
        status: 'current',
      },
      {
        year: 2027,
        startValue: 13300,
        growthValue: 3990,
        contribution: 12000,
        targetValue: 29290,
        resultValue: null,
        resultDate: null,
        status: 'planned',
      },
      {
        year: 2028,
        startValue: 29290,
        growthValue: 8787,
        contribution: 12000,
        targetValue: 50077,
        resultValue: null,
        resultDate: null,
        status: 'planned',
      },
      {
        year: 2029,
        startValue: 50077,
        growthValue: 15023.1,
        contribution: 12000,
        targetValue: 77100.1,
        resultValue: null,
        resultDate: null,
        status: 'planned',
      },
      {
        year: 2030,
        startValue: 77100.1,
        growthValue: 23130.03,
        contribution: 12000,
        targetValue: 112230.13,
        resultValue: null,
        resultDate: null,
        status: 'planned',
      },
    ],
  })
})

test('dedupliceert overlappende saldodagen en IBKR-uitvoeringen bij meerjarige bronnen', () => {
  const equityXml = `<FlexStatement whenGenerated="2025-12-31 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2024-12-31" total="900" />
    <EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000" />
  </FlexStatement>
  <FlexStatement whenGenerated="2026-02-28 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000" />
    <EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1100" />
    <EquitySummaryByReportDateInBase reportDate="2026-02-28" total="1200" />
  </FlexStatement>`
  const tradesXml = `<Trades>
    <Trade ibExecID="same" assetCategory="OPT" conid="1" dateTime="2025-01-01 10:00:00" quantity="-1" tradePrice="2" openCloseIndicator="O" />
    <Trade ibExecID="same" assetCategory="OPT" conid="1" dateTime="2025-01-01 10:00:00" quantity="-1" tradePrice="2" openCloseIndicator="O" />
    <Trade ibExecID="close" assetCategory="OPT" conid="1" dateTime="2025-01-11 10:00:00" quantity="1" tradePrice="1" openCloseIndicator="C" />
  </Trades>`
  const result = createPortfolioSummary({ equityXml, tradesXml, optionXml: '<Options />' })

  assert.equal(result.sourceCounts.equityDays, 4)
  assert.equal(result.sourceCounts.trades, 2)
  assert.equal(result.sourceUpdatedAt, '2026-02-28 10:00:00')
  assert.equal(result.closedTrades.length, 1)
})

test('begrens Gateway-overlap op de laatste werkelijke trade en niet op een lege rapportdag', () => {
  const equityXml = `<FlexStatement whenGenerated="2026-09-25 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2026-07-31" total="900" />
    <EquitySummaryByReportDateInBase reportDate="2026-08-31" total="1000" />
    <EquitySummaryByReportDateInBase reportDate="2026-09-24" total="1100" />
  </FlexStatement>`
  const tradesXml = `<FlexStatement toDate="20260924">
    <Trade ibExecID="latest" assetCategory="OPT" conid="1" dateTime="2026-09-23 10:00:00" quantity="-1" tradePrice="2" openCloseIndicator="O" />
  </FlexStatement>`
  const result = createPortfolioSummary({ equityXml, tradesXml, optionXml: '<Options />' })

  assert.equal(result.balance.toDate, '2026-09-24')
  assert.equal(result.tradesThroughDate, '2026-09-23')
})

test('begrenst de dashboardactiviteit tot het actuele jaar en telt huidige open posities mee', () => {
  const equityXml = `<FlexStatement whenGenerated="2026-03-20 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000" />
    <EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1050" />
    <EquitySummaryByReportDateInBase reportDate="2026-02-28" total="1100" />
    <EquitySummaryByReportDateInBase reportDate="2026-03-20" total="1200" />
  </FlexStatement>`
  const tradesXml = `<Trades>
    <Trade assetCategory="OPT" conid="old" dateTime="2025-01-01 10:00:00" quantity="-1" tradePrice="10" openCloseIndicator="O" />
    <Trade assetCategory="OPT" conid="old" dateTime="2025-01-11 10:00:00" quantity="1" tradePrice="5" openCloseIndicator="C" />
    <Trade assetCategory="OPT" conid="closed" dateTime="2026-02-01 10:00:00" quantity="-1" tradePrice="2" openCloseIndicator="O" />
    <Trade assetCategory="OPT" conid="closed" dateTime="2026-02-11 10:00:00" quantity="1" tradePrice="1" openCloseIndicator="C" />
    <Trade assetCategory="OPT" conid="open" dateTime="2026-03-01 10:00:00" quantity="-1" tradePrice="0.5" openCloseIndicator="O" />
  </Trades>`
  const result = createPortfolioSummary({ equityXml, tradesXml, optionXml: '<Options />' })

  assert.deepEqual(result.tradingActivity, {
    totalTrades: 2,
    closedTrades: 1,
    openTrades: 1,
    premiumCapturePercentage: 50,
    grossPremium: 200,
    netPremium: 100,
    averageDaysHeld: 10,
    minimumDaysHeld: 10,
    maximumDaysHeld: 10,
    measuredClosedTrades: 1,
  })
})

test('combineert short en long optielegs van een synthetic met aandelenverkoop', () => {
  const equityXml = `<FlexStatement whenGenerated="2026-09-24 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2026-07-31" total="1000" />
    <EquitySummaryByReportDateInBase reportDate="2026-08-31" total="1100" />
    <EquitySummaryByReportDateInBase reportDate="2026-09-24" total="1200" />
  </FlexStatement>`
  const tradesXml = `<Trades>
    <Trade assetCategory="OPT" conid="premium" dateTime="2026-09-01 10:00:00" quantity="-1" tradePrice="2" ibCommission="-1" fifoPnlRealized="0" openCloseIndicator="O" putCall="P" strike="10" expiry="2026-10-16" underlyingSymbol="PREM" />
    <Trade assetCategory="OPT" conid="premium" dateTime="2026-09-08 10:00:00" quantity="1" tradePrice="0.5" ibCommission="-1" fifoPnlRealized="148" openCloseIndicator="C" putCall="P" strike="10" expiry="2026-10-16" underlyingSymbol="PREM" />
    <Trade assetCategory="OPT" conid="call" dateTime="2026-09-02 10:00:00" quantity="1" tradePrice="5" ibCommission="-1" fifoPnlRealized="0" openCloseIndicator="O" putCall="C" strike="20" expiry="2026-12-18" underlyingSymbol="SYNT" />
    <Trade assetCategory="OPT" conid="put" dateTime="2026-09-02 10:00:00" quantity="-1" tradePrice="3" ibCommission="-1" fifoPnlRealized="0" openCloseIndicator="O" putCall="P" strike="20" expiry="2026-12-18" underlyingSymbol="SYNT" />
    <Trade assetCategory="OPT" conid="call" dateTime="2026-09-10 10:00:00" quantity="-1" tradePrice="7" ibCommission="-1" fifoPnlRealized="200" openCloseIndicator="C" putCall="C" strike="20" expiry="2026-12-18" underlyingSymbol="SYNT" />
    <Trade assetCategory="OPT" conid="put" dateTime="2026-09-10 10:00:00" quantity="1" tradePrice="2" ibCommission="-1" fifoPnlRealized="100" openCloseIndicator="C" putCall="P" strike="20" expiry="2026-12-18" underlyingSymbol="SYNT" />
    <Trade assetCategory="STK" conid="stock" dateTime="2026-09-12 10:00:00" quantity="-10" tradePrice="30" ibCommission="-1" fifoPnlRealized="300" openCloseIndicator="C" underlyingSymbol="STK" />
  </Trades>`
  const result = createPortfolioSummary({ equityXml, tradesXml, optionXml: '<Options />' })

  assert.deepEqual(result.currentMonthProfit, {
    value: 744,
    fromDate: '2026-08-31',
    toDate: '2026-09-24',
    direction: 'positive',
    premium: 246,
    longOptions: 198,
    stockSales: 300,
  })
})

test('berekent optieactiviteit, afgesloten trades en maandpremies', () => {
  const equityXml = `<FlexQueryResponse><FlexStatement whenGenerated="2026-03-20 10:00:00">
    <EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000" />
    <EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1100" />
    <EquitySummaryByReportDateInBase reportDate="2026-02-28" total="1150" />
    <EquitySummaryByReportDateInBase reportDate="2026-03-20" total="1200" totalLong="1225" totalShort="-25" />
  </FlexStatement></FlexQueryResponse>`
  const tradesXml = `<Trades>
    <Trade assetCategory="OPT" conid="1" dateTime="2026-02-01 10:00:00" quantity="-1" tradePrice="2" ibCommission="-1" openCloseIndicator="O" />
    <Trade assetCategory="OPT" conid="1" dateTime="2026-02-11 10:00:00" quantity="1" tradePrice="0.5" ibCommission="-1" openCloseIndicator="C" />
    <Trade assetCategory="OPT" conid="2" underlyingSymbol="TEST" description="TEST 17APR26 20 P" expiry="2026-04-17" putCall="P" strike="20" dateTime="2026-03-01 10:00:00" quantity="-2" tradePrice="1.5" ibCommission="-1.5" openCloseIndicator="O" />
    <Trade assetCategory="STK" conid="3" underlyingSymbol="TEST" description="Test aandeel" dateTime="2026-03-02 10:00:00" quantity="10" tradePrice="20" ibCommission="-1" openCloseIndicator="O" />
  </Trades>`
  const result = createPortfolioSummary({ equityXml, tradesXml, optionXml: '<Options />' })

  assert.deepEqual(result.tradingActivity, {
    totalTrades: 2,
    closedTrades: 1,
    openTrades: 1,
    premiumCapturePercentage: 74,
    grossPremium: 200,
    netPremium: 148,
    averageDaysHeld: 10,
    minimumDaysHeld: 10,
    maximumDaysHeld: 10,
    measuredClosedTrades: 1,
  })
  assert.deepEqual(result.premiumPeriods.currentMonth, {
    month: '2026-03',
    received: 0,
    buyback: 0,
    commission: 0,
    net: 0,
  })
  assert.deepEqual(result.premiumPeriods.previousMonth, {
    month: '2026-02',
    received: 200,
    buyback: 50,
    commission: 2,
    net: 148,
  })
  assert.deepEqual(result.portfolioAllocation.categories, [
    { key: 'stocks', label: 'Aandelen', value: 201, percentage: 16.8 },
    { key: 'options', label: 'Opties', value: 3975, percentage: 331.3 },
    { key: 'cash', label: 'Geld / overig', value: -2976, percentage: -248 },
  ])
  assert.equal(result.portfolioAllocation.reservedCash, 4000)
  assert.equal(result.portfolioAllocation.freeToSpend, -3001)
  assert.deepEqual(result.stockHoldings, [
    {
      conid: '3',
      symbol: 'TEST',
      name: 'Test aandeel',
      quantity: 10,
      averagePurchasePrice: 20.1,
      purchaseValue: 201,
      currentPrice: null,
      currentValue: null,
      difference: null,
      differencePercentage: null,
      dailyChangePercentage: null,
    },
  ])
  assert.deepEqual(result.optionHoldings, [
    {
      conid: '2',
      symbol: 'TEST',
      name: 'TEST 17APR26 20 P',
      quantity: -2,
      optionRight: 'P',
      strike: 20,
      expiry: '2026-04-17',
      openedAt: '2026-03-01',
      chosenDte: 47,
      averageOpenPrice: 1.5,
      currentPrice: null,
      currentValue: null,
      difference: null,
      differencePercentage: null,
      strategy: 'SHORT_PUT',
    },
  ])
  assert.deepEqual(result.closedTrades, [
    {
      id: '1-1',
      conid: '1',
      symbol: '1',
      name: '1',
      optionRight: null,
      strike: null,
      expiry: null,
      direction: 'short',
      quantity: 1,
      openedAt: '2026-02-01',
      closedAt: '2026-02-11',
      daysHeld: 10,
      openingValue: 200,
      profit: 148,
      profitPercentage: 74,
      annualizedPercentage: 2701,
    },
  ])
})


test('startsaldo gebruikt de eerste saldodag van 2025 als de jaargrens ontbreekt en verzint geen andere start', () => {
  const recent = '<EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1100"/><EquitySummaryByReportDateInBase reportDate="2026-02-28" total="1200"/>'
  const summary = (prefix, rest = recent) => createPortfolioSummary({ equityXml: prefix + rest, tradesXml: '', optionXml: '' })
  assert.deepEqual(summary('<EquitySummaryByReportDateInBase reportDate="2025-01-03" total="500"/>').startingBalance, { value: 500, date: '2025-01-03' })
  assert.deepEqual(summary('<EquitySummaryByReportDateInBase reportDate="2025-01-03" total="0"/>').startingBalance, { value: 0, date: '2025-01-03' })
  assert.equal(summary('', recent.replace('2025-12-31', '2024-12-30')).startingBalance, null)
})
