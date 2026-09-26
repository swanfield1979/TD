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
  assert.equal(result.dailyProfit.value, 150)
  assert.equal(result.yearProfit.value, 200)
  assert.equal(result.currentMonthProfit.value, 150)
  assert.equal(result.previousMonthProfit.value, -50)
  assert.equal(result.averageMonthlyProfit.value, 66.67)
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
    annualContribution: 1200,
    years: [
      { year: 2026, startValue: 1000, growthValue: 300, contribution: 1200, targetValue: 2500 },
      { year: 2027, startValue: 2500, growthValue: 750, contribution: 1200, targetValue: 4450 },
      { year: 2028, startValue: 4450, growthValue: 1335, contribution: 1200, targetValue: 6985 },
      { year: 2029, startValue: 6985, growthValue: 2095.5, contribution: 1200, targetValue: 10280.5 },
      { year: 2030, startValue: 10280.5, growthValue: 3084.15, contribution: 1200, targetValue: 14564.65 },
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
    premiumCapturePercentage: 89.3,
    grossPremium: 500,
    netPremium: 446.5,
    averageDaysHeld: 10,
    minimumDaysHeld: 10,
    maximumDaysHeld: 10,
    measuredClosedTrades: 1,
  })
  assert.deepEqual(result.premiumPeriods.currentMonth, {
    month: '2026-03',
    received: 300,
    buyback: 0,
    commission: 1.5,
    net: 298.5,
  })
  assert.deepEqual(result.premiumPeriods.previousMonth, {
    month: '2026-02',
    received: 200,
    buyback: 50,
    commission: 2,
    net: 148,
  })
  assert.deepEqual(result.portfolioAllocation.categories, [
    { key: 'stocks', label: 'Aandelen', value: 201, percentage: 16.1 },
    { key: 'options', label: 'Opties', value: 25, percentage: 2 },
    { key: 'cash', label: 'Geld / overig', value: 1024, percentage: 81.9 },
  ])
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
