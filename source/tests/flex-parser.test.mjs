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
  assert.equal(result.yearProfit.value, 200)
  assert.equal(result.currentMonthProfit.value, 150)
  assert.equal(result.previousMonthProfit.value, -50)
  assert.equal(result.averageMonthlyProfit.value, 66.67)
  assert.equal(result.sourceCounts.trades, 2)
})
