import type { IbkrLiveSnapshot, PortfolioSummary } from './types'
import { calculateCoveredCallCoverage } from '../shared/covered-call.mjs'
import { assignOptionStrategies } from '../shared/option-strategy.mjs'
import { optionStrike, portfolioAllocation } from '../shared/portfolio-risk.mjs'
import { optionExpiry } from '../shared/option-expiry.mjs'
import { gatewayClosures } from '../shared/gateway-trades.mjs'

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))

export function resolvePortfolio(summary: PortfolioSummary | null, snapshot: IbkrLiveSnapshot | null) {
  if (!summary || !snapshot || snapshot.currency !== summary.currency || snapshot.asOfDate < summary.balance.toDate) return summary
  return mergeLiveSnapshot(summary, snapshot)
}

export function mergeLiveSnapshot(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): PortfolioSummary {
  const { closures, pending } = gatewayClosures(summary, snapshot)
  const closedTrades = [...(summary.closedTrades ?? []), ...closures]
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt) || b.id.localeCompare(a.id))
  const closedInYear = closedTrades.filter((trade) => trade.closedAt.startsWith(snapshot.asOfDate.slice(0, 4)))
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
    } : summary.tradingActivity,
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
