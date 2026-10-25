import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { createStockFilter, stockFilters, stockSnapshot, yahooStockHistory } from '../server/stock-filter.mjs'
import { createIbkrStockHistory } from '../server/stock-history.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'

const now = () => Date.parse('2026-10-25T14:00:00Z')
const bars = (close = 20, volume = 5e6) => [{ date: '2026-10-23', close, volume }]
const input = (symbols, filters = {}) => ({ universeMode: 'custom', symbols, filters: { minPrice: 5, maxPrice: 150, minVolume: 5e6, ...filters } })
async function finish(service) {
  for (let i = 0; i < 2000 && service.snapshot().state === 'running'; i++) await new Promise(resolve => setTimeout(resolve, 2))
  assert.notEqual(service.snapshot().state, 'running')
  return service.snapshot()
}
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'tm-stock-filter-'))
  try { await run(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}
const noBroker = () => ({ history() { throw Error('Gateway offline') }, close() {} })
test('stock filters use shares; bounds inclusive, no implicit market-cap filter, invalid values rejected', () => {
  assert.equal(stockFilters().minVolume, 5e6)
  assert.throws(() => stockFilters({ minPrice: 100, maxPrice: 5 }))
  assert.throws(() => stockFilters({ minVolume: '5000000' }))
  assert.throws(() => stockFilters({ minPrice: NaN }))
  assert.equal(stockSnapshot(bars(), now()).volume, 5e6)
  assert.throws(() => stockSnapshot(bars(20, null), now()))
  assert.throws(() => stockSnapshot([{ date: '2026-10-01', close: 20, volume: 9e6 }], now()))
  assert.equal(stockSnapshot([...bars(), { date: '2026-10-26', close: 500, volume: 99e6 }], Date.parse('2026-10-26T15:00:00Z')).price, 20)
})
test('Yahoo downloads only five daily bars, validates equity/currency, exposes rate limits', async () => {
  const data = { meta: { currency: 'USD', instrumentType: 'EQUITY' }, timestamp: [1792762200], indicators: { quote: [{ close: [20], volume: [5e6] }] } }
  const result = await yahooStockHistory('BRK-B', undefined, async url => { assert.match(url, /BRK-B\?range=5d&interval=1d/); return { ok: true, json: async () => ({ chart: { result: [data] } }) } })
  assert.equal(result[0].volume, 5e6)
  await assert.rejects(yahooStockHistory('A', undefined, async () => ({ ok: false, status: 429 })), error => error.limited)
  data.meta.currency = 'EUR'
  await assert.rejects(yahooStockHistory('A', undefined, async () => ({ ok: true, json: async () => ({ chart: { result: [data] } }) })), /USD/)
})
test('selection survives restart, raw data re-filter without network, original timestamp preserved', () => fixture(async directory => {
  let requests = 0, fallbacks = 0
  const dependencies = { now, wait: async () => {}, yahoo: async symbol => { requests++; return symbol === 'LOW' ? bars(20, 4999999) : symbol === 'HIGH' ? bars(151) : bars(5) }, brokerFactory: () => ({ history() { fallbacks++; throw Error('unused') }, close() {} }) }
  const service = await createStockFilter(directory, {}, dependencies)
  service.start(input(['PASS', 'LOW', 'HIGH']))
  const first = await finish(service)
  assert.equal(first.state, 'complete'); assert.deepEqual(first.rows.map(r => r.symbol), ['PASS']); assert.equal(fallbacks, 0)
  const restarted = await createStockFilter(directory, {}, dependencies)
  assert.equal(restarted.selection(first.id).entries.length, 1)
  restarted.start(input(['PASS', 'LOW', 'HIGH'], { maxPrice: 200, minVolume: 0 }))
  const second = await finish(restarted)
  assert.equal(second.rows.length, 3); assert.equal(second.cacheHits, 3); assert.equal(requests, 3)
  assert.equal(second.rows[0].fetchedAt, first.rows[0].fetchedAt)
  assert.throws(() => restarted.selection(first.id), /Rond eerst/)
}))
test('limited Yahoo pauses with durable cursor and resumes; option selection unavailable until done', () => fixture(async directory => {
  let limited = true
  const dependencies = { now, wait: async () => {}, yahoo: async () => { if (limited) throw Object.assign(Error('429'), { limited: true }); return bars() }, brokerFactory: () => ({ history() { assert.fail('No broker flood on source-wide limit') }, close() {} }) }
  const service = await createStockFilter(directory, {}, dependencies)
  const started = service.start(input(['PASS', 'OTHER']))
  assert.throws(() => service.selection(started.id))
  const paused = await finish(service)
  assert.equal(paused.state, 'paused'); assert.equal(paused.checked, 0); assert.equal(paused.canResume, true)
  limited = false
  const restored = await createStockFilter(directory, {}, dependencies)
  restored.start({ ...input(['PASS', 'OTHER']), resume: true })
  assert.equal((await finish(restored)).rows.length, 2)
  assert.equal(restored.selection(started.id).entries.length, 2)
}))
test('missing data uses IBKR once; an unavailable broker does not stall every remaining ticker', () => fixture(async directory => {
  let calls = 0
  const service = await createStockFilter(directory, {}, { now, wait: async () => {}, yahoo: async () => { throw Error('Missing Yahoo') }, brokerFactory: () => ({ async history(symbol) { calls++; if (symbol === 'PASS') return bars(); throw Error('Unavailable') }, close() {} }) })
  service.start(input(['PASS', 'FAIL', 'OTHER']))
  const result = await finish(service)
  assert.equal(result.state, 'partial'); assert.equal(result.rows[0].source, 'IBKR'); assert.equal(result.failures.length, 2); assert.equal(calls, 2)
}))
test('cancel/resume and server interruption preserve the exact selection; changed filters rejected', () => fixture(async directory => {
  let service, stop = true
  const dependencies = { now, yahoo: async () => bars(), brokerFactory: noBroker, wait: async () => { if (stop) service.stop() } }
  service = await createStockFilter(directory, {}, dependencies)
  const request = input(['AAA', 'BBB', 'CCC', 'DDD'])
  service.start(request)
  const cancelled = await finish(service)
  assert.equal(cancelled.state, 'cancelled'); assert.equal(cancelled.checked, 3)
  assert.throws(() => service.start({ ...input(request.symbols, { minVolume: 1 }), resume: true }))
  const file = join(directory, 'selection.json'), stored = JSON.parse(await readFile(file, 'utf8'))
  stored.state = 'running'; await writeFile(file, JSON.stringify(stored))
  service = await createStockFilter(directory, {}, dependencies)
  assert.equal(service.snapshot().state, 'interrupted')
  stop = false; service.start({ ...request, resume: true })
  assert.equal((await finish(service)).rows.length, 4)
}))
test('full US selection has no 50-name cap and weekly selection survives until seven days', () => fixture(async directory => {
  let current = now()
  const entries = Array.from({ length: 75 }, (_, i) => ({ symbol: `S${i}` }))
  const service = await createStockFilter(directory, {}, { now: () => current, wait: async () => {}, yahoo: async () => bars(), universe: async () => ({ entries }), brokerFactory: noBroker })
  service.start({ filters: stockFilters(), universeMode: 'us' })
  const result = await finish(service)
  assert.equal(service.selection(result.id).entries.length, 75)
  current += 86400000
  assert.equal(service.selection(result.id).entries.length, 75)
  current += 7 * 86400000
  assert.throws(() => service.selection(result.id), /zeven dagen/)
}))
test('corrupt saved selection is never overwritten', () => fixture(async directory => {
  const file = join(directory, 'selection.json'); await writeFile(file, 'invalid')
  const service = await createStockFilter(directory, {}, { now, brokerFactory: noBroker })
  assert.match(service.snapshot().storageError, /onleesbaar/)
  assert.throws(() => service.start(input(['AAA'])))
  assert.equal(await readFile(file, 'utf8'), 'invalid')
}))
test('IBKR fallback requests only daily TRADES, normalizes configured volume and disconnects', async () => {
  resetScanGuards()
  let api
  class Fake extends EventEmitter {
    constructor() { super(); api = this }
    connect() { queueMicrotask(() => this.emit(EventName.connected)) }
    disconnect() { this.closed = true }
    cancelHistoricalData(id) { this.cancelled = id }
    reqHistoricalData(id, contract, end, range, size, kind) {
      assert.equal(contract.secType, 'STK'); assert.equal(range, '5 D'); assert.equal(size, '1 day'); assert.equal(kind, 'TRADES')
      queueMicrotask(() => { this.emit(EventName.historicalData, id, '20261023', 1, 1, 1, 20, 50000); this.emit(EventName.historicalData, id, 'finished', -1, -1, -1, -1, -1) })
    }
  }
  const broker = createIbkrStockHistory({ clientId: 77, stockVolumeMultiplier: 100 }, new AbortController().signal, Fake)
  const result = await broker.history('PASS')
  assert.equal(result[0].volume, 5e6); assert.equal(result[0].date, '2026-10-23'); assert.equal(api.cancelled, 70000)
  broker.close(); assert.equal(api.closed, true)
})
