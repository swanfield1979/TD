import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { createScanConnection } from '../server/scan-connection.mjs'
import { runCspScan } from '../server/csp-scanner.mjs'
import { runSpreadScan } from '../server/spread-scan.mjs'
import { spreadFilters } from '../shared/put-spread.mjs'
import { ivReference } from '../shared/iv-reference.mjs'
import { scanDate } from '../shared/csp-scan.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'
const today = scanDate()
const bars = Array.from({ length: 366 }, (_, i) => ({ date: new Date(Date.parse(`${today}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10), close: i === 0 ? .4 : i === 1 ? .35 : i === 2 ? .6 : .2 }))
const report = () => ({ state: 'running', universeMode: 'custom', symbols: [], filters: spreadFilters(), rows: [], puts: [], assessments: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 })
test('historical IV fallback requires recent, genuine year history and identifies its date', () => {
  assert.equal(ivReference(undefined, bars, today).source, 'historical-close')
  assert.equal(ivReference(undefined, bars, today).asOf, today)
  assert.equal(ivReference(.45, bars, today).source, 'quote')
  assert.equal(ivReference(undefined, bars.slice(0, 10), today), null)
  assert.equal(ivReference(undefined, bars.filter(b => b.date < bars[8].date), today), null)
  assert.equal(ivReference(undefined, bars, today, { completedOnly: true }).asOf, bars[1].date)
})
test('physical scan connection is reused, request IDs increase, listeners are released and close is explicit', () => {
  let connects = 0, closes = 0, socket
  class Broker extends EventEmitter {
    constructor() { super(); socket = this }
    connect() { connects++; this.emit(EventName.connected) }
    disconnect() { closes++ }
    reqMarketDataType() {}
  }
  const session = createScanConnection(Broker)
  const a = new session.Api({}); a.on(EventName.error, () => {}); a.connect(98)
  let ticks = 0; a.on(EventName.tickPrice, () => ticks++)
  socket.emit(EventName.tickPrice, 1, 1, 10); a.disconnect()
  assert.equal(socket.listenerCount(EventName.tickPrice), 0)
  const b = new session.Api({}); b.on(EventName.error, () => {}); b.connect(98)
  socket.emit(EventName.tickPrice, 2, 1, 11)
  assert.equal(ticks, 1); assert.equal(connects, 1); assert.equal(closes, 0)
  assert.equal(session.nextRequestId(), 10000); assert.equal(session.nextRequestId(), 10001)
  b.disconnect(); session.close(); assert.equal(closes, 1)
})
test('missing stock IV uses one stock subscription and a dated historical IV before any option-chain request', async () => {
  resetScanGuards()
  let subscriptions = 0, histories = 0, chains = 0, saved, connects = 0, closes = 0, duration
  class Broker extends EventEmitter {
    connect() { connects++; queueMicrotask(() => this.emit(EventName.connected)) }
    disconnect() { closes++ }
    reqMarketDataType() {}
    reqContractDetails(id, contract) { this.emit(EventName.contractDetails, id, { contract: { ...contract, conId: 1 } }); this.emit(EventName.contractDetailsEnd, id) }
    reqMktData(id) { subscriptions++; this.emit(EventName.tickPrice, id, 75, 110) }
    cancelMktData() {}
    reqHistoricalData(id, _contract, _end, period) { duration = period; histories++; for (const b of bars) this.emit(EventName.historicalData, id, b.date, 0, 0, 0, b.close); this.emit(EventName.historicalData, id, 'finished') }
    cancelHistoricalData() {}
    reqSecDefOptParams(id) { chains++; this.emit(EventName.securityDefinitionOptionParameterEnd, id) }
  }
  const session = createScanConnection(Broker)
  const config = { clientId: 77, marketClosed: true, nextScanRequestId: session.nextRequestId, scanQuoteWaitMs: 1, scanPacer: { acquire: async () => {} } }
  const state = report()
  await runCspScan({ ...config, saveSpreadIv: async (_symbol, data) => { saved = data } }, ['TEST'], state, session.Api, 'spreads')
  assert.equal(subscriptions, 1); assert.equal(histories, 1); assert.equal(chains, 1)
  assert.equal(saved.bars.length, 366); assert.equal(state.ivReference.ivSource, 'historical-close')
  assert.equal(duration, '1 Y')
  resetScanGuards()
  await runCspScan({ ...config, getSpreadIv: async () => saved }, ['TEST'], report(), session.Api, 'spreads')
  assert.equal(histories, 1, 'Persisted IV history avoids download after a process/cache restart')
  assert.equal(connects, 1); assert.equal(closes, 0)
  resetScanGuards()
  await runCspScan({ ...config, marketClosed: false, getSpreadIv: async () => ({ ...saved, day: bars[1].date }) }, ['TEST'], report(), session.Api, 'spreads')
  assert.equal(histories, 2); assert.equal(duration, '10 D')
  session.close(); assert.equal(closes, 1)
})
test('five IV failures pause the job; resume retries the failed stocks instead of skipping them', async () => {
  const state = { ...report(), symbols: ['A', 'B', 'C', 'D', 'E', 'F'] }, calls = [], waits = []
  const options = { cache: { get: async () => null }, now: () => new Date('2026-10-23T14:00:00Z'), wait: async ms => waits.push(ms), scan: async (_c, symbols, part) => { calls.push(symbols[0]); part.state = 'partial'; part.assessments.push({ symbol: symbols[0], status: 'missing', code: 'IV_UNAVAILABLE', reason: 'No IV', source: 'broker' }) } }
  await runSpreadScan({}, state, options)
  assert.equal(state.state, 'paused'); assert.equal(calls.length, 5); assert.equal(state.retryFrom, 0); assert.deepEqual(waits, [1000, 1000, 1000, 1000])
  await runSpreadScan({}, state, { ...options, scan: async (_c, symbols, part) => { calls.push(symbols[0]); part.state = 'complete'; part.assessments.push({ symbol: symbols[0], status: 'filtered', source: 'broker', reason: 'Low IVR' }) } })
  assert.deepEqual(calls.slice(5), ['A', 'B', 'C', 'D', 'E', 'F']); assert.equal(state.state, 'complete'); assert.equal(state.assessments.length, 6)
})
test('25 broker assessments insert a batch pause, cached-only scans have no waits', async () => {
  const state = { ...report(), symbols: Array.from({ length: 26 }, (_, i) => `S${i}`) }, waits = []
  await runSpreadScan({}, state, { cache: { get: async () => null }, now: () => new Date('2026-10-23T14:00:00Z'), wait: async ms => waits.push(ms), scan: async (_c, _s, part) => { part.state = 'complete'; part.assessments.push({ status: 'filtered', source: 'broker' }) } })
  assert.equal(waits.filter(ms => ms === 20000).length, 1); assert.equal(waits.length, 25)
})
