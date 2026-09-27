import assert from 'node:assert/strict'
import test from 'node:test'
import { cashContributionPeriods, createPortfolioSummary } from '../scripts/flex-parser.mjs'
import { contributionReturn, contributionsSince } from '../shared/contribution-return.mjs'

const report = (year, net, end = `${year}1231`, body = '', start = `${year}0101`) => `<FlexStatement fromDate="${start}" toDate="${end}"><CashReportCurrency depositWithdrawals="${net}"/><CashReportCurrency depositWithdrawals="99999"/>${body}</FlexStatement>`

test('neemt alleen het basistotaal, bewaart euro-stortingen en opnames apart en behoudt gelijke stortingen', () => {
  const [period] = cashContributionPeriods(report(2025, 1234.567, undefined,
    '<CashTransaction currency="EUR" amount="500" type="Deposits/Withdrawals"/><CashTransaction currency="EUR" amount="500" type="Deposits/Withdrawals"/><CashTransaction currency="EUR" amount="-100" type="Deposits/Withdrawals"/>'))
  assert.equal(period.net, 1234.57)
  assert.equal(period.currencyInferred, true)
  assert.deepEqual(period.currencies, [{ currency: 'EUR', deposits: 1000, withdrawals: 100, net: 900 }])
})

test('dubbele en uitgebreidere cumulatieve rapporten worden niet bij elkaar opgeteld', () => {
  const periods = cashContributionPeriods(report(2026, 100, '20260331') + report(2026, 100, '20260331') + report(2026, 300, '20260925'))
  assert.equal(periods.length, 1)
  assert.equal(periods[0].net, 300)
  assert.throws(() => cashContributionPeriods(report(2026, 100) + report(2026, 200)), /Tegenstrijdige/)
  assert.throws(() => cashContributionPeriods(report(2026, 100) + report(2026, 200, '20261231', '', '20260201')), /Overlappende/)
})

test('start 2025 trekt 2024-inleg niet dubbel af en markeert verschillende peildatums', () => {
  const periods = cashContributionPeriods(report(2024, 30000) + report(2025, 5000) + report(2026, 7000, '20260925'))
  assert.deepEqual(contributionsSince(periods, '2024-12-31', '2026-09-24'), { net: 12000, toDate: '2026-09-25', datesDiffer: true })
  assert.equal(contributionsSince(periods, '2024-12-31', '2026-09-25').datesDiffer, false)
  assert.equal(contributionsSince(periods.filter((row) => row.year !== 2025), '2024-12-31', '2026-09-25'), null)
  assert.equal(contributionsSince(periods, '2025-01-03', '2026-09-25'), null)
})

test('storting is geen winst, opname geen verlies; live saldo corrigeert alleen de winst', () => {
  assert.deepEqual(contributionReturn(1500, 1000, 500), { capital: 1500, profit: 0, percentage: 0 })
  assert.deepEqual(contributionReturn(750, 1000, -250), { capital: 750, profit: 0, percentage: 0 })
  assert.deepEqual(contributionReturn(1650, 1000, 500), { capital: 1500, profit: 150, percentage: 0.1 })
  assert.equal(contributionReturn(1350, 1000, 500).percentage, -0.1)
  assert.equal(contributionReturn(100, 0, 0).percentage, null)
  assert.equal(contributionReturn(1000, 500, undefined), null)
})

test('extra werkelijke inleg past de verwachting aan, geplande inleg en gerealiseerde trading blijven apart', () => {
  const summary = createPortfolioSummary({
    equityXml: '<EquitySummaryByReportDateInBase reportDate="2024-12-31" total="1000"/><EquitySummaryByReportDateInBase reportDate="2025-12-31" total="1500"/><EquitySummaryByReportDateInBase reportDate="2026-01-31" total="1600"/><EquitySummaryByReportDateInBase reportDate="2026-02-28" total="1800"/>',
    tradesXml: '', optionXml: '', contributionsXml: report(2025, 300) + report(2026, 15000, '20260228'),
  })
  const goal = summary.goalPlan.years.find((row) => row.year === 2026)
  assert.equal(goal.contribution, 12000)
  assert.equal(goal.targetValue, 16950)
  assert.equal(summary.goalPlan.years.find((row) => row.year === 2027).startValue, 16950)
  assert.equal(summary.contributionPeriods.find((row) => row.year === 2026).net, 15000)
  assert.equal(summary.currentMonthProfit.value, 0)
})
