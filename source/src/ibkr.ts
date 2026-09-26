import type { IbkrLiveSnapshot, PortfolioSummary } from './types'
import { calculateCoveredCallCoverage } from '../shared/covered-call.mjs'

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))

export function mergeLiveSnapshot(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): PortfolioSummary {
  const stockPositions = snapshot.positions.filter((position) => position.assetCategory === 'STK')
  const optionPositions = snapshot.positions.filter((position) => position.assetCategory === 'OPT')
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
