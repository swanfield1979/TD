import type { IbkrLiveSnapshot, PortfolioSummary } from './types'
import { calculateCoveredCallCoverage } from '../shared/covered-call.mjs'
import { assignOptionStrategies } from '../shared/option-strategy.mjs'
import { optionStrike, portfolioAllocation } from '../shared/portfolio-risk.mjs'
import { optionExpiry } from '../shared/option-expiry.mjs'
import { gatewayClosures, mergeExecutions } from '../shared/gateway-trades.mjs'

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))
const direction = (value: number) => value > 0 ? 'positive' as const : value < 0 ? 'negative' as const : 'neutral' as const
const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)
const previousMonth = (month: string) => {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 7)
}

function mergeLiveResults(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot, closures: PortfolioSummary['closedTrades']) {
  const cutoff = summary.tradesThroughDate || summary.balance.toDate
  const account = snapshot.account
  const executions = mergeExecutions([], snapshot.executions ?? []).filter((execution) =>
    (!account || execution.account === account)
    && execution.dateTime.slice(0, 10) > cutoff
    && execution.currency === summary.currency)
  const liveByMonth = new Map<string, { premium: number; stockSales: number }>()
  const add = (month: string, key: 'premium' | 'stockSales', value: number) => {
    const result = liveByMonth.get(month) ?? { premium: 0, stockSales: 0 }
    result[key] = round(result[key] + value)
    liveByMonth.set(month, result)
  }

  closures.filter((trade) => trade.direction === 'short')
    .forEach((trade) => add(trade.closedAt.slice(0, 7), 'premium', trade.profit))
  executions.filter((execution) => execution.assetCategory === 'STK'
      && typeof execution.realizedPNL === 'number' && Number.isFinite(execution.realizedPNL)
      && Math.abs(execution.realizedPNL) < 1e100)
    .forEach((execution) => add(execution.dateTime.slice(0, 7), 'stockSales', execution.realizedPNL!))

  const importedByMonth = new Map((summary.monthlyTradingResults ?? []).map((result) => [result.month, result]))
  const summaryPeriods = [summary.currentMonthProfit, summary.previousMonthProfit]
  for (const result of summaryPeriods) {
    const month = result.toDate.slice(0, 7)
    if (!importedByMonth.has(month)) importedByMonth.set(month, { month, ...result })
  }
  const liveMonth = snapshot.asOfDate.slice(0, 7)
  const liveYear = liveMonth.slice(0, 4)
  const currentMonthNumber = Number(liveMonth.slice(5, 7))
  const monthlyTradingResults = Array.from({ length: currentMonthNumber }, (_, index) => {
    const month = `${liveYear}-${String(index + 1).padStart(2, '0')}`
    const imported = importedByMonth.get(month)
    const live = liveByMonth.get(month) ?? { premium: 0, stockSales: 0 }
    const premium = round((imported?.premium ?? 0) + live.premium)
    const stockSales = round((imported?.stockSales ?? 0) + live.stockSales)
    const value = round(premium + stockSales)
    return {
      month, premium, stockSales, value, direction: direction(value),
      fromDate: imported?.fromDate ?? `${month}-01`,
      toDate: month === liveMonth ? snapshot.asOfDate : imported?.toDate ?? monthEnd(month),
    }
  })
  const resultFor = (month: string) => monthlyTradingResults.find((result) => result.month === month)
    ?? importedByMonth.get(month)
    ?? { month, premium: 0, stockSales: 0, value: 0, direction: 'neutral' as const, fromDate: `${month}-01`, toDate: monthEnd(month) }
  const currentMonthProfit = resultFor(liveMonth)
  const previousMonthProfit = resultFor(previousMonth(liveMonth))
  const yearValue = round(monthlyTradingResults.reduce((total, result) => total + result.value, 0))
  const yearStart = summary.yearProfit.toDate.startsWith(liveYear) ? summary.yearProfit.fromDate : `${liveYear}-01-01`
  const periodByMonth = new Map([summary.premiumPeriods.currentMonth, summary.premiumPeriods.previousMonth]
    .map((period) => [period.month, period]))
  const premiumPeriod = (month: string) => {
    const imported = periodByMonth.get(month)
    const liveNet = liveByMonth.get(month)?.premium ?? 0
    return {
      month,
      received: imported?.received ?? 0,
      buyback: imported?.buyback ?? 0,
      commission: imported?.commission ?? 0,
      historicalNet: imported?.historicalNet,
      liveNet: liveNet || undefined,
      net: round((imported?.net ?? 0) + liveNet),
    }
  }

  return {
    currentMonthProfit,
    previousMonthProfit,
    monthlyTradingResults,
    yearProfit: { value: yearValue, fromDate: yearStart, toDate: snapshot.asOfDate, direction: direction(yearValue) },
    averageMonthlyProfit: {
      value: round(yearValue / Math.max(1, currentMonthNumber)), fromDate: yearStart,
      toDate: snapshot.asOfDate, direction: direction(yearValue), monthCount: Math.max(1, currentMonthNumber),
    },
    premiumPeriods: { currentMonth: premiumPeriod(liveMonth), previousMonth: premiumPeriod(previousMonth(liveMonth)) },
  }
}

