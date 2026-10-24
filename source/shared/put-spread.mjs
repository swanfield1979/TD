import { daysToExpiry } from './csp-scan.mjs'

export const spreadDefaults = Object.freeze({ minAvgOptionVolume: 5000, minPrice: 5, maxPrice: 150, minDte: 40, maxDte: 100, minIvr: 20, minBuffer: 25, minProfit: 15, maxLoss: 1000, minOtm: 70, maxQuoteSpread: 1 })
export function spreadFilters(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Ongeldige spreadfilters.')
  const filters = { ...spreadDefaults }
  for (const key of Object.keys(filters)) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'number' || !Number.isFinite(input[key])) throw Error('Vul alle filters met geldige getallen in.')
      filters[key] = input[key]
    }
  }
  if (!Number.isInteger(filters.minAvgOptionVolume) || filters.minAvgOptionVolume < 0 || filters.minPrice < 0 || filters.maxPrice <= 0 || filters.minPrice > filters.maxPrice || filters.minDte < 1 || filters.maxDte > 730 || filters.minDte > filters.maxDte || !Number.isInteger(filters.minDte) || !Number.isInteger(filters.maxDte)
    || filters.minIvr < 0 || filters.minIvr > 100 || filters.minBuffer < 0 || filters.minBuffer >= 100
    || filters.minProfit < 0 || filters.maxLoss <= 0 || filters.maxLoss > 100000 || filters.minOtm < 0 || filters.minOtm > 100 || filters.maxQuoteSpread < 0)
    throw Error('Controleer de filters: DTE 1–730, percentages 0–100 en een positief maximaal verlies (tot $100.000).')
  return filters
}

export function bullPutSpread(short, long, today) {
  if (!short || !long || !short.symbol || short.symbol !== long.symbol || short.expiry !== long.expiry || short.tradingClass !== long.tradingClass
    || short.right !== 'P' || long.right !== 'P' || short.currency !== 'USD' || long.currency !== 'USD' || short.multiplier !== 100 || long.multiplier !== 100) return null
  if (![short.strike, long.strike, short.bid, short.ask, long.bid, long.ask, short.underlyingPrice, short.ivr, short.delta, long.delta].every(Number.isFinite)
    || long.strike <= 0 || short.strike <= long.strike || short.strike >= short.underlyingPrice
    || short.bid <= 0 || long.bid < 0 || long.ask <= 0 || short.ask < short.bid || long.ask < long.bid
    || short.delta >= 0 || short.delta < -1 || long.delta >= 0 || long.delta < -1 || short.ivr < 0 || short.ivr > 100) return null
  const dte = daysToExpiry(short.expiry, today)
  const credit = short.bid - long.ask
  const width = short.strike - long.strike
  if (!Number.isFinite(dte) || dte <= 0 || credit <= 0 || credit >= width) return null
  const maxProfit = credit * 100, maxLoss = (width - credit) * 100
  return { id: `${short.symbol}:${short.expiry}:${short.tradingClass}:${short.strike}:${long.strike}`, symbol: short.symbol,
    expiry: short.expiry, tradingClass: short.tradingClass, dte, underlyingPrice: short.underlyingPrice, ivr: short.ivr,
    shortStrike: short.strike, longStrike: long.strike, shortBid: short.bid, shortAsk: short.ask, longBid: long.bid, longAsk: long.ask,
    credit, maxProfit, maxLoss, breakEven: short.strike - credit, returnOnRisk: maxProfit / maxLoss * 100,
    buffer: (1 - short.strike / short.underlyingPrice) * 100, otmProxy: (1 - Math.abs(short.delta)) * 100,
    avgOptionVolume: short.avgOptionVolume, avgOptionVolumeAt: short.avgOptionVolumeAt, dayOptionVolume: short.dayOptionVolume, dayOptionVolumeAt: short.dayOptionVolumeAt, volumeSource: short.volumeSource,
    ivSource: short.ivSource, ivAsOf: short.ivAsOf, cached: short.cached === true || long.cached === true, shortQuotedAt: short.quotedAt, longQuotedAt: long.quotedAt, shortDataType: short.marketDataType, longDataType: long.marketDataType }
}
export function selectSpreads(puts, today, input = {}) {
  const f = spreadFilters(input), groups = new Map(), rows = []
  for (const put of puts) {
    const key = `${put.symbol}:${put.expiry}:${put.tradingClass}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(put)
  }
  for (const group of groups.values()) for (const short of group) for (const long of group) {
    if (short.strike <= long.strike) continue
    const row = bullPutSpread(short, long, today)
    if (row && row.underlyingPrice >= f.minPrice && row.underlyingPrice <= f.maxPrice && row.dte >= f.minDte && row.dte <= f.maxDte && row.ivr >= f.minIvr && row.buffer + 1e-8 >= f.minBuffer
      && row.maxProfit + 1e-8 >= f.minProfit && row.maxLoss <= f.maxLoss + 1e-8 && row.otmProxy + 1e-8 >= f.minOtm
      && short.ask - short.bid <= f.maxQuoteSpread + 1e-8 && long.ask - long.bid <= f.maxQuoteSpread + 1e-8) rows.push(row)
  }
  return rows.sort((a, b) => b.returnOnRisk - a.returnOnRisk || a.id.localeCompare(b.id))
}
