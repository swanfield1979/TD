const round = (value, decimals = 2) => Number(value.toFixed(decimals))

function normalizeOptionRight(value) {
  const right = String(value || '').trim().toUpperCase()
  if (right === 'CALL') return 'C'
  if (right === 'PUT') return 'P'
  return right
}

export function optionStrike(position) {
  const explicitStrike = Number(position?.strike)
  if (Number.isFinite(explicitStrike) && explicitStrike > 0) return explicitStrike

  const contractName = String(position?.name || '').toUpperCase().replaceAll(' ', '')
  const compactContract = contractName.match(/[CP](\d{8})$/)
  if (!compactContract) return null

  const encodedStrike = Number(compactContract[1]) / 1000
  return Number.isFinite(encodedStrike) && encodedStrike > 0 ? encodedStrike : null
}

export function cashSecuredPutReserve(optionHoldings) {
  let reservedCash = 0
  let unpricedContractCount = 0

  for (const holding of optionHoldings ?? []) {
    if (normalizeOptionRight(holding.optionRight) !== 'P' || Number(holding.quantity) >= 0) continue
    const contracts = Math.abs(Number(holding.quantity) || 0)
    const strike = optionStrike(holding)
    if (strike === null) {
      unpricedContractCount += contracts
      continue
    }
    reservedCash += contracts * strike * 100
  }

  return {
    reservedCash: round(reservedCash),
    unpricedContractCount: round(unpricedContractCount, 4),
  }
}

export function portfolioAllocation({ balance, stockValue, optionValue, optionHoldings, isEstimated }) {
  const { reservedCash, unpricedContractCount } = cashSecuredPutReserve(optionHoldings)
  const optionsIncludingReserve = round(optionValue + reservedCash)
  // Include cash plus all other NAV components (e.g. accrued interest). Short
  // option liabilities retain their sign; reserve is a reclassification only.
  const availableCash = round(balance - stockValue - optionsIncludingReserve)
  const freeToSpend = round(balance - stockValue - reservedCash)
  const category = (key, label, value) => ({
    key,
    label,
    value: round(value),
    percentage: balance ? round((value / balance) * 100, 1) : 0,
  })

  return {
    isEstimated,
    reservedCash,
    freeToSpend,
    unpricedContractCount,
    categories: [
      category('stocks', 'Aandelen', stockValue),
      category('options', 'Opties', optionsIncludingReserve),
      category('cash', 'Geld / overig', availableCash),
    ],
  }
}
