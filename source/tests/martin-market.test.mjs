import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanMarket, dailyCacheKey } from '../server/martin-market-scan.mjs'

async function directory(t) { const dir = await mkdtemp(join(tmpdir(), 'martin-market-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir }
const now = Date.parse('2026-10-16T17:00:00Z')
const bars = Array.from({ length: 65 }, (_, i) => {
  const close = 20 + i * .2
  return { date: new Date(Date.parse('2026-10-15T00:00:00Z') - (64 - i) * 86400000).toISOString().slice(0, 10), open: close, high: close + (i === 64 ? .1 : 1.5), low: close - (i === 64 ? .1 : 1.5), close, volume: 5e6 }
})
const universe = count => ({ kind: 'us', name: 'Testbeurzen', updatedAt: new Date(now).toISOString(), sources: [], entries: Array.from({ length: count }, (_, i) => ({ symbol: `NEW${i}` })) })
test('1001 aandelen buiten de oude shortlist: stoppen, hervatten en koerscache', async t => {
  const dir = await directory(t), controller = new AbortController()
  let downloads = 0, universeCalls = 0
  const deps = { now: () => now, wait: async () => {}, loadUsUniverse: async () => { universeCalls++; return universe(1001) }, download: async symbol => { downloads++; return { symbol, bars } } }
  const stopped = await scanMarket({ directory: dir, signal: controller.signal, onProgress: p => { if (p.checked >= 3) controller.abort() } }, deps)
  assert.equal(stopped.requested, 1001); assert.equal(stopped.analyzed, 3); assert.equal(stopped.canResume, true)
  const resumed = await scanMarket({ directory: dir, resume: true }, deps)
  assert.equal(resumed.complete, true); assert.equal(resumed.analyzed, 1001); assert.equal(resumed.pending, 0)
  assert.equal(universeCalls, 1); assert.equal(downloads, 1001)
  assert.equal(resumed.lists.focus.length, 20)
  assert.ok(resumed.lists.leaders.every(row => row.symbol.startsWith('NEW')))
  const cached = await scanMarket({ directory: dir }, deps)
  assert.equal(cached.cacheHits, 1001); assert.equal(downloads, 1001)
  await assert.rejects(scanMarket({ directory: dir, resume: true }, deps), /hervatbare/)
})
test('Bronbegrenzing houdt niet-verwerkte aandelen over voor hervatten', async t => {
  const dir = await directory(t)
  const deps = { now: () => now, wait: async () => {}, loadUsUniverse: async () => universe(6), download: async symbol => { if (symbol === 'NEW0') throw Error('Yahoo HTTP 429'); return { symbol, bars } } }
  const result = await scanMarket({ directory: dir }, deps)
  assert.equal(result.complete, false); assert.equal(result.pending, 4); assert.equal(result.analyzed, 2)
  assert.equal(result.failures.length, 0)
  const resumed = await scanMarket({ directory: dir, resume: true }, { ...deps, download: async symbol => ({ symbol, bars }) })
  assert.equal(resumed.analyzed, 6)
})
test('Invalide historie telt als data-uitval, niet als een beoordeeld aandeel', async t => {
  const result = await scanMarket({ directory: await directory(t) }, { now: () => now, wait: async () => {}, loadUsUniverse: async () => universe(3), download: async symbol => ({ symbol, bars: symbol === 'NEW0' ? bars.slice(-2) : bars }) })
  assert.equal(result.analyzed, 2); assert.equal(result.checked, 3); assert.equal(result.failures.length, 1)
})
test('Premarket vraagt alleen ADR/liquiditeitskandidaten op en verwerpt oude snapshots', async t => {
  const preNow = Date.parse('2026-10-16T12:00:00Z'), seen = []
  const result = await scanMarket({ directory: await directory(t) }, { now: () => preNow, wait: async () => {}, loadUsUniverse: async () => universe(3), download: async symbol => ({ symbol, bars: symbol === 'NEW0' ? bars.map(b => ({ ...b, volume: 1 })) : bars }), downloadPremarket: async symbol => { seen.push(symbol); return { premarket: { asOf: '2026-10-16T11:00:00Z', price: 40, volume: 2e6 } } } })
  assert.deepEqual(seen, ['NEW1', 'NEW2']); assert.equal(result.lists.premarket.length, 0)
  assert.equal(result.rows[1].premarket.status, 'ONGELDIG_OF_OUD')
})
test('Cacheperiode wisselt na slot; hervatten op andere beursdatum wordt geweigerd', async t => {
  assert.notEqual(dailyCacheKey(Date.parse('2026-10-16T19:00:00Z')), dailyCacheKey(Date.parse('2026-10-16T20:15:00Z')))
  const dir = await directory(t), controller = new AbortController()
  const deps = { now: () => now, wait: async () => {}, loadUsUniverse: async () => universe(4), download: async symbol => ({ symbol, bars }) }
  await scanMarket({ directory: dir, signal: controller.signal, onProgress: p => { if (p.checked >= 3) controller.abort() } }, deps)
  await assert.rejects(scanMarket({ directory: dir, resume: true }, { ...deps, now: () => now + 86400000 }), /hervatbare/)
})
