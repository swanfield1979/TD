import { optionExpiry } from '../shared/option-expiry.mjs'
const round = (value, decimals = 2) => Number(Number(value).toFixed(decimals))

// Preserve the last observation from an earlier day across refreshes and restarts.
export function withPreviousBalance(snapshot, previous) {
  if (!previous || previous.currency !== snapshot.currency) return snapshot
  const reference = previous.asOfDate < snapshot.asOfDate
    ? { date: previous.asOfDate, value: previous.netLiquidation }
    : previous.previousBalance
  return reference && reference.date < snapshot.asOfDate && Number.isFinite(reference.value)
    ? { ...snapshot, previousBalance: reference }
    : snapshot
}

export function updatePosition(positions, update) {
  const key = `${update.accountName || ''}|${update.conid}`
  const existing = positions.get(key)
  // Keep quote-request references valid while retaining only the latest update.
  positions.set(key, existing ? Object.assign(existing, update) : { ...update })
}

export function createLiveSnapshot({ accountValues, positions, generatedAt = new Date().toISOString() }) {
  const netLiquidationEntry = accountValues.get('NetLiquidation')
  const totalCashEntry = accountValues.get('TotalCashValue')
  const grossPositionEntry = accountValues.get('GrossPositionValue')
  const currency = netLiquidationEntry?.currency || 'USD'
  const finiteValue = (entry) => {
    const value = Number(entry?.value)
    return Number.isFinite(value) ? value : null
  }

  const latestPositions = new Map()
  for (const position of positions) updatePosition(latestPositions, position)
  const normalizedPositions = [...latestPositions.values()]
    .filter((position) => Number(position.position) !== 0)
    .map((position) => {
      const quantity = Number(position.position)
      const averageCost = Number(position.averageCost ?? 0)
      const currentPrice = Number(position.marketPrice ?? 0)
      const currentValue = Number(position.marketValue ?? 0)
      const difference = Number(position.unrealizedPnl ?? 0)
      const costBasis = currentValue - difference
      const previousCloseValue = Number(position.previousClose)
      const previousClose = Number.isFinite(previousCloseValue) && previousCloseValue > 0
        ? previousCloseValue
        : null
      const optionStrikeValue = position.optionStrike === null || position.optionStrike === undefined
        ? null
        : Number(position.optionStrike)
      const multiplier = position.multiplier === null || position.multiplier === undefined
        ? null
        : Number(position.multiplier)

      return {
        conid: String(position.conid ?? ''),
        symbol: position.symbol || position.localSymbol || String(position.conid ?? ''),
        name: position.localSymbol || position.symbol || String(position.conid ?? ''),
        assetCategory: position.assetCategory || 'UNKNOWN',
        optionRight: position.optionRight || null,
        optionStrike: Number.isFinite(optionStrikeValue) ? round(optionStrikeValue, 4) : null,
        optionExpiry: optionExpiry(position.optionExpiry, position.localSymbol),
        multiplier: Number.isFinite(multiplier) ? multiplier : null,
        currency: position.currency || currency,
        quantity: round(quantity, 4),
        averagePurchasePrice: round(averageCost, 4),
        purchaseValue: round(costBasis),
        currentPrice: round(currentPrice, 4),
        currentValue: round(currentValue),
        difference: round(difference),
        differencePercentage: costBasis ? round((difference / Math.abs(costBasis)) * 100, 2) : 0,
        previousClose: previousClose === null ? null : round(previousClose, 4),
        dailyChangePercentage: previousClose === null ? null : round(((currentPrice - previousClose) / previousClose) * 100, 2),
        realizedPnl: round(Number(position.realizedPnl ?? 0)),
      }
    })
    .sort((left, right) => left.symbol.localeCompare(right.symbol))

  const netLiquidation = finiteValue(netLiquidationEntry)
  if (netLiquidation === null) throw new Error('IBKR heeft geen netto liquidatiewaarde teruggegeven.')

  return {
    generatedAt,
    asOfDate: generatedAt.slice(0, 10),
    currency,
    netLiquidation: round(netLiquidation),
    totalCashValue: finiteValue(totalCashEntry),
    grossPositionValue: finiteValue(grossPositionEntry),
    positions: normalizedPositions,
  }
}