function mergeLiveBalanceHistory(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot) {
  const month = snapshot.asOfDate.slice(0, 7)
  const history = [...(summary.portfolioHistory ?? [])]
  const existingIndex = history.findIndex((point) => point.month === month)
  const point = { month, date: snapshot.asOfDate, balance: round(snapshot.netLiquidation) }
  if (existingIndex >= 0) history[existingIndex] = point
  else history.push(point)
  history.sort((left, right) => left.month.localeCompare(right.month))

  const year = month.slice(0, 4)
  const labels = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
  const existingChanges = summary.monthlyBalanceChanges?.[0]?.month.startsWith(year)
    ? summary.monthlyBalanceChanges
    : labels.map((label, index) => ({ month: `${year}-${String(index + 1).padStart(2, '0')}`, label, value: null, balance: null, direction: null }))
  const monthlyBalanceChanges = existingChanges.map((change) => {
    if (change.month !== month) return change
    const previous = history.filter((candidate) => candidate.month < month).at(-1)
    const value = previous ? round(snapshot.netLiquidation - previous.balance) : null
    return { ...change, value, balance: round(snapshot.netLiquidation), fromDate: previous?.date,
      toDate: snapshot.asOfDate, direction: value === null ? null : direction(value) }
  })
  return { portfolioHistory: history, monthlyBalanceChanges }
}

export function resolvePortfolio(summary: PortfolioSummary | null, snapshot: IbkrLiveSnapshot | null) {
  if (!summary || !snapshot || snapshot.currency !== summary.currency || snapshot.asOfDate < summary.balance.toDate) return summary
  return mergeLiveSnapshot(summary, snapshot)
}

