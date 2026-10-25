import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { stockKey } from './blocked-stocks.mjs'
import { normalizeSector, sectorMetadata } from '../shared/stock-sector.mjs'

export const SECTOR_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=0&download=true'
const WEEK = 7 * 86400000, DAY = 86400000
export async function createStockSectors(path, { fetcher = fetch, now = Date.now, enabled = true } = {}) {
  let records = {}, bulkAt = 0, bulkAttempt = -Infinity, yahooLimitedUntil = 0, refreshing, warming, writing = Promise.resolve(), warning
  try {
    const data = JSON.parse(await readFile(path, 'utf8'))
    if (data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw Error('Ongeldige sectorcache.')
    for (const [symbol, value] of Object.entries(data.records)) {
      try {
        if (stockKey(symbol) === symbol && Number.isFinite(Date.parse(value.sectorAsOf)) && Date.parse(value.sectorAsOf) <= now()) records[symbol] = { ...value, sector: normalizeSector(value.sector) }
      } catch { /* Invalid auxiliary metadata is refreshed instead of guessed. */ }
    }
    bulkAt = Number.isFinite(data.bulkAt) && data.bulkAt <= now() ? data.bulkAt : 0
  } catch (error) { if (error.code !== 'ENOENT') warning = 'Sectorcache onleesbaar; sectoren worden opnieuw opgehaald.' }
  const get = symbol => sectorMetadata(records[stockKey(symbol)])
  const fresh = record => record && now() - Date.parse(record.sectorAsOf) < (record.sector ? WEEK : DAY)
  const persist = async () => {
    const data = JSON.stringify({ version: 1, bulkAt, records })
    const operation = writing.then(async () => {
      await mkdir(dirname(path), { recursive: true }); await writeFile(path + '.tmp', data, { mode: 0o600 }); await rename(path + '.tmp', path)
    })
    writing = operation.catch(() => {})
    try { await operation; warning = undefined } catch { warning = 'Sectorgegevens konden niet worden opgeslagen; bestaande scanresultaten blijven bruikbaar.' }
  }
  async function json(url, signal) {
    const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
    if (!response.ok) throw Object.assign(Error(`Sectorbron HTTP ${response.status}`), { status: response.status })
    return response.json()
  }
  async function refresh(signal) {
    if (refreshing) return refreshing
    if (!enabled || now() - bulkAt < WEEK || now() - bulkAttempt < 3600000) return
    bulkAttempt = now()
    refreshing = (async () => {
      try {
        const data = await json(SECTOR_URL, signal), rows = data.data?.rows || data.data?.table?.rows
        if (!Array.isArray(rows) || !rows.length) throw Error('Geen sectorlijst beschikbaar.')
        const next = []
        for (const row of rows) {
          const sector = normalizeSector(row.sector)
          if (!sector) continue
          try { next.push([stockKey(row.symbol), { sector, sectorSource: 'Nasdaq', sectorAsOf: new Date(now()).toISOString() }]) } catch { /* Ignore unsupported instrument suffixes. */ }
        }
        if (!next.length) throw Error('Geen bruikbare sectorclassificaties.')
        for (const [symbol, value] of next) records[symbol] = value
        bulkAt = now(); await persist()
      } catch { /* Sector metadata never rejects an otherwise valid stock. */ }
      finally { refreshing = undefined }
    })()
    return refreshing
  }
  async function lookup(symbol, signal) {
    const key = stockKey(symbol)
    await refresh(signal)
    signal?.throwIfAborted()
    if (!enabled || fresh(records[key]) || now() < yahooLimitedUntil) return get(key)
    try {
      const data = await json(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(key)}&quotesCount=5&newsCount=0`, signal)
      const quote = (data.quotes || []).find(row => {
        try { return row.quoteType === 'EQUITY' && stockKey(row.symbol) === key } catch { return false }
      })
      const sector = normalizeSector(quote?.sector)
      // A missing result must not erase a previously known classification.
      if (sector || !records[key]?.sector) records[key] = { sector, sectorSource: sector ? 'Yahoo Finance' : undefined, sectorAsOf: new Date(now()).toISOString() }
      await persist()
    } catch (error) {
      signal?.throwIfAborted()
      if (error.status !== 404) yahooLimitedUntil = now() + 3600000
    }
    return get(key)
  }
  return {
    get, refresh, lookup,
    decorate: row => ({ ...row, ...get(row.symbol) }),
    warning: () => warning,
    async rememberIbkr(symbol, details) {
      const key = stockKey(symbol), sector = normalizeSector(details.industry)
      if (sector && (!records[key]?.sector || !fresh(records[key]))) {
        records[key] = { sector, sectorSource: 'IBKR', sectorAsOf: new Date(now()).toISOString() }
        await persist()
      }
      return get(key)
    },
    warm(rows) {
      if (!enabled || warming || !rows.length) return warming
      warming = (async () => {
        try {
          await refresh()
          const symbols = [...new Set(rows.map(row => stockKey(row.symbol)))].filter(symbol => !fresh(records[symbol]))
          for (let i = 0; i < symbols.length; i += 3) {
            await Promise.allSettled(symbols.slice(i, i + 3).map(symbol => lookup(symbol)))
            if (i + 3 < symbols.length && now() >= yahooLimitedUntil) await new Promise(resolve => setTimeout(resolve, 500))
          }
        } finally { warming = undefined }
      })().catch(() => {})
      return warming
    },
  }
}
