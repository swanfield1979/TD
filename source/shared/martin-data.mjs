import { completedBars, nyTime } from './martin-selection.mjs'
export function parseSymbols(text) {
  const symbols = [...new Set(text.trim().split(/[\s,;]+/).filter(Boolean).map(s => s.toUpperCase()))]
  if (!symbols.length || symbols.some(s => !/^[A-Z0-9][A-Z0-9.^=-]{0,19}$/.test(s))) throw new Error('Gebruik tickers gescheiden door komma, spatie of nieuwe regel (geen CSV-kopregel)')
  return symbols
}
export async function download(symbol, now, options = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`
  const response = await fetch(url, { signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000), headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`)
  const result = (await response.json()).chart?.result?.[0]
  if (!result || result.meta.currency !== 'USD' || result.meta.instrumentType !== 'EQUITY') throw new Error('Geen USD-aandeel of ontbrekende data')
  const q = result.indicators?.quote?.[0]
  if (!q || !result.timestamp) throw new Error('OHLCV ontbreekt')
  const bars = completedBars(result.timestamp.map((t, i) => ({ date: nyTime(t * 1000).date, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] })), now)
  let premarket = null, premarketError = null
  if (options.premarket !== false) { const result = await downloadPremarket(symbol, now, options); premarket = result.premarket; premarketError = result.premarketError }
  return { symbol, bars, source: url, premarket, premarketError }
}
export async function downloadPremarket(symbol, now, options = {}) {
  let premarket = null, premarketError = null
  const clock = nyTime(now)
  if (clock.minutes >= 240 && clock.minutes < 570) {
    try {
      const intraday = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=5m&includePrePost=true`, { signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000), headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!intraday.ok) throw new Error(`Premarket HTTP ${intraday.status}`)
      const data = (await intraday.json()).chart?.result?.[0], quotes = data?.indicators?.quote?.[0]
      const candles = (data?.timestamp ?? []).map((t, i) => ({ time: t * 1000, price: quotes?.close?.[i], volume: quotes?.volume?.[i] })).filter(b => b.time + 5 * 60000 <= now && nyTime(b.time).date === clock.date && nyTime(b.time).minutes >= 240 && nyTime(b.time).minutes < 570)
      if (!candles.length || candles.some(b => !Number.isFinite(b.price) || b.price <= 0 || !Number.isFinite(b.volume) || b.volume < 0)) throw new Error('Geen complete premarketcandles')
      premarket = { asOf: new Date(candles.at(-1).time + 5 * 60000).toISOString(), price: candles.at(-1).price, volume: candles.reduce((sum, b) => sum + b.volume, 0) }
    } catch (e) { premarketError = e.message }
  }
  options.signal?.throwIfAborted()
  return { premarket, premarketError }
}
