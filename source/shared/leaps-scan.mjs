import { daysToExpiry, ivRank } from './csp-scan.mjs'

export function normalizeShortlist(values) {
  if (!Array.isArray(values) || values.length > 50) throw new Error('Gebruik maximaal 50 tickers.')
  const symbols = values.map(value => {
    if (typeof value !== 'string') throw new Error('Ongeldige ticker.')
    const symbol = value.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9. -]{0,19}$/.test(symbol)) throw new Error(`Ongeldige ticker: ${symbol}`)
    return symbol
  })
  return [...new Set(symbols)]
}

export function ivMetrics(current, bars, today, { inclusive = false } = {}) {
  const ivr = ivRank(current, bars, today)
  if (ivr === null) return null
  const history = bars.filter(bar => {
    const age = daysToExpiry(bar.date, today)
    return age >= -366 && age <= 0 && Number.isFinite(bar.close) && bar.close > 0 && bar.close < 10
  })
  return { ivr, ivPercentile: history.filter(bar => (inclusive ? bar.close <= current : bar.close < current)).length / history.length * 100 }
}

export function putReturnMetrics({ strike, bid, underlyingPrice, dte }) {
  if (![strike, bid, underlyingPrice, dte].every(Number.isFinite) || strike <= 0 || bid < 0 || bid >= strike || underlyingPrice <= 0 || dte <= 0) return null
  const breakEven = strike - bid
  const returnIfExpired = bid / breakEven * 100
  return {
    decreaseToBreakEven: (breakEven / underlyingPrice - 1) * 100,
    returnIfExpired,
    returnAnnualized: returnIfExpired * 365 / dte,
  }
}

export function leapPut(quote, today) {
  const { strike, underlyingPrice, delta, bid, ask, multiplier } = quote
  const dte = daysToExpiry(quote.expiry, today)
  const absoluteDelta = Math.abs(delta)
  if (![strike, underlyingPrice, delta, bid, ask, multiplier, dte, quote.ivr, quote.ivPercentile].every(Number.isFinite)
    || quote.right !== 'P' || quote.currency !== 'USD' || multiplier !== 100 || delta >= 0
    || absoluteDelta < .10 - 1e-8 || absoluteDelta > .15 + 1e-8 || strike <= 0 || strike >= underlyingPrice
    || bid <= 0 || ask < bid || bid >= strike || quote.ivr <= 40 || quote.ivr > 100 || quote.ivPercentile <= 50 || quote.ivPercentile > 100
    || !((dte >= 30 && dte <= 50) || (dte >= 300 && dte <= 700))) return null
  const premium = bid * 100, collateral = strike * 100, breakEven = strike - bid
  return { ...quote, id: `${quote.symbol}:${quote.expiry}:${strike}:${quote.tradingClass ?? quote.symbol}`,
    dte, absoluteDelta, premium, collateral, breakEven, ...putReturnMetrics({ strike, bid, underlyingPrice, dte }), buffer: (1 - breakEven / underlyingPrice) * 100,
    annualizedYield: premium / collateral * 365 / dte * 100, exitPrice: bid / 2 }
}

export function compareLeaps(rows, tolerance = .02) {
  const short = rows.filter(row => row.dte >= 30 && row.dte <= 50)
  return rows.filter(row => row.dte >= 300 && row.dte <= 700).map(long => {
    const comparable = short.filter(row => row.symbol === long.symbol && Math.abs(row.absoluteDelta - long.absoluteDelta) <= tolerance + 1e-8)
      .sort((a, b) => b.annualizedYield - a.annualizedYield)
    const reference = comparable[0]
    return { ...long, reference: reference ?? null, qualifies: !!reference && long.annualizedYield > reference.annualizedYield,
      yieldAdvantage: reference ? long.annualizedYield - reference.annualizedYield : null }
  }).sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || b.annualizedYield - a.annualizedYield)
}
