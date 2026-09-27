const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const round = (value) => Number(value.toFixed(2))
const date = (trade) => (trade.dateTime || trade.date || '').slice(0, 10)
const key = (trade) => `${trade.accountId || ''}|${trade.conid}`
const multiplier = (trade) => number(trade.multiplier) || (trade.assetCategory === 'OPT' ? 100 : 1)

// EAE and Trades often describe the same execution. Match quantities, including
// split executions, before adding any missing event quantity to the ledger.
export function mergeOptionEvents(trades, events) {
  const result = trades.map((trade) => ({ ...trade }))
  const used = new Map()
  const seen = new Set()
  for (const event of events) {
    if (!event.conid || !event.date || !['OPT', 'STK'].includes(event.assetCategory)) continue
    if (!['Assignment', 'Exercise', 'Expiration', 'Buy', 'Sell'].includes(event.transactionType)) continue
    const identity = event.tradeID ? `${event.accountId || ''}|${event.tradeID}` : JSON.stringify(event)
    if (seen.has(identity)) continue
    seen.add(identity)
    let remaining = Math.abs(number(event.quantity))
    for (const trade of result) {
      if (key(trade) !== key(event) || date(trade) !== date(event)
        || Math.sign(number(trade.quantity)) !== Math.sign(number(event.quantity))
        || number(trade.tradePrice) !== number(event.tradePrice)) continue
      const available = Math.abs(number(trade.quantity)) - (used.get(trade) || 0)
      const matched = Math.min(remaining, available)
      if (matched <= 0) continue
      trade.optionEvent = event.transactionType
      used.set(trade, (used.get(trade) || 0) + matched)
      remaining -= matched
      if (remaining < 1e-8) break
    }
    if (remaining > 1e-8) {
      const trade = {
        ...event,
        dateTime: event.date,
        dateOnlyEvent: true,
        quantity: remaining * Math.sign(number(event.quantity)),
        openCloseIndicator: event.assetCategory === 'OPT' || event.transactionType === 'Sell' ? 'C' : 'O',
        fifoPnlRealized: event.realizedPnl === undefined ? undefined : number(event.realizedPnl) * remaining / Math.abs(number(event.quantity)),
        optionEvent: event.transactionType,
      }
      result.push(trade)
      used.set(trade, remaining)
    }
  }
  // EAE contains a date, not an execution time. Shares delivered that day must
  // exist before intraday disposals; date-only closures follow timed trades.
  // Preserve the true order of timed executions (including same-day reopenings).
  const order = (trade) => trade.dateOnlyEvent
    ? (trade.assetCategory === 'STK' && trade.openCloseIndicator === 'O' ? -1 : 1)
    : 0
  return result.sort((a, b) => date(a).localeCompare(date(b)) || order(a) - order(b)
    || (a.dateTime || '').localeCompare(b.dateTime || ''))
}

