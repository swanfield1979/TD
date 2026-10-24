import { runCspScan } from './csp-scanner.mjs'
import { loadUsUniverse } from './martin-universe.mjs'
import { scanDate, daysToExpiry } from '../shared/csp-scan.mjs'
import { selectSpreads, spreadFilters } from '../shared/put-spread.mjs'
import { nyseSyncWindow } from '../shared/nyse-session.mjs'
import { createScanConnection } from './scan-connection.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

// Options regular session: pre/post-market is closed for these equity-option quotes.
export function optionsSession(date = new Date()) {
  const session = nyseSyncWindow(date)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: session.timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]))
  const minute = Number(parts.hour) * 60 + Number(parts.minute)
  return { ...session, open: session.shouldSync && minute >= 570 && minute < session.closeHour * 60 }
}
export async function runSpreadScan(config, state, { cache, checkpoint = async () => {}, universeLoader = loadUsUniverse, scan = runCspScan, now = () => new Date(), connection = createScanConnection(), wait = (ms, signal) => sleep(ms, undefined, { signal }) }) {
  const signal = config.scanSignal, filters = spreadFilters(state.filters)
  state.filters = filters
  state.rows = state.rows.map(row => ({ ...row, dte: daysToExpiry(row.expiry, scanDate(now())), cached: true }))
    .filter(row => row.dte >= filters.minDte && row.dte <= filters.maxDte)
  state.assessments ??= []; state.cacheHits ??= 0; state.chainsSkipped ??= 0
  if (Number.isInteger(state.retryFrom)) {
    state.universeChecked = state.retryFrom
    state.assessments = state.assessments.slice(0, state.retryFrom)
    state.symbolsChecked = state.universeChecked
    state.chainsSkipped = state.assessments.filter(item => item.status === 'filtered').length
    state.cacheHits = state.assessments.filter(item => item.source === 'cache').length
    delete state.retryFrom
  }
  let ivFailures = 0, brokerSymbols = 0
  let brokerUnavailable = false
  try {
    if (!state.entries) {
      state.progress = 'Amerikaanse aandelenlijst laden'
      const universe = state.universeMode === 'custom' ? { entries: state.symbols.map(symbol => ({ symbol })), name: 'Eigen tickers' } : await cache.universe(universeLoader, signal)
      state.entries = universe.entries.map(entry => ({ symbol: (entry.originalSymbol || entry.symbol).replaceAll('.', ' '), companyName: entry.companyName }))
      state.universeName = universe.name; state.universeUpdatedAt = universe.updatedAt
      state.universeSources = universe.sources; state.universeCount = state.entries.length
      if (universe.warning) state.warnings.push(universe.warning)
    }
    state.universeChecked ??= 0
    for (; state.universeChecked < state.entries.length;) {
      signal?.throwIfAborted()
      const { symbol } = state.entries[state.universeChecked]
      state.state = 'running'; state.progress = `Aandelenfilter · ${symbol} · ${state.universeChecked + 1} / ${state.entries.length}`
      const session = optionsSession(now()); state.marketOpen = session.open
      let stored = null, assessment, rows = []
      try { stored = await cache.get(symbol) } catch (error) { state.warnings.push(`${symbol}: ${error.message}`) }
      const useStored = () => {
        state.cacheHits++
        const passes = stored.underlyingPrice >= filters.minPrice && stored.underlyingPrice <= filters.maxPrice && stored.ivr >= filters.minIvr
        rows = passes ? selectSpreads(stored.puts.map(put => ({ ...put, cached: true })), scanDate(now()), filters) : []
        if (!passes) state.chainsSkipped++
        const coverage = stored.filters || {}
        const incomplete = passes && (!stored.puts.length || !stored.filters || filters.minDte < coverage.minDte || filters.maxDte > coverage.maxDte || filters.minBuffer < coverage.minBuffer)
        if (incomplete) state.warnings.push(`${symbol}: opgeslagen chain dekt de verruimde looptijd/buffer niet volledig; alleen beschikbare quotes getoetst.`)
        assessment = { symbol, status: passes ? incomplete ? 'partial' : rows.length ? 'match' : 'no-match' : 'filtered', source: 'cache', asOf: stored.quotedAt, ivSource: stored.ivSource, ivAsOf: stored.ivAsOf,
          reason: !passes ? 'Opgeslagen koers/IV-rank voldoet niet; chain overgeslagen.' : incomplete ? 'Beschikbare oude chain gefilterd; onvolledige dekking.' : `${rows.length} spreads in opgeslagen chain; oude koers en IV-rank gebruikt.` }
      }
      if ((!session.open || brokerUnavailable) && stored) useStored()
      else if (brokerUnavailable) {
        assessment = { symbol, status: 'missing', source: 'none', reason: 'IBKR niet bereikbaar en geen opgeslagen optiechain beschikbaar.' }
      } else {
        const part = { state: 'running', filters, rows: [], puts: [], assessments: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
        const baseContracts = state.contractsChecked
        const merge = () => {
          state.rows = [...state.rows.filter(row => row.symbol !== symbol), ...part.rows].sort((a,b) => b.returnOnRisk - a.returnOnRisk)
          state.contractsChecked = baseContracts + part.contractsChecked; state.progress = part.progress || state.progress
        }
        state.phase = 'scanning'
        await scan({ ...config, marketClosed: !session.open, nextScanRequestId: connection.nextRequestId,
          getSpreadIv: cache.getIv?.bind(cache), saveSpreadIv: cache.saveIv?.bind(cache),
          onScanCheckpoint: async () => { merge(); await checkpoint() },
          onSpreadSnapshot: async snapshot => { await cache.save(symbol, snapshot) },
        }, [symbol], part, connection.Api, 'spreads')
        brokerSymbols++
        merge(); rows = part.rows
        if (signal?.aborted) throw Error('Scan gestopt.')
        state.warnings.push(...part.warnings)
        assessment = part.assessments[0] || { symbol, status: part.state === 'error' ? 'missing' : rows.length ? 'match' : 'no-match', source: 'broker', reason: part.message || 'Geen passende spread gevonden.' }
        if (assessment.status === 'filtered') state.chainsSkipped++
        if ((part.state === 'error' || assessment.status === 'missing') && stored) {
          useStored(); state.warnings.push(`${symbol}: brokerdata niet beschikbaar; oude opgeslagen chain gebruikt.`)
        }
        if (part.state === 'error') {
          if (/snelheidslimiet|IBKR-pauze/.test(part.message || '')) throw Error(part.message)
          brokerUnavailable = true
          state.warnings.push('IBKR niet bereikbaar; resterende aandelen uitsluitend uit lokale chains beoordeeld. Ontbrekende chains krijgen geen resultaat.')
        }
      }
      state.rows = [...state.rows.filter(row => row.symbol !== symbol), ...rows].sort((a,b) => b.returnOnRisk - a.returnOnRisk)
      state.assessments.push(assessment); state.universeChecked++; state.symbolsChecked = state.universeChecked
      state.remainingSymbols = state.entries.length - state.universeChecked
      ivFailures = assessment.code === 'IV_UNAVAILABLE' && assessment.source !== 'cache' ? ivFailures + 1 : 0
      state.warnings = [...new Set(state.warnings)]
      await checkpoint()
      if (state.storageError) throw Error('Scan gestopt: voortgang kon niet worden opgeslagen.')
      if (ivFailures >= 5) {
        state.state = 'paused'; state.retryFrom = state.universeChecked - ivFailures
        state.message = 'Scan gepauzeerd: vijf aandelen achter elkaar zonder bruikbare IV/IV-historie. Controleer IV in TWS en API-datarechten. Hervatten probeert deze aandelen opnieuw; de Gateway krijgt nu geen nieuwe scanverzoeken.'
        state.progress = state.message
        return
      }
      if (!brokerUnavailable && assessment.source !== 'cache' && state.remainingSymbols > 0) {
        const pause = brokerSymbols % 25 === 0 ? 20000 : 1000
        state.phase = 'waiting'; state.nextBatchAt = new Date(now().getTime() + pause).toISOString()
        state.progress = `Rustpauze · ${state.universeChecked} / ${state.universeCount} aandelen · volgende beoordeling over ${pause / 1000} s`
        await checkpoint(); await wait(pause, signal)
        delete state.nextBatchAt
      }
    }
    state.state = state.warnings.length || state.assessments.some(item => ['missing', 'partial'].includes(item.status)) ? 'partial' : 'complete'; state.progress = 'Alle aandelen in het universum gecontroleerd'
  } catch (error) { state.state = signal?.aborted ? 'cancelled' : 'error'; state.message = error.message }
  finally { connection.close(); delete state.nextBatchAt; state.phase = state.state; state.finishedAt = now().toISOString(); state.remainingSymbols = Math.max(0, (state.universeCount || 0) - (state.universeChecked || 0)); await checkpoint() }
}