export function mergeLiveSnapshot(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): PortfolioSummary {
  const { closures, pending } = gatewayClosures(summary, snapshot)
  const liveResults = mergeLiveResults(summary, snapshot, closures)
  const liveBalanceHistory = mergeLiveBalanceHistory(summary, snapshot)
  const closedTrades = [...(summary.closedTrades ?? []), ...closures]
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt) || b.id.localeCompare(a.id))
  const snapshotYear = snapshot.asOfDate.slice(0, 4)
  const importedActivityIsCurrent = summary.yearProfit.toDate.startsWith(snapshotYear)
  const closedInYear = closedTrades.filter((trade) => trade.closedAt.startsWith(snapshotYear))
  const durations = closedInYear.flatMap((trade) => trade.daysHeld === null ? [] : [trade.daysHeld])
  const reportReference = summary.balance.toDate < snapshot.asOfDate
    ? { date: summary.balance.toDate, value: summary.balance.value }
    : summary.dailyProfit.fromDate
      ? { date: summary.dailyProfit.fromDate, value: summary.balance.value - summary.dailyProfit.value }
      : null
  const candidates = [
    reportReference && { ...reportReference, source: 'report' as const },
    snapshot.previousBalance && { ...snapshot.previousBalance, source: 'snapshot' as const },
  ].filter((item) => item && item.date < snapshot.asOfDate && Number.isFinite(item.value))
  // Prefer a reported closing balance when both sources cover the same date.
  const reference = candidates.sort((a, b) => b!.date.localeCompare(a!.date))[0]
  const dailyChange = reference ? round(snapshot.netLiquidation - reference.value) : 0
  const positions = [...new Map(snapshot.positions.map((position) => [position.conid, position])).values()]
    .filter((position) => position.quantity !== 0)
  const stockPositions = positions.filter((position) => position.assetCategory === 'STK')
  const optionPositions = positions.filter((position) => position.assetCategory === 'OPT')
  const optionMetadata = new Map((summary.optionHoldings ?? []).map((position) => [position.conid, position]))
  const hasCoveredCallMetadata = optionPositions.every((position) => Object.hasOwn(position, 'optionRight'))
  const stockValue = stockPositions.reduce((sum, position) => sum + position.currentValue, 0)
  const optionValue = optionPositions.reduce((sum, position) => sum + position.currentValue, 0)
  const cashValue = snapshot.totalCashValue === null
    ? Math.max(0, snapshot.netLiquidation - stockValue - optionValue)
    : Math.max(0, snapshot.totalCashValue)
  const liveOptionHoldings = assignOptionStrategies(optionPositions.map((position) => {
    const metadata = optionMetadata.get(position.conid)
    const multiplier = position.multiplier || 100
    const holding = {
      conid: position.conid,
      symbol: position.symbol,
      name: position.name,
      quantity: position.quantity,
      optionRight: position.optionRight,
      strike: position.optionStrike ?? metadata?.strike ?? null,
      expiry: optionExpiry(position.optionExpiry ?? metadata?.expiry, position.name),
      openedAt: metadata?.openedAt ?? null,
      chosenDte: metadata?.chosenDte ?? null,
      averageOpenPrice: multiplier ? round(Math.abs(position.averagePurchasePrice) / multiplier, 4) : metadata?.averageOpenPrice ?? null,
      currentPrice: position.currentPrice,
      currentValue: position.currentValue,
      difference: position.difference,
      differencePercentage: position.differencePercentage,
    }
    return { ...holding, strike: optionStrike(holding) }
  }))

  return {
    ...summary,
    ...liveResults,
    ...liveBalanceHistory,
    closedTrades,
    pendingGatewayClosures: pending,
    generatedAt: snapshot.generatedAt,
    sourceUpdatedAt: snapshot.generatedAt,
    currency: snapshot.currency,
    dailyProfit: {
      value: dailyChange,
      fromDate: reference?.date,
      toDate: snapshot.asOfDate,
      direction: dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'neutral',
      source: 'live',
      referenceSource: reference?.source,
      unavailable: !reference,
    },
    balance: {
      ...summary.balance,
      value: snapshot.netLiquidation,
      toDate: snapshot.asOfDate,
      direction: snapshot.netLiquidation > 0 ? 'positive' : snapshot.netLiquidation < 0 ? 'negative' : 'neutral',
    },
    stockHoldings: stockPositions.map((position) => ({
      conid: position.conid,
      symbol: position.symbol,
      name: position.name,
      quantity: position.quantity,
      averagePurchasePrice: position.averagePurchasePrice,
      purchaseValue: position.purchaseValue,
      currentPrice: position.currentPrice,
      currentValue: position.currentValue,
      difference: position.difference,
      differencePercentage: position.differencePercentage,
      dailyChangePercentage: position.dailyChangePercentage,
      coveredCallCoverage: hasCoveredCallMetadata ? calculateCoveredCallCoverage(position, positions) : null,
    })),
    optionHoldings: liveOptionHoldings,
    tradingActivity: summary.tradingActivity ? {
      ...summary.tradingActivity,
      closedTrades: closedInYear.length,
      openTrades: liveOptionHoldings.length,
      totalTrades: closedInYear.length + liveOptionHoldings.length,
      averageDaysHeld: durations.length ? round(durations.reduce((sum, days) => sum + days, 0) / durations.length, 1) : 0,
      minimumDaysHeld: durations.length ? Math.min(...durations) : 0,
      maximumDaysHeld: durations.length ? Math.max(...durations) : 0,
      measuredClosedTrades: durations.length,
      grossPremium: importedActivityIsCurrent ? summary.tradingActivity.grossPremium : 0,
      premiumCapturePercentage: importedActivityIsCurrent ? summary.tradingActivity.premiumCapturePercentage : 0,
      netPremium: round((importedActivityIsCurrent ? summary.tradingActivity.netPremium : 0)
        + closures.filter((trade) => trade.direction === 'short' && trade.closedAt.startsWith(snapshotYear))
          .reduce((total, trade) => total + trade.profit, 0)),
    } : summary.tradingActivity,
    goalPlan: summary.goalPlan ? {
      ...summary.goalPlan,
      years: summary.goalPlan.years.map((goal) => goal.status === 'current' && goal.year === Number(snapshot.asOfDate.slice(0, 4))
        ? { ...goal, resultValue: round(snapshot.netLiquidation), resultDate: snapshot.asOfDate }
        : goal),
    } : null,
    portfolioAllocation: portfolioAllocation({
      balance: snapshot.netLiquidation,
      stockValue,
      optionValue,
      cashValue,
      optionHoldings: liveOptionHoldings,
      isEstimated: false,
    }),
  }
}
