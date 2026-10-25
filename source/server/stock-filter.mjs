import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { loadUsUniverse } from './martin-universe.mjs'
import { dailyCacheKey } from './martin-market-scan.mjs'
import { completedBars, nyTime } from '../shared/martin-selection.mjs'
import { createIbkrStockHistory } from './stock-history.mjs'

export function stockFilters(input = {}) {
  const filters = { minPrice: input.minPrice ?? 5, maxPrice: input.maxPrice ?? 150, minVolume: input.minVolume ?? 5_000_000 }
  if (Object.values(filters).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0) || filters.maxPrice <= 0 || filters.minPrice > filters.maxPrice) throw Error('Gebruik geldige koersgrenzen en een positief of nul dagvolume.')
  return filters
}
export function stockSnapshot(bars, now) {
  const last = completedBars(bars, now).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  if (!last || !/^\d{4}-\d{2}-\d{2}$/.test(last.date) || now - Date.parse(last.date + 'T00:00:00Z') > 7 * 86400000 || !(last.close > 0) || !Number.isFinite(last.close) || !Number.isFinite(last.volume) || last.volume < 0) throw Error('Geen recente volledige slotkoers en dagvolume beschikbaar.')
  return { price: last.close, volume: last.volume, asOf: last.date }
}
export async function yahooStockHistory(symbol, signal, fetcher = fetch) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
  const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!response.ok) throw Object.assign(Error(`Yahoo HTTP ${response.status}`), { limited: [401, 403, 429].includes(response.status) || response.status >= 500 })
  const result = (await response.json()).chart?.result?.[0]
  if (result?.meta?.currency !== 'USD' || result.meta.instrumentType !== 'EQUITY') throw Error('Geen ondersteund USD-aandeel.')
  const quote = result.indicators?.quote?.[0]
  return (result.timestamp ?? []).map((time, i) => ({ date: nyTime(time * 1000).date, close: quote?.close?.[i], volume: quote?.volume?.[i] }))
}
const initial = () => ({ state: 'idle', rows: [], observations: {}, failures: [], checked: 0, total: 0, cacheHits: 0, warnings: [] })

