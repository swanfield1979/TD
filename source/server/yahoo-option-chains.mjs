import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { daysToExpiry, scanDate } from '../shared/csp-scan.mjs'

const valid = value => typeof value === 'number' && Number.isFinite(value)
const stamp = seconds => valid(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined
const expiryDate = seconds => stamp(seconds)?.slice(0, 10).replaceAll('-', '')
export function yahooSymbol(symbol) {
  if (typeof symbol !== 'string' || !/^[A-Z][A-Z0-9]{0,9}(?:[ .-][A-Z])?$/.test(symbol)) throw Error('Ongeldige Amerikaanse aandelenticker.')
  return symbol.replace(/[ .]/g, '-')
}
export function normalizeYahooOption(row, symbol, expiry, right, fetchedAt) {
  const contract = /^([A-Z][A-Z0-9.-]*)(\d{6})([CP])(\d{8})$/.exec(row?.contractSymbol || '')
  if (!contract || contract[1].replace(/[.-]/g, '') !== yahooSymbol(symbol).replaceAll('-', '')
    || '20' + contract[2] !== expiry || contract[3] !== right || row.contractSize !== 'REGULAR' || row.currency !== 'USD'
    || !valid(row.strike) || row.strike <= 0 || Math.abs(Number(contract[4]) / 1000 - row.strike) > 1e-6) return null
  const count = value => valid(value) && value >= 0 ? value : null
  return { contractSymbol: row.contractSymbol, symbol, expiry, right, strike: row.strike, currency: 'USD', multiplier: 100,
    bid: count(row.bid), ask: count(row.ask), lastPrice: count(row.lastPrice), volume: count(row.volume),
    openInterest: count(row.openInterest), impliedVolatility: valid(row.impliedVolatility) && row.impliedVolatility > 0 ? row.impliedVolatility : null,
    lastTradeAt: stamp(row.lastTradeDate), fetchedAt, source: 'Yahoo Finance' }
}

// One reusable anonymous session. No proxy rotation, login or retries around access/rate limits.
export function createYahooOptionClient({ directory, fetcher = fetch, now = Date.now, wait = (ms, signal) => sleep(ms, undefined, { signal }), interval = 350, ttl = 600000 } = {}) {
  const cookies = new Map(), memory = new Map()
  let crumb, session, tail = Promise.resolve(), lastRequest = -Infinity
  const request = async (url, signal) => {
    const turn = tail.then(async () => {
      signal?.throwIfAborted()
      const delay = lastRequest + interval - now()
      if (delay > 0) await wait(delay, signal)
      signal?.throwIfAborted(); lastRequest = now()
    })
    tail = turn.catch(() => {}); await turn
    const response = await fetcher(url, { headers: { 'User-Agent': 'TradingMonitor/0.42.0', Accept: 'application/json', ...(cookies.size ? { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } : {}) },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) })
    for (const cookie of response.headers.getSetCookie?.() || []) {
      const pair = cookie.split(';')[0], index = pair.indexOf('=')
      if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    if ([401, 403, 429].includes(response.status)) {
      if (response.status !== 429) { session = undefined; crumb = undefined; cookies.clear() }
      throw Object.assign(Error(`Yahoo Finance is tijdelijk niet toegankelijk (HTTP ${response.status}). Wacht en hervat of kies IBKR.`), { code: 'YAHOO_ACCESS', limited: true })
    }
    return response
  }
  async function initialize(signal) {
    if (!session) session = (async () => {
      // fc.yahoo.com commonly returns 404 while setting the normal anonymous-session cookie.
      const cookieResponse = await request('https://fc.yahoo.com', signal)
      await cookieResponse.arrayBuffer()
      if (!cookieResponse.ok && cookieResponse.status !== 404) throw Error('Yahoo-sessie kon niet worden gestart.')
      const response = await request('https://query1.finance.yahoo.com/v1/test/getcrumb', signal)
      const text = (await response.text()).trim()
      if (!response.ok || !text || text.length > 128 || /[<>\r\n]/.test(text)) throw Error('Yahoo gaf geen geldige sessiesleutel terug.')
      crumb = text
    })().catch(error => { session = undefined; throw error })
    await session
  }
  async function load(symbol, expiration, signal, counters) {
    const key = `${yahooSymbol(symbol)}:${expiration || 'first'}`
    const path = directory && join(directory, createHash('sha256').update(key).digest('hex') + '.json')
    let cached = memory.get(key)
    if (!cached && path) {
      try { cached = JSON.parse(await readFile(path, 'utf8')) } catch { /* Refresh a missing or damaged raw cache. */ }
    }
    if (cached?.key === key && valid(cached.at) && now() >= cached.at && now() - cached.at < ttl && cached.result?.quote) { counters.cacheHits++; return { ...cached.result, fetchedAt: new Date(cached.at).toISOString() } }
    await initialize(signal)
    const url = new URL(`https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(yahooSymbol(symbol))}`)
    url.searchParams.set('crumb', crumb)
    if (expiration) url.searchParams.set('date', String(expiration))
    const response = await request(url, signal); counters.requests++
    if (!response.ok) throw Error(`Yahoo-optiechain niet beschikbaar (HTTP ${response.status}).`)
    const text = await response.text()
    if (text.length > 10 * 1024 * 1024) throw Error('Yahoo-optieantwoord is te groot.')
    const data = JSON.parse(text)
    const result = data.optionChain?.result?.[0]
    if (data.optionChain?.error || !result?.quote || !Array.isArray(result.expirationDates) || !Array.isArray(result.options)
      || result.quote.symbol !== yahooSymbol(symbol) || result.quote.currency !== 'USD' || result.quote.quoteType !== 'EQUITY'
      || !valid(result.quote.regularMarketPrice) || result.quote.regularMarketPrice <= 0) throw Error('Yahoo gaf geen geldige USD-aandelenchain terug.')
    const record = { key, at: now(), result }
    memory.set(key, record)
    if (memory.size > 200) memory.delete(memory.keys().next().value)
    if (path) { await mkdir(directory, { recursive: true }); await writeFile(path + '.tmp', JSON.stringify(record), { mode: 0o600 }); await rename(path + '.tmp', path) }
    return { ...result, fetchedAt: new Date(record.at).toISOString() }
  }
  return {
    async scrape(symbol, { minDte = 40, maxDte = 100, signal } = {}) {
      yahooSymbol(symbol)
      if (!Number.isInteger(minDte) || !Number.isInteger(maxDte) || minDte < 1 || maxDte > 730 || minDte > maxDte) throw Error('Gebruik een DTE-bereik van 1–730 dagen.')
      const started = now(), today = scanDate(new Date(started)), counters = { requests: 0, cacheHits: 0 }
      const first = await load(symbol, undefined, signal, counters)
      const expirations = [...new Set(first.expirationDates)].filter(value => valid(value) && daysToExpiry(expiryDate(value), today) >= minDte && daysToExpiry(expiryDate(value), today) <= maxDte).sort((a, b) => a - b)
      const chains = []
      // Two expirations in flight; request starts still pass through one paced queue.
      for (let offset = 0; offset < expirations.length; offset += 2) {
        signal?.throwIfAborted()
        const batch = await Promise.allSettled(expirations.slice(offset, offset + 2).map(async value => {
          const response = first.options.some(option => option.expirationDate === value) ? first : await load(symbol, value, signal, counters)
          const option = response.options.find(item => item.expirationDate === value)
          if (!option || !Array.isArray(option.puts) || !Array.isArray(option.calls)) throw Error('Yahoo-expiratie is onvolledig; geen complete chain beschikbaar.')
          const fetchedAt = response.fetchedAt, expiry = expiryDate(value)
          return { expiry, fetchedAt, calls: option.calls.map(row => normalizeYahooOption(row, symbol, expiry, 'C', fetchedAt)).filter(Boolean),
            puts: option.puts.map(row => normalizeYahooOption(row, symbol, expiry, 'P', fetchedAt)).filter(Boolean) }
        }))
        const failed = batch.find(item => item.status === 'rejected')
        if (failed) throw failed.reason
        chains.push(...batch.map(item => item.value))
      }
      signal?.throwIfAborted()
      return { symbol, source: 'Yahoo Finance', underlyingPrice: first.quote.regularMarketPrice, underlyingAt: stamp(first.quote.regularMarketTime),
        fetchedAt: new Date(Math.min(Date.parse(first.fetchedAt), ...chains.map(chain => Date.parse(chain.fetchedAt)))).toISOString(), generatedAt: new Date(now()).toISOString(), minDte, maxDte, chains, ...counters, elapsedMs: now() - started }
    },
  }
}

export function yahooSpreadContracts(snapshot, filters, limit = 20) {
  const price = snapshot.underlyingPrice, pairs = []
  if (price < filters.minPrice || price > filters.maxPrice) return []
  for (const chain of snapshot.chains) {
    const puts = chain.puts.filter(put => put.strike < price && put.strike > 0 && valid(put.bid) && valid(put.ask) && put.bid >= 0 && put.ask > 0 && put.ask >= put.bid && put.ask - put.bid <= filters.maxQuoteSpread + 1e-8)
    for (const short of puts) {
      if ((1 - short.strike / price) * 100 + 1e-8 < filters.minBuffer) continue
      for (const long of puts) {
        const width = short.strike - long.strike, credit = short.bid - long.ask
        if (width <= 0 || credit <= 0 || credit >= width || credit * 100 + 1e-8 < filters.minProfit || (width - credit) * 100 > filters.maxLoss + 1e-8) continue
        pairs.push({ short, long, rank: credit / (width - credit) })
      }
    }
  }
  pairs.sort((a, b) => b.rank - a.rank || a.short.expiry.localeCompare(b.short.expiry) || b.short.strike - a.short.strike || b.long.strike - a.long.strike)
  return [...new Map(pairs.slice(0, limit).flatMap(pair => [pair.short, pair.long]).map(put => [`${put.expiry}:${put.strike}`, { expiry: put.expiry, strike: put.strike }])).values()]
}
