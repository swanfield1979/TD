import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { ivMetrics } from '../shared/leaps-scan.mjs'
import { usableSpreadIv } from '../shared/iv-reference.mjs'
import { scanDate } from '../shared/csp-scan.mjs'
import { spreadFilters, selectSpreads } from '../shared/put-spread.mjs'
import { ivFilters, makeFilteredIvState, runFilteredIvScan } from '../server/filtered-iv-scan.mjs'
import { runCspScan } from '../server/csp-scanner.mjs'
import { runSpreadScan } from '../server/spread-scan.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'

const today = scanDate()
const bars = Array.from({ length: 366 }, (_, i) => ({ date: new Date(Date.parse(today) - i * 86400000).toISOString().slice(0, 10), close: i === 2 ? .6 : i === 1 ? .4 : .2 }))
const snapshot = { symbol: 'TEST', iv: 40, ivr: 50, ivPercentile: 90, ivSource: 'historical-close', ivAsOf: today }
const config = { clientId: 77, scanQuoteWaitMs: 10, scanPacer: { acquire: async () => {} } }

test('put-spread percentile includes ties; legacy calculations keep their strict convention', () => {
  assert.equal(ivMetrics(.2, bars, today, { inclusive: true }).ivPercentile, 364 / 366 * 100)
  assert.equal(ivMetrics(.2, bars, today).ivPercentile, 0)
  assert.equal(ivMetrics(.2, bars.slice(0, 20), today, { inclusive: true }), null)
  assert.deepEqual(ivFilters(), { minIvr: 0, minIvPercentile: 40 })
  assert.deepEqual(ivFilters({ minIvr: 40 }), { minIvr: 40, minIvPercentile: 0 })
  for (const value of [-1, 101, NaN, '40']) assert.throws(() => ivFilters({ minIvPercentile: value }))
})

test('IV selection filters percentile independently of rank and keeps raw observations', async () => {
  const state = makeFilteredIvState({ id: 'stock', entries: [{ symbol: 'P' }, { symbol: 'R' }, { symbol: 'UNKNOWN' }] }, {})
  await runFilteredIvScan({}, state, { cache: {}, connection: { close() {} }, wait: async () => {}, scan: async (cfg, [symbol], part) => {
    assert.equal(cfg.historicalIvOnly, true)
    part.rows.push({ symbol, ivr: symbol === 'R' ? 90 : 10, ivPercentile: symbol === 'P' ? 80 : symbol === 'R' ? 20 : undefined })
  } })
  assert.deepEqual(state.rows.map(row => row.symbol), ['P'])
  assert.equal(state.observations.length, 3)
})

class Broker extends EventEmitter {
  connect() { queueMicrotask(() => this.emit(EventName.connected)) }
  disconnect() {}
  reqMarketDataType() {}
  reqContractDetails(id, contract) { this.emit(EventName.contractDetails, id, { contract: { ...contract, conId: 1 } }); this.emit(EventName.contractDetailsEnd, id) }
  cancelMktData() {}
  cancelHistoricalData() {}
}

test('historical IV scan skips generic IV quotes and excludes unfinished day and duplicate dates', async () => {
  resetScanGuards()
  class HistoryBroker extends Broker {
    reqMktData(id, _contract, generic) { assert.equal(generic, ''); this.emit(EventName.tickPrice, id, 75, 110) }
    reqHistoricalData(id, _contract, _end, period, size, kind) {
      assert.equal(period, '1 Y'); assert.equal(size, '1 day'); assert.equal(kind, 'OPTION_IMPLIED_VOLATILITY')
      for (const bar of [...bars, bars[2]]) this.emit(EventName.historicalData, id, bar.date, 0, 0, 0, bar.close)
      this.emit(EventName.historicalData, id, 'finished')
    }
  }
  const state = { rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
  await runCspScan({ ...config, historicalIvOnly: true, marketClosed: false }, ['TEST'], state, HistoryBroker, 'stock-iv')
  assert.equal(state.rows.length, 1)
  assert.equal(state.rows[0].iv, 40)
  assert.equal(state.rows[0].ivAsOf, bars[1].date)
  assert.equal(state.rows[0].ivPercentile, 364 / 365 * 100)
})

test('server-selected IV skips history and IV quotes; invalid or stale snapshots cannot be reused', async () => {
  resetScanGuards()
  let chains = 0
  class EnrichmentBroker extends Broker {
    reqMktData(id, _contract, generic) { assert.equal(generic, ''); this.emit(EventName.tickPrice, id, 75, 110) }
    reqHistoricalData() { assert.fail('No duplicate IV history request') }
    reqSecDefOptParams(id) { chains++; this.emit(EventName.securityDefinitionOptionParameterEnd, id) }
  }
  const state = { filters: spreadFilters({ minAvgOptionVolume: 0, minIvPercentile: 80 }), rows: [], puts: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
  await runCspScan({ ...config, spreadIvSnapshot: snapshot }, ['TEST'], state, EnrichmentBroker, 'spreads')
  assert.equal(state.ivSnapshotHits, 1); assert.equal(chains, 1)
  for (const changes of [{ ivAsOf: '2000-01-01' }, { ivAsOf: '2099-01-01' }, { symbol: 'OTHER' }, { iv: NaN }, { ivPercentile: undefined }]) assert.equal(usableSpreadIv({ ...snapshot, ...changes }, 'TEST', today), null)
})

test('spread cache and final pairing require percentile when enabled; output retains it', () => {
  const expiry = new Date(Date.parse(today) + 60 * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
  const short = { symbol: 'TEST', right: 'P', currency: 'USD', multiplier: 100, tradingClass: 'TEST', expiry, underlyingPrice: 110, strike: 75, bid: 1, ask: 1.2, delta: -.2, ivr: 50, ivPercentile: 80 }
  const long = { ...short, strike: 65, bid: .2, ask: .4 }
  const filters = { minIvPercentile: 80 }
  assert.equal(selectSpreads([short, long], today, filters)[0].ivPercentile, 80)
  assert.equal(selectSpreads([{ ...short, ivPercentile: undefined }, long], today, filters).length, 0)
  assert.equal(selectSpreads([short, long], today, { minIvPercentile: 81 }).length, 0)
})

test('closed-market cached quotes use selected IV while preserving their original quote dates', async () => {
  const date = new Date(`${today}T23:00:00Z`)
  const expiry = new Date(Date.parse(today) + 60 * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
  const quotedAt = '2026-01-01T20:00:00Z'
  const short = { symbol: 'TEST', right: 'P', currency: 'USD', multiplier: 100, tradingClass: 'TEST', expiry, underlyingPrice: 110, strike: 75, bid: 1, ask: 1.2, delta: -.2, ivr: 10, quotedAt }
  const stored = { underlyingPrice: 110, ivr: 10, quotedAt, puts: [short, { ...short, strike: 65, bid: .2, ask: .4 }] }
  const state = { entries: [{ symbol: 'TEST' }], ivRows: [snapshot], filters: spreadFilters({ minAvgOptionVolume: 0, minIvPercentile: 80 }), rows: [], warnings: [], contractsChecked: 0 }
  await runSpreadScan({}, state, { now: () => date, checkpoint: async () => {}, connection: { close() {} }, cache: { get: async () => stored }, scan: async () => assert.fail('Closed-market cache needs no broker') })
  assert.equal(state.rows.length, 1)
  assert.equal(state.rows[0].ivPercentile, snapshot.ivPercentile)
  assert.equal(state.rows[0].ivr, snapshot.ivr)
  assert.equal(state.rows[0].shortQuotedAt, quotedAt)
  assert.equal(state.rows[0].cached, true)
})
