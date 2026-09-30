const round = (value) => Number(value.toFixed(2))
const validMoney = (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e100

export function normalizeExecution(contract, execution) {
  const match = String(execution.time || '').match(/^(\d{4})-?(\d{2})-?(\d{2})\s+(\d{2}:\d{2}:\d{2})/)
  if (!match || !execution.execId || !execution.acctNumber || !['BOT', 'SLD'].includes(execution.side)
    || !['OPT', 'STK'].includes(contract.secType) || !Number.isFinite(execution.shares) || execution.shares <= 0
    || !Number.isFinite(execution.price)) return null
  return {
    execId: execution.execId, account: execution.acctNumber, conid: String(contract.conId),
    dateTime: `${match[1]}-${match[2]}-${match[3]}T${match[4]}`,
    quantity: execution.shares * (execution.side === 'BOT' ? 1 : -1), price: execution.price,
    symbol: contract.symbol, name: contract.localSymbol || contract.symbol, assetCategory: contract.secType,
    currency: contract.currency, multiplier: Number(contract.multiplier) || (contract.secType === 'OPT' ? 100 : 1),
    optionRight: contract.right || null, strike: contract.strike ?? null,
    expiry: contract.lastTradeDateOrContractMonth || null,
  }
}

// Corrections replace the earlier execution whose ID differs only after the last dot.
export function mergeExecutions(previous = [], incoming = []) {
  const ledger = new Map()
  for (const execution of [...previous, ...incoming]) {
    const key = `${execution.account}|${execution.execId.replace(/\.[^.]+$/, '')}`
    const existing = ledger.get(key)
    if (existing && existing.execId.localeCompare(execution.execId, undefined, { numeric: true }) > 0) continue
    ledger.set(key, existing?.execId === execution.execId ? { ...existing, ...execution } : execution)
  }
  return [...ledger.values()].sort((a, b) => a.dateTime.localeCompare(b.dateTime) || a.execId.localeCompare(b.execId))
}

export function gatewayClosures(summary, snapshot) {
  const cutoff = summary.tradesThroughDate || summary.balance.toDate
  const executions = mergeExecutions([], snapshot.executions).filter((execution) =>
    (!snapshot.account || execution.account === snapshot.account)
    && execution.dateTime.slice(0, 10) > cutoff && execution.currency === (summary.premiumCurrency || summary.currency))
  const positions = new Map(snapshot.positions.map((position) => [position.conid, position.quantity]))
  // Recover the position before these executions from the final Gateway position.
  for (const execution of executions) positions.set(execution.conid, (positions.get(execution.conid) || 0) - execution.quantity)
  const metadata = new Map((summary.optionHoldings || []).filter((holding) =>
    holding.quantity === positions.get(holding.conid)).map((holding) => [holding.conid, holding]))
  const closures = []
  let pending = 0
  for (const execution of executions) {
    const before = positions.get(execution.conid) || 0
    const reportedClose = validMoney(execution.realizedPNL)
    const closingQuantity = before * execution.quantity < 0 ? Math.min(Math.abs(before), Math.abs(execution.quantity))
      : reportedClose ? Math.abs(execution.quantity) : 0
    const after = before + execution.quantity
    const opening = metadata.get(execution.conid)
    if (closingQuantity > 0 && execution.assetCategory === 'OPT') {
      if (!validMoney(execution.realizedPNL)) {
        pending += 1
      } else {
        const openedAt = opening?.openedAt || null
        const openingValue = opening?.averageOpenPrice == null ? null : opening.averageOpenPrice * execution.multiplier * closingQuantity
        const profit = round(execution.realizedPNL)
        const daysHeld = openedAt ? Math.round((Date.parse(execution.dateTime.slice(0, 10)) - Date.parse(openedAt)) / 86400000) : null
        const profitPercentage = openingValue ? Number((profit / openingValue * 100).toFixed(1)) : null
        closures.push({
          id: `gateway-${execution.account}-${execution.execId}`, conid: execution.conid,
          symbol: execution.symbol, name: execution.name, optionRight: execution.optionRight,
          strike: execution.strike, expiry: execution.expiry, direction: execution.quantity > 0 ? 'short' : 'long',
          quantity: closingQuantity, openedAt, closedAt: execution.dateTime.slice(0, 10),
          openingValue: openingValue === null ? null : round(openingValue), profit, daysHeld, profitPercentage,
          annualizedPercentage: profitPercentage === null ? null : Number((profitPercentage * 365 / Math.max(1, daysHeld)).toFixed(1)),
        })
      }
    }
    // Only use measured opening metadata; a mixed or enlarged position has no exact lot basis here.
    if (before === 0 || before * after < 0) metadata.set(execution.conid, {
      openedAt: execution.dateTime.slice(0, 10), averageOpenPrice: execution.price,
    })
    else if (before * execution.quantity > 0 || after === 0) metadata.delete(execution.conid)
    positions.set(execution.conid, after)
  }
  return { closures, pending }
}
