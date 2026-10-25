import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { runCspScan } from './csp-scanner.mjs'
import { createScanConnection } from './scan-connection.mjs'
import { optionsSession } from './spread-scan.mjs'
import { stockKey } from './blocked-stocks.mjs'

export function ivFilters(input = {}) {
  const minIvr = input.minIvr ?? 40
  if (typeof minIvr !== 'number' || !Number.isFinite(minIvr) || minIvr < 0 || minIvr > 100) throw Error('Minimum IV-rank moet tussen 0 en 100 liggen.')
  return { minIvr }
}
export function makeFilteredIvState(selection, filters) {
  return { id: randomUUID(), state: 'running', stockSelectionId: selection.id, stockSelectionAt: selection.finishedAt, stockFilters: selection.filters, filters: ivFilters(filters), entries: selection.entries, universeMode: selection.universeMode, symbols: selection.symbols, universeCount: selection.entries.length, universeChecked: 0, symbolsChecked: 0, contractsChecked: 0, rows: [], observations: [], failures: [], warnings: [], startedAt: new Date().toISOString(), automatic: false }
}
export function ivSelection(state, stock, id, blocked = () => false, now = Date.now()) {
  if (!id || id !== state.id || state.stockSelectionId !== stock.id || !['complete', 'partial'].includes(state.state) || state.universeChecked !== state.entries?.length || state.storageError) throw Error('Rond eerst de IV Scan af op de huidige Stock Filter.')
  const age = now - Date.parse(state.finishedAt)
  if (!Number.isFinite(age) || age < 0 || age > 7 * 86400000) throw Error('IV-resultaten zijn ouder dan zeven dagen; voer de IV Scan opnieuw uit.')
  const allowed = new Set(stock.entries.map(row => stockKey(row.symbol)))
  const rows = state.rows.filter(row => allowed.has(stockKey(row.symbol)) && !blocked(row.symbol))
  if (!rows.length) throw Error('Geen niet-geblokkeerde aandelen voldoen aan de IV-filter.')
  return { id: state.id, finishedAt: state.finishedAt, filters: state.filters, entries: rows.map(row => ({ symbol: row.symbol })) }
}
export async function runFilteredIvScan(config, state, { cache, checkpoint = async () => {}, scan = runCspScan, connection = createScanConnection(), blocked = () => false, wait = (ms, signal) => sleep(ms, undefined, { signal }), now = () => new Date() }) {
  const signal = config.scanSignal
  let consecutiveFailures = 0
  try {
    if (Number.isInteger(state.retryFrom)) {
      state.universeChecked = state.retryFrom
      const remaining = new Set(state.entries.slice(state.retryFrom).map(row => row.symbol))
      state.failures = state.failures.filter(row => !remaining.has(row.symbol)); delete state.retryFrom
    }
    for (; state.universeChecked < state.entries.length;) {
      signal?.throwIfAborted()
      const { symbol } = state.entries[state.universeChecked]
      if (!blocked(symbol)) {
        state.progress = `IV Scan · ${symbol} · ${state.universeChecked + 1} / ${state.entries.length}`
        const part = { state: 'running', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
        await scan({ ...config, marketClosed: !optionsSession(now()).open, nextScanRequestId: connection.nextRequestId,
          getSpreadIv: cache.getIv?.bind(cache), saveSpreadIv: cache.saveIv?.bind(cache),
        }, [symbol], part, connection.Api, 'stock-iv')
        signal?.throwIfAborted()
        if (part.state === 'error') throw Error(part.message || 'IBKR niet bereikbaar.')
        state.warnings = [...new Set([...state.warnings, ...part.warnings])]
        const row = part.rows[0]
        if (row) {
          state.observations = [...state.observations.filter(item => item.symbol !== symbol), row]
          state.rows = state.observations.filter(item => item.ivr >= state.filters.minIvr).sort((a, b) => b.ivr - a.ivr)
          consecutiveFailures = 0
        } else { state.failures.push({ symbol, message: part.warnings.join(' · ') || 'Geen volledige IV-jaarhistorie.' }); consecutiveFailures++ }
      }
      state.universeChecked++; state.symbolsChecked = state.universeChecked
      state.remainingSymbols = state.entries.length - state.universeChecked
      await checkpoint()
      if (state.storageError) throw Error('IV Scan kon niet worden opgeslagen.')
      if (consecutiveFailures >= 5) { state.state = 'paused'; state.retryFrom = state.universeChecked - 5; state.message = 'IV Scan gepauzeerd na vijf ontbrekende IV-reeksen. Controleer IBKR en hervat.'; return }
      if (state.remainingSymbols > 0 && !blocked(symbol)) await wait(state.universeChecked % 25 === 0 ? 20000 : 1000, signal)
    }
    state.state = state.failures.length ? 'partial' : 'complete'
  } catch (error) { state.state = signal?.aborted ? 'cancelled' : 'error'; state.message = signal?.aborted ? 'IV Scan gestopt; voortgang bewaard.' : error.message }
  finally { connection.close(); state.finishedAt = now().toISOString(); state.remainingSymbols = state.entries.length - state.universeChecked; await checkpoint() }
}
