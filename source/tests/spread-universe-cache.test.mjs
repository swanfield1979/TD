import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runSpreadScan, optionsSession } from '../server/spread-scan.mjs'
import { createSpreadCache } from '../server/spread-cache.mjs'
import { spreadFilters, selectSpreads } from '../shared/put-spread.mjs'
const closed = () => new Date('2026-10-24T14:00:00Z')
const open = () => new Date('2026-10-23T14:00:00Z')
const state = () => ({ state: 'running', universeMode: 'us', symbols: [], filters: spreadFilters(), rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 })
const snapshot = (symbol, ivr = 50) => {
  const short = { symbol, expiry: '20270122', tradingClass: symbol, right: 'P', currency: 'USD', multiplier: 100, strike: 75, bid: 1.2, ask: 1.4, delta: -.12, underlyingPrice: 110, ivr, marketDataType: 2, quotedAt: '2026-10-23T19:55:00Z' }
  return { symbol, ivr, avgOptionVolume: 10000, avgOptionVolumeAt: short.quotedAt, underlyingPrice: 110, quotedAt: short.quotedAt, filters: spreadFilters(), puts: [short, { ...short, strike: 65, bid: .5, ask: .6, delta: -.08 }] }
}
test('option session excludes weekends, premarket, exact close, holidays and early closes', () => {
  assert.equal(optionsSession(closed()).open, false)
  assert.equal(optionsSession(open()).open, true)
  for (const date of ['2026-10-23T13:29:00Z', '2026-10-23T20:00:00Z', '2026-12-25T15:00:00Z', '2026-11-27T18:00:00Z']) assert.equal(optionsSession(new Date(date)).open, false, date)
  assert.equal(optionsSession(new Date('2026-11-27T17:59:00Z')).open, true)
})
test('broad universe has no 50-stock limit; every matching cache is refiltered, no broker or chain requests while closed', async () => {
  const report = state(), data = new Map(Array.from({ length: 75 }, (_, i) => [`S${i}`, snapshot(`S${i}`, i === 0 ? 5 : 50)]))
  const cache = { get: async s => data.get(s), universe: async loader => loader() }
  await runSpreadScan({}, report, { cache, now: closed, universeLoader: async () => ({ entries: [...data.keys()].map(symbol => ({ symbol })) }), scan: async () => assert.fail('No broker needed') })
  assert.equal(report.universeCount, 75); assert.equal(report.universeChecked, 75); assert.equal(report.rows.length, 74)
  assert.equal(report.cacheHits, 75); assert.equal(report.chainsSkipped, 1)
  assert.equal(report.assessments[0].status, 'filtered'); assert.equal(report.rows[0].cached, true)
  assert.equal(report.rows[0].shortQuotedAt, '2026-10-23T19:55:00Z'); assert.equal(report.rows[0].dte, 90)
  assert.equal(report.contractsChecked, 0)
})
test('unavailable broker does not prevent later cached stocks; missing cache stays missing', async () => {
  const report = { ...state(), universeMode: 'custom', symbols: ['MISSING', 'CACHED', 'ALSO_MISSING'] }
  let attempts = 0
  await runSpreadScan({}, report, { now: closed, cache: { get: async s => s === 'CACHED' ? snapshot(s) : null }, scan: async (_c, _s, part) => { attempts++; part.state = 'error'; part.message = 'IB Gateway is niet verbonden.' } })
  assert.equal(attempts, 1); assert.equal(report.rows.length, 1); assert.equal(report.universeChecked, 3)
  assert.equal(report.assessments[0].status, 'missing'); assert.equal(report.assessments[2].status, 'missing'); assert.equal(report.state, 'partial')
})
test('changed filters refilter raw cache, drop expired puts and disclose insufficient stored coverage', async () => {
  const report = { ...state(), universeMode: 'custom', symbols: ['TEST'], filters: spreadFilters({ minDte: 1, maxDte: 365, minBuffer: 0 }) }
  const data = snapshot('TEST'); data.puts.push(...data.puts.map(p => ({ ...p, expiry: '20251001' })))
  await runSpreadScan({}, report, { now: closed, cache: { get: async () => data } })
  assert.equal(report.rows.length, 1); assert.equal(report.rows[0].expiry, '20270122'); assert.equal(report.state, 'partial')
  assert.match(report.warnings[0], /niet volledig/)
  assert.equal(selectSpreads(data.puts, '2026-10-24', { maxPrice: 100 }).length, 0)
})
test('stop and resume retain completed stock cursor without requesting those stocks again', async () => {
  const report = { ...state(), universeMode: 'custom', symbols: ['A', 'B'] }, controller = new AbortController(), called = []
  const scan = async (_config, symbols, part) => { called.push(symbols[0]); part.state = 'complete'; part.assessments.push({ symbol: symbols[0], status: 'filtered', reason: 'IV too low' }) }
  const cache = { get: async () => null }
  await runSpreadScan({ scanSignal: controller.signal }, report, { cache, scan, now: open, checkpoint: async () => { if (report.universeChecked === 1) controller.abort() } })
  assert.equal(report.state, 'cancelled'); assert.equal(report.universeChecked, 1)
  await runSpreadScan({}, report, { cache, scan, now: open })
  assert.deepEqual(called, ['A', 'B']); assert.equal(report.universeChecked, 2); assert.equal(report.chainsSkipped, 2)
})
test('raw quotes persist across cache instances, isolate gateways and use old universe after source failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tm-spread-cache-'))
  try {
    const cache = createSpreadCache(dir, 'gateway-a')
    await cache.save('TEST', snapshot('TEST'))
    await cache.saveIv('TEST', { bars: [{ date: '20261023', close: .4 }], day: '2026-10-23' })
    assert.equal((await createSpreadCache(dir, 'gateway-a').getIv('TEST')).bars[0].close, .4)
    await assert.rejects(createSpreadCache(dir, 'gateway-b').getIv('TEST'), /Ongeldige/)
    assert.equal((await createSpreadCache(dir, 'gateway-a').get('TEST')).puts.length, 2)
    await assert.rejects(createSpreadCache(dir, 'gateway-b').get('TEST'), /Ongeldige/)
    const universe = { entries: [{ symbol: 'TEST' }], updatedAt: '2026-10-23' }
    await cache.universe(async () => universe)
    const old = await cache.universe(async () => { throw Error('offline') })
    assert.equal(old.cached, true); assert.deepEqual(old.entries, universe.entries)
    assert.equal(await cache.get('MISSING'), null)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
