import type { IbkrLiveSnapshot, PortfolioSummary } from './types'
import { calculateCoveredCallCoverage } from '../shared/covered-call.mjs'
import { assignOptionStrategies } from '../shared/option-strategy.mjs'
import { optionStrike, portfolioAllocation } from '../shared/portfolio-risk.mjs'
import { optionExpiry } from '../shared/option-expiry.mjs'

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))

export function resolvePortfolio(summary: PortfolioSummary | null, snapshot: IbkrLiveSnapshot | null) {
  if (!summary || !snapshot || snapshot.currency !== summary.currency || snapshot.asOfDate < summary.balance.toDate) return summary
  return mergeLiveSnapshot(summary, snapshot)
}

export function mergeLiveSnapshot(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): PortfolioSummary {
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
    generatedAt: snapshot.generatedAt,
    sourceUpdatedAt: snapshot.generatedAt,
    currency: snapshot.currency,
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
      openTrades: liveOptionHoldings.length,
      totalTrades: summary.tradingActivity.closedTrades + liveOptionHoldings.length,
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
