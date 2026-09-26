const normalizeSymbol = (value) => String(value || '').trim().toUpperCase()

export function calculateCoveredCallCoverage(stockPosition, positions) {
  const shareCount = Math.max(0, Number(stockPosition.quantity) || 0)
  const availableContracts = Math.floor(shareCount / 100)
  const stockSymbol = normalizeSymbol(stockPosition.symbol)
  const openContracts = positions
    .filter((position) => position.assetCategory === 'OPT')
    .filter((position) => normalizeSymbol(position.symbol) === stockSymbol)
    .filter((position) => ['C', 'CALL'].includes(String(position.optionRight || '').toUpperCase()))
    .filter((position) => Number(position.quantity) < 0)
    .reduce((sum, position) => sum + Math.abs(Number(position.quantity)), 0)

  const roundedOpenContracts = Number(openContracts.toFixed(4))
  let status = 'not_applicable'
  if (availableContracts > 0 && roundedOpenContracts === 0) status = 'none'
  else if (roundedOpenContracts > availableContracts) status = 'over'
  else if (availableContracts > 0 && roundedOpenContracts === availableContracts) status = 'complete'
  else if (roundedOpenContracts > 0) status = 'partial'

  return {
    openContracts: roundedOpenContracts,
    availableContracts,
    status,
  }
}