// FIFO realisations are emitted at each close, including partial closes. Opening
// cash flows and fees stay with the open lot until that quantity is disposed of.
export function realizedResults(trades) {
  const results = []
  const exerciseCosts = []
  for (const asset of ['OPT', 'STK']) {
    const lotsByContract = new Map()
    for (const trade of trades.filter((item) => item.assetCategory === asset)) {
      const quantity = Math.abs(number(trade.quantity))
      if (!quantity || !trade.conid || !date(trade)) continue
      const sign = Math.sign(number(trade.quantity))
      const price = number(trade.tradePrice) * multiplier(trade)
      const fee = -number(trade.ibCommission) / quantity
      const lots = lotsByContract.get(key(trade)) || []
      lotsByContract.set(key(trade), lots)
      const transfer = asset === 'STK' ? exerciseCosts.filter((cost) =>
        cost.date === date(trade) && cost.symbol === (trade.underlyingSymbol || trade.symbol)
        && cost.strike === number(trade.tradePrice) && cost.sign === sign,
      ) : []
      let exerciseCost = 0
      let shares = quantity
      for (const cost of transfer) {
        const matched = Math.min(shares, cost.remaining)
        exerciseCost += matched * cost.perShare
        cost.remaining -= matched
        shares -= matched
      }
      if (trade.openCloseIndicator === 'O') {
        lots.push({ remaining: quantity, sign, price, fee: fee + exerciseCost / quantity, date: date(trade) })
        continue
      }
      if (trade.openCloseIndicator !== 'C') continue
      let remaining = quantity
      const portions = []
      for (const lot of lots) {
        if (lot.sign !== -sign || lot.remaining < 1e-8 || remaining < 1e-8) continue
        const matched = Math.min(remaining, lot.remaining)
        portions.push({
          quantity: matched, openedAt: lot.date, openingValue: lot.price * matched,
          received: lot.sign < 0 ? lot.price * matched : price * matched,
          buyback: lot.sign < 0 ? price * matched : lot.price * matched,
          commission: (lot.fee + fee) * matched,
        })
        lot.remaining -= matched
        remaining -= matched
      }
      const received = portions.reduce((sum, portion) => sum + portion.received, 0)
      const buyback = portions.reduce((sum, portion) => sum + portion.buyback, 0)
      const commission = portions.reduce((sum, portion) => sum + portion.commission, 0) + exerciseCost
      if (remaining > 1e-8 && (portions.length > 0 || trade.fifoPnlRealized === undefined
        || trade.fifoPnlRealized === '' || !Number.isFinite(Number(trade.fifoPnlRealized))
        || ['Assignment', 'Exercise'].includes(trade.optionEvent))) {
        throw new Error(`Onvoldoende openingshistorie voor ${trade.conid} op ${date(trade)}. Importeer eerdere Flex-trades om het gerealiseerde resultaat betrouwbaar te berekenen.`)
      }
      // IBKR FIFO P/L already includes commissions. Never subtract them twice.
      const historicalNet = remaining > 1e-8 ? number(trade.fifoPnlRealized) * remaining / quantity : 0
      const net = received - buyback - commission + historicalNet
      if (asset === 'OPT' && sign < 0 && trade.optionEvent === 'Exercise') {
        exerciseCosts.push({ date: date(trade), symbol: trade.underlyingSymbol || trade.symbol,
          strike: number(trade.strike), sign: trade.putCall === 'P' ? -1 : 1,
          remaining: quantity * multiplier(trade), perShare: -net / (quantity * multiplier(trade)) })
        continue
      }
      const openedAt = remaining < 1e-8 && portions.length ? portions.map((portion) => portion.openedAt).sort()[0] : null
      const openingValue = openedAt ? portions.reduce((sum, portion) => sum + portion.openingValue, 0) : null
      results.push({
        conid: trade.conid, symbol: trade.underlyingSymbol || trade.symbol || trade.conid,
        name: trade.description || trade.underlyingSymbol || trade.symbol || trade.conid,
        optionRight: trade.putCall || trade.subCategory || null,
        strike: trade.strike ? number(trade.strike) : null, expiry: trade.expiry || null,
        direction: sign > 0 ? 'short' : 'long', quantity, openedAt, closedAt: date(trade), openingValue,
        category: asset === 'STK' ? 'stockSales' : sign > 0 ? 'premium' : 'longOptionSales',
        received, buyback, commission, historicalNet, profit: net,
      })
    }
  }
  return results
}

export function premiumSummary(results) {
  const premiums = results.filter((result) => result.category === 'premium')
  const sum = (field) => round(premiums.reduce((total, result) => total + result[field], 0))
  const historicalNet = sum('historicalNet')
  return { received: sum('received'), buyback: sum('buyback'), commission: sum('commission'),
    net: sum('profit'), ...(premiums.some((result) => result.openedAt === null) ? { historicalNet } : {}) }
}

export function tradingResult(results, period) {
  const selected = results.filter((result) => result.closedAt.startsWith(period))
  const total = (category) => round(selected.filter((result) => result.category === category).reduce((sum, result) => sum + result.profit, 0))
  const premium = total('premium')
  const stockSales = total('stockSales')
  return { premium, stockSales, value: round(premium + stockSales) }
}

export function closedOptionTrades(results) {
  const counts = new Map()
  return results.filter((result) => result.category !== 'stockSales').map((result) => {
    const { category, received, buyback, commission, historicalNet, ...trade } = result
    const count = (counts.get(trade.conid) || 0) + 1
    counts.set(trade.conid, count)
    const daysHeld = trade.openedAt ? Math.round((Date.parse(trade.closedAt) - Date.parse(trade.openedAt)) / 86400000) : null
    const profitPercentage = trade.openingValue ? Number((trade.profit / trade.openingValue * 100).toFixed(1)) : null
    return { ...trade, profit: round(trade.profit), openingValue: trade.openingValue === null ? null : round(trade.openingValue),
      id: `${trade.conid}-${count}`, daysHeld, profitPercentage,
      annualizedPercentage: profitPercentage === null ? null : Number((profitPercentage * 365 / Math.max(1, daysHeld)).toFixed(1)) }
  }).sort((a, b) => `${b.closedAt}${b.id}`.localeCompare(`${a.closedAt}${a.id}`))
}