// Raw observations survive filter changes. The frozen result ID binds an option job
// to exactly the completed selection the user reviewed, without a 50-ticker limit.
export async function createStockFilter(directory, config, dependencies = {}) {
  const { now = Date.now, yahoo = yahooStockHistory, universe = loadUsUniverse, wait = (ms, signal) => sleep(ms, undefined, { signal }), brokerFactory = createIbkrStockHistory, blocked = () => false } = dependencies
  await mkdir(directory, { recursive: true })
  const path = join(directory, 'selection.json'), cachePath = join(directory, 'observations.json')
  let state = initial(), observations = {}, controller, saving = Promise.resolve(), storageError, active = false
  try {
    state = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(state.rows) || !Array.isArray(state.entries) || !Array.isArray(state.failures) || !state.observations || typeof state.state !== 'string') throw Error('Ongeldige aandelenlijst.')
    if (state.state === 'running') state.state = 'interrupted'
  } catch (error) { if (error.code !== 'ENOENT') storageError = 'Opgeslagen aandelenlijst is onleesbaar; controleer selection.json voordat je opnieuw opslaat.' }
  try { observations = JSON.parse(await readFile(cachePath, 'utf8')); if (!observations || Array.isArray(observations) || typeof observations !== 'object') observations = {} } catch { /* Recoverable raw cache; the saved selection remains independent. */ }
  const snapshot = () => ({ ...state, rows: state.rows.filter(row => !blocked(row.symbol)), blockedCount: state.rows.filter(row => blocked(row.symbol)).length, state: active ? 'running' : state.state, observations: undefined, entries: undefined, storageError, canResume: !active && ['cancelled', 'interrupted', 'paused', 'error'].includes(state.state) && state.checked < state.total && state.key === dailyCacheKey(now()) })
  const persist = async () => {
    const selected = JSON.stringify(state), raw = JSON.stringify(observations)
    const operation = saving.then(async () => {
      for (const [file, data] of [[cachePath, raw], [path, selected]]) { await writeFile(file + '.tmp', data, { mode: 0o600 }); await rename(file + '.tmp', file) }
    })
    saving = operation.catch(() => {})
    await operation
  }
  async function run() {
    const signal = controller.signal, broker = brokerFactory(config, signal)
    let brokerFailed = false, lastSaved = state.checked
    try {
      if (!state.entries.length) {
        const listing = await universe(signal)
        state.entries = listing.entries; state.total = state.entries.length
        state.universeUpdatedAt = listing.updatedAt
        await persist()
      }
      while (state.checked < state.total) {
        signal.throwIfAborted()
        if (state.key !== dailyCacheKey(now())) { state.state = 'paused'; state.message = 'Nieuwe beursdag of slotperiode; start een nieuwe aandelenfilter.'; break }
        const batch = state.entries.slice(state.checked, state.checked + 3)
        let network = false
        const results = await Promise.allSettled(batch.map(async entry => {
          const symbol = entry.symbol, cached = observations[symbol]
          if (blocked(symbol)) return { ...entry, blocked: true }
          if (cached?.key === state.key) {
            try { const value = stockSnapshot([{ date: cached.asOf, close: cached.price, volume: cached.volume }], now()); state.cacheHits++; return { ...entry, ...cached, ...value, cached: true } } catch { /* Refresh stale or invalid observations. */ }
          }
          network = true
          const value = stockSnapshot(await yahoo(symbol, signal), now())
          return { ...entry, ...value, key: state.key, source: 'Yahoo Finance', fetchedAt: new Date(now()).toISOString(), cached: false }
        }))
        // A source-wide rate limit pauses immediately rather than sending thousands
        // of fallback requests to IBKR. None of this batch is committed on pause.
        const limited = results.find(result => result.status === 'rejected' && result.reason.limited)
        if (limited) { state.state = 'paused'; state.message = 'Yahoo begrenst aanvragen of is tijdelijk onbereikbaar. Wacht en hervat de aandelenfilter.'; break }
        for (let i = 0; i < batch.length; i++) {
          signal.throwIfAborted()
          const entry = batch[i], result = results[i]
          let value = result.status === 'fulfilled' ? result.value : null, failure = result.status === 'rejected' ? result.reason.message : ''
          if (!value && !brokerFailed) {
            try {
              const data = stockSnapshot(await broker.history(entry.originalSymbol || entry.symbol.replaceAll('-', ' ')), now())
              value = { ...entry, ...data, source: 'IBKR', key: state.key, fetchedAt: new Date(now()).toISOString(), cached: false }
            } catch (error) {
              signal.throwIfAborted()
              failure += ` · IBKR: ${error.message}`
              if (error.fatal) { state.state = 'paused'; state.message = error.message; break }
              brokerFailed = true
              state.warnings = ['IBKR-terugval niet beschikbaar; ontbrekende aandelen blijven uitgesloten.']
            }
          }
          if (value?.blocked) { state.checked++; continue }
          if (value) {
            observations[entry.symbol] = { ...value, cached: false }
            state.observations[entry.symbol] = value
            if (value.price >= state.filters.minPrice && value.price <= state.filters.maxPrice && value.volume >= state.filters.minVolume) state.rows.push(value)
          } else state.failures.push({ symbol: entry.symbol, message: failure })
          state.checked++
        }
        state.progress = `${state.checked} / ${state.total} aandelen gecontroleerd`
        if (state.checked - lastSaved >= 25 || state.state !== 'running') { await persist(); lastSaved = state.checked }
        if (state.state !== 'running') break
        if (network && state.checked < state.total) await wait(500, signal)
      }
      if (state.state === 'running') state.state = state.failures.length ? 'partial' : 'complete'
    } catch (error) { state.state = signal.aborted ? 'cancelled' : 'error'; state.message = signal.aborted ? 'Aandelenfilter gestopt; voortgang bewaard.' : error.message }
    finally {
      broker.close(); state.finishedAt = new Date(now()).toISOString()
      try { await persist() } catch { storageError = 'Aandelenfilter kon niet worden opgeslagen; controleer de privédatamap.' }
      if (!storageError && ['complete', 'partial'].includes(state.state)) {
        try {
          await mkdir(join(directory, 'history'), { recursive: true })
          const historyPath = join(directory, 'history', state.id + '.json')
          await writeFile(historyPath + '.tmp', JSON.stringify(state), { mode: 0o600 }); await rename(historyPath + '.tmp', historyPath)
        } catch { storageError = 'Aandelenfilterhistorie kon niet worden opgeslagen.' }
      }
      active = false
    }
  }
  return {
    snapshot,
    start(input) {
      if (storageError) throw Error(storageError)
      if (active) return snapshot()
      const filters = stockFilters(input.filters), universeMode = input.universeMode ?? 'us'
      if (!['us', 'custom'].includes(universeMode)) throw Error('Ongeldig aandelenuniversum.')
      const symbols = universeMode === 'custom' ? [...new Set((input.symbols ?? []).map(s => String(s).toUpperCase()))] : []
      if (universeMode === 'custom' && (!symbols.length || symbols.length > 50 || symbols.some(s => !/^[A-Z][A-Z0-9]*(?:[. -][A-Z])?$/.test(s)))) throw Error('Gebruik 1–50 geldige Amerikaanse tickers.')
      if (input.resume) {
        if (!snapshot().canResume || JSON.stringify(filters) !== JSON.stringify(state.filters) || state.universeMode !== universeMode || JSON.stringify(symbols) !== JSON.stringify(state.symbols)) throw Error('Hervat met dezelfde filters en tickers of start een nieuwe aandelenfilter.')
        state.state = 'running'; delete state.message
      } else state = { ...initial(), id: randomUUID(), key: dailyCacheKey(now()), state: 'running', filters, universeMode, symbols, entries: symbols.map(symbol => ({ symbol: symbol.replace(/[. ]/g, '-'), originalSymbol: symbol })), total: symbols.length, startedAt: new Date(now()).toISOString() }
      controller = new AbortController()
      active = true
      void run()
      return snapshot()
    },
    stop() { controller?.abort(); return snapshot() },
    selection(id) {
      if (active || storageError || !id || id !== state.id || !['complete', 'partial'].includes(state.state) || state.checked !== state.total || !state.rows.length) throw Error('Rond eerst de aandelenfilter af en kies de opgeslagen selectie.')
      const age = now() - Date.parse(state.finishedAt || state.startedAt || '')
      if (!Number.isFinite(age) || age < 0 || age > 7 * 86400000) throw Error('Aandelenfilter is ouder dan zeven dagen. Vernieuw eerst de wekelijkse selectie.')
      const rows = state.rows.filter(row => !blocked(row.symbol))
      if (!rows.length) throw Error('Alle geselecteerde aandelen zijn geblokkeerd.')
      return { id: state.id, finishedAt: state.finishedAt, universeMode: state.universeMode, symbols: state.symbols, filters: { ...state.filters }, entries: rows.map(row => ({ symbol: (row.originalSymbol || row.symbol).replace(/[.-]/g, ' '), companyName: row.companyName })) }
    },
  }
}
