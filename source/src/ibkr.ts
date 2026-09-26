import type { IbkrLiveSnapshot, PortfolioSummary } from './types'
import { calculateCoveredCallCoverage } from '../shared/covered-call.mjs'
import { assignOptionStrategies } from '../shared/option-strategy.mjs'

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))

export function mergeLiveSnapshot(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): PortfolioSummary {
  const stockPositions = snapshot.positions.filter((position) => position.assetCategory === 'STK')
  const optionPositions = snapshot.positions.filter((position) => position.assetCategory === 'OPT')
  const optionMetadata = new Map((summary.optionHoldings ?? []).map((position) => [position.conid, position]))
  const hasCoveredCallMetadata = optionPositions.every((position) => Object.hasOwn(position, 'optionRight'))
  const stockValue = stockPositions.reduce((sum, position) => sum + Math.abs(position.currentValue), 0)
  const optionValue = optionPositions.reduce((sum, position) => sum + Math.abs(position.currentValue), 0)
  const cashValue = snapshot.totalCashValue === null
    ? Math.max(0, snapshot.netLiquidation - stockValue - optionValue)
    : Math.max(0, snapshot.totalCashValue)
  const total = stockValue + optionValue + cashValue
  const category = (key: 'stocks' | 'options' | 'cash', label: string, value: number) => ({
    key,
    label,
    value: round(value),
    percentage: total ? round((value / total) * 100, 1) : 0,
  })

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
      coveredCallCoverage: hasCoveredCallMetadata ? calculateCoveredCallCoverage(position, snapshot.positions) : null,
    })),
    optionHoldings: assignOptionStrategies(optionPositions.map((position) => {
      const metadata = optionMetadata.get(position.conid)
      const multiplier = position.multiplier || 100
      return {
        conid: position.conid,
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        optionRight: position.optionRight,
        strike: position.optionStrike ?? metadata?.strike ?? null,
        expiry: position.optionExpiry ?? metadata?.expiry ?? null,
        openedAt: metadata?.openedAt ?? null,
        chosenDte: metadata?.chosenDte ?? null,
        averageOpenPrice: multiplier ? round(Math.abs(position.averagePurchasePrice) / multiplier, 4) : metadata?.averageOpenPrice ?? null,
        currentPrice: position.currentPrice,
        currentValue: position.currentValue,
        difference: position.difference,
        differencePercentage: position.differencePercentage,
      }
    })),
    portfolioAllocation: {
      isEstimated: false,
      categories: [
        category('stocks', 'Aandelen', stockValue),
        category('options', 'Opties', optionValue),
        category('cash', 'Geld / overig', cashValue),
      ],
    },
  }
}
