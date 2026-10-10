export const scanDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now)

export function daysToExpiry(expiry, today) {
  const date = expiry.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
}

export function ivRank(current, bars, today) {
  const cutoff = Date.parse(`${today}T00:00:00Z`) - 366 * 86400000
  const history = bars.filter((bar) => {
    const date = bar.date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    return timestamp >= cutoff && timestamp <= Date.parse(`${today}T00:00:00Z`) && Number.isFinite(bar.close) && bar.close > 0 && bar.close < 10
  }).sort((a, b) => a.date.localeCompare(b.date))
  // Require a genuine one-year series, rather than ranking a few observations.
  if (!Number.isFinite(current) || current <= 0 || current >= 10 || history.length < 200) return null
  if (daysToExpiry(history[0].date, today) > -330 || daysToExpiry(history.at(-1).date, today) < -7) return null
  const low = Math.min(...history.map((bar) => bar.close))
  const high = Math.max(...history.map((bar) => bar.close))
  return high > low ? Math.max(0, Math.min(100, (current - low) / (high - low) * 100)) : null
}

export function cspCandidate(quote, today, discovery = false) {
  const { symbol, expiry, strike, underlyingPrice, delta, ivr, bid, ask, multiplier, right, currency } = quote
  const dte = daysToExpiry(expiry, today)
  if (![strike, underlyingPrice, delta, ivr, bid, ask, multiplier, dte].every(Number.isFinite)) return null
  const absoluteDelta = Math.abs(delta)
  const pop = (1 - absoluteDelta) * 100
  if (right !== 'P' || currency !== 'USD' || multiplier !== 100 || delta >= 0
    || strike <= 0 || dte < 35 || dte > 50 || absoluteDelta < 0.16 || absoluteDelta > 0.22
    || ivr <= 30 || ivr > 100 || strike >= underlyingPrice || pop <= 80 || bid <= 0 || ask < bid || bid >= strike
    || (discovery && (underlyingPrice < 10 || underlyingPrice > 50))) return null
  const premium = bid * multiplier
  const collateral = strike * multiplier
  const yieldPercentage = premium / collateral * 100
  return { ...quote, id: `${symbol}:${expiry}:${strike}:${quote.tradingClass ?? symbol}`, dte, absoluteDelta, pop, premium, collateral,
    yieldPercentage, annualizedYield: yieldPercentage * 365 / dte, breakEven: strike - bid }
}

export function sortCandidates(rows, sort = 'annualizedYield') {
  return [...rows].sort((a, b) => b[sort] - a[sort] || a.symbol.localeCompare(b.symbol) || a.strike - b.strike)
}
