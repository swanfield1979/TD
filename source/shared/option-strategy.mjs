const normalizeRight = (value) => {
  const right = String(value || '').trim().toUpperCase()
  if (right === 'CALL') return 'C'
  if (right === 'PUT') return 'P'
  return right
}

const strategyForPosition = (position, positions) => {
  const right = normalizeRight(position.optionRight)
  const quantity = Number(position.quantity) || 0
  const sameContractGroup = positions.filter((candidate) => (
    candidate !== position
    && String(candidate.symbol || '').toUpperCase() === String(position.symbol || '').toUpperCase()
    && candidate.expiry === position.expiry
    && Number(candidate.strike) === Number(position.strike)
  ))

  const hasLongCall = (right === 'C' && quantity > 0)
    || sameContractGroup.some((candidate) => normalizeRight(candidate.optionRight) === 'C' && Number(candidate.quantity) > 0)
  const hasShortCall = (right === 'C' && quantity < 0)
    || sameContractGroup.some((candidate) => normalizeRight(candidate.optionRight) === 'C' && Number(candidate.quantity) < 0)
  const hasLongPut = (right === 'P' && quantity > 0)
    || sameContractGroup.some((candidate) => normalizeRight(candidate.optionRight) === 'P' && Number(candidate.quantity) > 0)
  const hasShortPut = (right === 'P' && quantity < 0)
    || sameContractGroup.some((candidate) => normalizeRight(candidate.optionRight) === 'P' && Number(candidate.quantity) < 0)

  if (hasLongCall && hasShortPut) return 'SYNT_LONG'
  if (hasShortCall && hasLongPut) return 'SYNT_SHORT'
  if (right === 'C' && quantity < 0) return 'SHORT_CALL'
  if (right === 'P' && quantity < 0) return 'SHORT_PUT'
  if (right === 'C' && quantity > 0) return 'LONG_CALL'
  if (right === 'P' && quantity > 0) return 'LONG_PUT'
  return 'OTHER'
}

export function assignOptionStrategies(positions) {
  return positions.map((position) => ({
    ...position,
    strategy: strategyForPosition(position, positions),
  }))
}
