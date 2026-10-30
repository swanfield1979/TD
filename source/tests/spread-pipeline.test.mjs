import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { createBlockedStocks, stockKey } from '../server/blocked-stocks.mjs'
import { createStockFilter } from '../server/stock-filter.mjs'
import { makeFilteredIvState, runFilteredIvScan, ivSelection, ivFilters } from '../server/filtered-iv-scan.mjs'
import { createWeeklySpreadSchedule } from '../server/weekly-spread-schedule.mjs'
import { runCspScan } from '../server/csp-scanner.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'
import { scanDate } from '../shared/csp-scan.mjs'
import { createScanStore } from '../server/scan-store.mjs'
import { runSpreadScan } from '../server/spread-scan.mjs'
import { spreadFilters } from '../shared/put-spread.mjs'

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'tm-pipeline-'))
  try { await run(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}
const stock = () => ({ id: 'stock-selection', finishedAt: '2026-10-25T09:00:00Z', filters: { minPrice: 5, maxPrice: 150, minVolume: 5e6 }, entries: ['PASS', 'LOW', 'BLOCKED', 'MISSING'].map(symbol => ({ symbol })) })
const options = (extra = {}) => ({ now: () => new Date('2026-10-26T15:00:00Z'), wait: async () => {}, connection: { close() {}, Api: null }, cache: {}, ...extra })

test('blocked stock aliases persist, unblock restores eligibility and corrupt blocklists fail closed', () => fixture(async directory => {
  const path = join(directory, 'blocked.json'), list = await createBlockedStocks(path)
  await list.update(' brk.b ', true)
  assert.equal(stockKey('BRK B'), 'BRK-B'); assert.equal(list.has('BRK-B'), true)
  assert.equal((await createBlockedStocks(path)).has('BRK B'), true)
  await list.update('BRK-B', true); assert.equal(list.snapshot().entries.length, 1)
  await list.update('BRK B', false); assert.equal(list.has('BRK.B'), false)
  await assert.rejects(list.update('../bad', true))
  await writeFile(path, 'invalid')
  const bad = await createBlockedStocks(path)
  assert.throws(() => bad.has('AMD')); await assert.rejects(bad.update('AMD', false))
  assert.equal(await readFile(path, 'utf8'), 'invalid')
}))
test('blocked stocks cause no Yahoo or IBKR requests and completed stock selections are archived', () => fixture(async directory => {
  const blocked = new Set(['BLOCKED']), calls = []
  const service = await createStockFilter(directory, {}, { now: () => Date.parse('2026-10-25T12:00:00Z'), blocked: symbol => blocked.has(symbol), wait: async () => {}, yahoo: async symbol => { calls.push(symbol); return [{ date: '2026-10-23', close: 20, volume: 9e6 }] }, brokerFactory: () => ({ close() {}, history() { assert.fail('No fallback') } }) })
  service.start({ universeMode: 'custom', symbols: ['PASS', 'BLOCKED'] })
  while (service.snapshot().state === 'running') await new Promise(resolve => setTimeout(resolve, 2))
  const first = service.snapshot()
  assert.deepEqual(calls, ['PASS']); assert.equal(first.checked, 2)
  assert.equal(JSON.parse(await readFile(join(directory, 'history', first.id + '.json'), 'utf8')).rows[0].symbol, 'PASS')
  blocked.add('PASS'); assert.equal(service.snapshot().rows.length, 0); assert.throws(() => service.selection(first.id), /geblokkeerd/)
  blocked.delete('PASS'); assert.equal(service.selection(first.id).entries.length, 1)
}))
test('IV stage scans only filtered, unblocked stocks, keeps raw IV observations and rejects missing data', async () => {
  const state = makeFilteredIvState(stock(), { minIvr: 40 }), calls = []
  await runFilteredIvScan({}, state, options({ blocked: symbol => symbol === 'BLOCKED', scan: async (_config, symbols, part, _Api, mode) => {
    assert.equal(mode, 'stock-iv'); calls.push(...symbols); part.state = 'complete'
    if (symbols[0] !== 'MISSING') part.rows.push({ symbol: symbols[0], ivr: symbols[0] === 'LOW' ? 20 : 60 })
  } }))
  assert.deepEqual(calls, ['PASS', 'LOW', 'MISSING'])
  assert.equal(state.state, 'partial'); assert.equal(state.observations.length, 2); assert.equal(state.failures.length, 1)
  assert.deepEqual(state.rows.map(row => row.symbol), ['PASS']); assert.equal(state.universeChecked, 4)
  const selection = ivSelection(state, stock(), state.id, () => false, Date.parse('2026-10-27T15:00:00Z'))
  assert.deepEqual(selection.entries, [{ symbol: 'PASS' }])
  assert.throws(() => ivSelection(state, { ...stock(), id: 'new-stock' }, state.id), /huidige/)
  assert.throws(() => ivSelection(state, stock(), state.id, () => true, Date.parse('2026-10-27T15:00:00Z')), /geblokkeerde/)
  assert.throws(() => ivSelection(state, stock(), state.id, () => false, Date.parse('2026-11-04T15:00:00Z')), /zeven dagen/)
  assert.throws(() => ivFilters({ minIvr: '40' }))
})
test('IV cursor survives persisted restart and resumes after cancellation; five missing series pause without losing failed cursor', () => fixture(async directory => {
  const selection = stock(), state = makeFilteredIvState(selection, { minIvr: 40 })
  const controller = new AbortController()
  await runFilteredIvScan({ scanSignal: controller.signal }, state, options({ scan: async (_c, symbols, part) => { part.state = 'complete'; part.rows.push({ symbol: symbols[0], ivr: 60 }) }, wait: async () => { controller.abort(); controller.signal.throwIfAborted() } }))
  assert.equal(state.state, 'cancelled'); assert.equal(state.universeChecked, 1)
  const store = createScanStore(join(directory, 'scans.json'), 'test')
  await store.save({ iv: state })
  const restored = (await store.load()).scans.iv, calls = []
  await runFilteredIvScan({}, restored, options({ scan: async (_c, symbols, part) => { calls.push(...symbols); part.state = 'complete'; part.rows.push({ symbol: symbols[0], ivr: 60 }) } }))
  assert.deepEqual(calls, ['LOW', 'BLOCKED', 'MISSING']); assert.equal(restored.rows.length, 4)
  const paused = makeFilteredIvState({ ...selection, entries: Array.from({ length: 6 }, (_, i) => ({ symbol: `S${i}` })) }, {})
  await runFilteredIvScan({}, paused, options({ scan: async (_c, _s, part) => { part.state = 'partial' } }))
  assert.equal(paused.state, 'paused'); assert.equal(paused.retryFrom, 0); assert.equal(paused.universeChecked, 5)
}))
test('option phase excludes blocked stocks before both cache and broker requests, including resumed jobs', async () => {
  const state = { state: 'running', entries: [{ symbol: 'BLOCKED' }, { symbol: 'PASS' }], universeCount: 2, universeChecked: 0, symbolsChecked: 0, contractsChecked: 0, rows: [], warnings: [], filters: spreadFilters({ minAvgOptionVolume: 0 }) }
  const cacheRequests = [], brokerRequests = []
  await runSpreadScan({}, state, options({ blocked: symbol => symbol === 'BLOCKED', cache: { get: async symbol => { cacheRequests.push(symbol); return null } }, scan: async (_c, symbols, part) => { brokerRequests.push(...symbols); part.state = 'complete'; part.assessments.push({ symbol: symbols[0], status: 'filtered', reason: 'Low IV', source: 'broker' }) } }))
  assert.deepEqual(cacheRequests, ['PASS']); assert.deepEqual(brokerRequests, ['PASS']); assert.equal(state.universeChecked, 2)
})
test('real IV broker adapter asks for stock IV only and shares persistent IV history with option stage', async () => {
  resetScanGuards()
  const today = scanDate(), saved = [], requested = []
  class Broker extends EventEmitter {
    connect() { queueMicrotask(() => this.emit(EventName.connected)) }
    disconnect() {}
    reqMarketDataType() {}
    reqContractDetails(id, contract) { this.emit(EventName.contractDetails, id, { contract: { ...contract, conId: 1 } }); this.emit(EventName.contractDetailsEnd, id) }
    reqMktData(id, contract, generic) { assert.equal(contract.secType, 'STK'); assert.equal(generic, '106'); this.emit(EventName.tickPrice, id, 75, 20) }
    cancelMktData() {}
    reqHistoricalData(id, _contract, _end, period, size, kind) {
      requested.push(kind); assert.equal(period, '1 Y'); assert.equal(kind, 'OPTION_IMPLIED_VOLATILITY')
      for (let i = 0; i < 366; i++) this.emit(EventName.historicalData, id, new Date(Date.parse(today) - i * 86400000).toISOString().slice(0, 10), 0, 0, 0, i === 1 ? .4 : i === 2 ? .6 : .2)
      this.emit(EventName.historicalData, id, 'finished')
    }
    cancelHistoricalData() {}
    reqSecDefOptParams() { assert.fail('No option chains during IV Scan') }
    reqScannerSubscription() { assert.fail('No broad broker scanner during IV Scan') }
  }
  const state = { state: 'running', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
  await runCspScan({ clientId: 77, marketClosed: true, scanQuoteWaitMs: 1, scanPacer: { acquire: async () => {} }, saveSpreadIv: async (_symbol, history) => saved.push(history) }, ['PASS'], state, Broker, 'stock-iv')
  assert.equal(state.state, 'complete'); assert.equal(state.rows.length, 1); assert.equal(state.rows[0].ivSource, 'historical-close'); assert.equal(saved.length, 1); assert.equal(state.contractsChecked, 0)
  assert.deepEqual(requested, ['OPTION_IMPLIED_VOLATILITY'])
})

test('Sunday stock selection triggers IV only at Monday NY open, with persistent claims across restart', () => fixture(async directory => {
  let date = new Date('2026-10-25T08:00:00Z'), stocks = 0, ivs = 0, busy = false
  const path = join(directory, 'schedule.json'), deps = { now: () => date, busy: () => busy, runStock: async () => ({ state: 'complete', id: `stock-${++stocks}` }), runIv: async id => { assert.equal(id, 'stock-1'); ivs++; return { state: 'complete' } } }
  let schedule = await createWeeklySpreadSchedule(path, deps)
  await schedule.tick(); assert.equal(stocks, 1); await schedule.tick(); assert.equal(stocks, 1)
  schedule = await createWeeklySpreadSchedule(path, deps)
  date = new Date('2026-10-26T13:29:59Z'); await schedule.tick(); assert.equal(ivs, 0)
  date = new Date('2026-10-26T13:30:00Z'); busy = true; await schedule.tick(); assert.equal(ivs, 0)
  busy = false; await schedule.tick(); assert.equal(ivs, 1)
  schedule = await createWeeklySpreadSchedule(path, deps); await schedule.tick(); assert.equal(ivs, 1)
  assert.equal(schedule.snapshot().state, 'complete')
}))
test('NYSE Monday holiday waits until Tuesday; US/EU DST mismatch still uses 09:30 New York', () => fixture(async directory => {
  for (const [prefix, sunday, before, opening] of [
    ['holiday', '2026-09-06T07:00:00Z', '2026-09-07T13:30:00Z', '2026-09-08T13:30:00Z'],
    ['dst', '2026-03-08T08:00:00Z', '2026-03-09T13:29:00Z', '2026-03-09T13:30:00Z'],
  ]) {
    let date = new Date(sunday), ivs = 0
    const schedule = await createWeeklySpreadSchedule(join(directory, prefix + '.json'), { now: () => date, busy: () => false, runStock: async () => ({ state: 'complete', id: prefix }), runIv: async () => { ivs++; return { state: 'complete' } } })
    await schedule.tick(); date = new Date(before); await schedule.tick(); assert.equal(ivs, 0)
    date = new Date(opening); await schedule.tick(); assert.equal(ivs, 1)
  }
}))
test('scheduler does not duplicate concurrent, interrupted, failed or disabled weekly jobs', () => fixture(async directory => {
  let date = new Date('2026-10-25T08:00:00Z'), runs = 0, release
  const path = join(directory, 'schedule.json'), deps = { now: () => date, busy: () => false, runStock: async () => { runs++; await new Promise(resolve => { release = resolve }); return { state: 'error', message: 'No Yahoo' } }, runIv: async () => assert.fail('No IV after failed stock filter') }
  const schedule = await createWeeklySpreadSchedule(path, deps)
  const job = schedule.tick()
  while (!release) await new Promise(resolve => setTimeout(resolve, 2))
  await schedule.tick(); assert.equal(runs, 1)
  const restarted = await createWeeklySpreadSchedule(path, deps)
  assert.equal(restarted.snapshot().state, 'interrupted'); await restarted.tick(); assert.equal(runs, 1)
  release(); await job; assert.equal(schedule.snapshot().state, 'error')
  await schedule.tick(); assert.equal(runs, 1)
  await schedule.configure({ enabled: false, stockDay: 0, stockTime: '09:00', ivAtMarketOpen: true })
  date = new Date('2026-11-01T08:00:00Z'); await schedule.tick(); assert.equal(runs, 1)
  await assert.rejects(schedule.configure({ enabled: true, stockDay: 0, stockTime: '99:00', ivAtMarketOpen: true }))
}))
