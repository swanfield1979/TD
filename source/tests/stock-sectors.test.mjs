import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStockSectors, SECTOR_URL } from '../server/stock-sectors.mjs'
import { normalizeSector } from '../shared/stock-sector.mjs'
import { createStockFilter } from '../server/stock-filter.mjs'
import { makeFilteredIvState, runFilteredIvScan, ivSelection } from '../server/filtered-iv-scan.mjs'
import { runSpreadScan } from '../server/spread-scan.mjs'
import { spreadFilters } from '../shared/put-spread.mjs'

const NOW = Date.parse('2026-10-25T12:00:00Z')
const response = data => ({ ok: true, json: async () => data })
const bulk = rows => response({ data: { rows } })
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'tm-sectors-'))
  try { await run(directory, join(directory, 'sectors.json')) } finally { await rm(directory, { recursive: true, force: true }) }
}
test('sector labels normalize provider taxonomies and never infer from industry or company name', () => {
  for (const [raw, expected] of [['Technology', 'Technology'], [' tech ', 'Technology'], ['Finance', 'Financials'], ['Health Care', 'Healthcare'], ['Consumer Discretionary', 'Consumer Cyclical'], ['Consumer Staples', 'Consumer Defensive'], ['Telecommunications', 'Communication Services'], ['Energy', 'Energy']]) assert.equal(normalizeSector(raw), expected)
  for (const value of ['Semiconductors', 'Apple Inc.', 'n/a', '', null, {}, 'Renewable Widgets']) assert.equal(normalizeSector(value), undefined)
})
test('one shared bulk request populates the whole universe and persistent sector cache avoids repeat downloads', () => fixture(async (_directory, path) => {
  let calls = 0
  const deps = { now: () => NOW, fetcher: async url => { calls++; assert.equal(url, SECTOR_URL); return bulk([{ symbol: 'AAPL', sector: 'Technology' }, { symbol: 'XOM', sector: 'Energy' }, { symbol: 'BRK.B', sector: 'Finance' }]) } }
  const sectors = await createStockSectors(path, deps)
  const [tech, energy, finance] = await Promise.all(['AAPL', 'XOM', 'BRK B'].map(symbol => sectors.lookup(symbol)))
  assert.equal(calls, 1); assert.equal(tech.sector, 'Technology'); assert.equal(energy.sector, 'Energy'); assert.equal(finance.sector, 'Financials')
  const restored = await createStockSectors(path, deps)
  assert.deepEqual(await restored.lookup('AAPL'), tech); assert.equal(calls, 1)
  assert.equal(restored.decorate({ symbol: 'XOM' }).sectorSource, 'Nasdaq')
}))
test('Yahoo fallback requires an exact equity ticker; unknown sectors are cached without making up a classification', () => fixture(async (_directory, path) => {
  let calls = 0
  const sectors = await createStockSectors(path, { now: () => NOW, fetcher: async url => {
    calls++
    if (url === SECTOR_URL) return bulk([{ symbol: 'AAPL', sector: 'Technology' }])
    return response({ quotes: url.includes('SOFI') ? [{ symbol: 'SOFI', quoteType: 'EQUITY', sector: 'Financial Services' }] : [{ symbol: 'OTHER', quoteType: 'EQUITY', sector: 'Energy' }, { symbol: 'NONE', quoteType: 'ETF', sector: 'Technology' }] })
  } })
  assert.equal((await sectors.lookup('SOFI')).sector, 'Financials')
  assert.deepEqual(await sectors.lookup('NONE'), {})
  await sectors.lookup('NONE'); assert.equal(calls, 3)
  const restored = await createStockSectors(path, { now: () => NOW, fetcher: async () => assert.fail('Negative lookup cache persists') })
  assert.deepEqual(await restored.lookup('NONE'), {})
}))
test('source rate limits stop repeated fallback requests and stale known classifications retain their original date', () => fixture(async (_directory, path) => {
  let now = NOW, calls = 0, available = true
  const sectors = await createStockSectors(path, { now: () => now, fetcher: async url => {
    calls++
    if (available) return bulk([{ symbol: 'AAPL', sector: 'Technology' }])
    return { ok: false, status: url === SECTOR_URL ? 503 : 429 }
  } })
  const first = await sectors.lookup('AAPL')
  now += 8 * 86400000; available = false
  const stale = await sectors.lookup('AAPL')
  assert.deepEqual(stale, first)
  await sectors.lookup('MISSING'); await sectors.lookup('OTHER')
  assert.equal(calls, 3)
}))
test('IBKR fills missing sector from existing contract details, including a negatively cached Yahoo lookup', () => fixture(async (_directory, path) => {
  const sectors = await createStockSectors(path, { now: () => NOW, fetcher: async url => url === SECTOR_URL ? bulk([{ symbol: 'AAPL', sector: 'Technology' }]) : response({ quotes: [] }) })
  await sectors.lookup('UNKNOWN')
  assert.equal((await sectors.rememberIbkr('UNKNOWN', { industry: 'Energy', category: 'Oil' })).sector, 'Energy')
  assert.equal(sectors.get('UNKNOWN').sectorSource, 'IBKR')
  assert.equal((await sectors.rememberIbkr('AAPL', { industry: 'Energy' })).sector, 'Technology', 'Fresh bulk classification remains consistent across scans')
  assert.deepEqual(await sectors.rememberIbkr('NONE', { industry: 'Semiconductors' }), {})
}))
test('legacy saved rows acquire sector metadata from cache without changing their quote timestamp', () => fixture(async (_directory, path) => {
  const sectors = await createStockSectors(path, { now: () => NOW, fetcher: async () => bulk([{ symbol: 'AAPL', sector: 'Technology' }]) })
  const old = { symbol: 'AAPL', price: 20, fetchedAt: '2026-10-23T16:00:00Z' }
  await sectors.warm([old])
  const decorated = sectors.decorate(old)
  assert.equal(decorated.sector, 'Technology'); assert.equal(decorated.fetchedAt, old.fetchedAt)
  assert.deepEqual(sectors.decorate({ symbol: 'MISSING' }), { symbol: 'MISSING' })
}))
test('selected stocks keep sector metadata through stored Stock Filter, IV selection and cached Option Scan', () => fixture(async (directory, path) => {
  const requests = []
  const sectors = await createStockSectors(path, { now: () => NOW, fetcher: async () => bulk([{ symbol: 'PASS', sector: 'Technology' }]) })
  const lookup = sectors.lookup
  sectors.lookup = async (...args) => { requests.push(args[0]); return lookup(...args) }
  const dependencies = { now: () => NOW, sectors, wait: async () => {}, yahoo: async symbol => [{ date: '2026-10-23', close: symbol === 'PASS' ? 20 : 200, volume: 9e6 }], brokerFactory: () => ({ close() {} }) }
  const stocks = await createStockFilter(join(directory, 'stocks'), {}, dependencies)
  stocks.start({ universeMode: 'custom', symbols: ['PASS', 'PRICE'] })
  while (stocks.snapshot().state === 'running') await new Promise(resolve => setTimeout(resolve, 2))
  assert.deepEqual(requests, ['PASS'], 'Sector fallback is only needed for price/volume candidates')
  const restored = await createStockFilter(join(directory, 'stocks'), {}, dependencies), selection = restored.selection(restored.snapshot().id)
  assert.equal(selection.entries[0].sector, 'Technology')
  const iv = makeFilteredIvState(selection, { minIvr: 40 })
  await runFilteredIvScan({}, iv, { cache: {}, connection: { close() {} }, wait: async () => {}, now: () => new Date(NOW), scan: async (_c, symbols, part) => { part.state = 'complete'; part.rows.push({ symbol: symbols[0], ivr: 60 }) } })
  const options = ivSelection(iv, selection, iv.id, () => false, NOW)
  assert.equal(options.entries[0].sectorSource, 'Nasdaq')
  const spreads = { state: 'running', entries: options.entries, rows: [], assessments: [], warnings: [], contractsChecked: 0, filters: spreadFilters({ minAvgOptionVolume: 0 }) }
  await runSpreadScan({}, spreads, { cache: { get: async () => null }, now: () => new Date(NOW), connection: { close() {} }, scan: async (_c, symbols, part) => { part.state = 'complete'; part.rows = [{ symbol: symbols[0], returnOnRisk: 10 }]; part.assessments = [{ source: 'broker', status: 'match' }] } })
  assert.equal(spreads.rows[0].sector, 'Technology'); assert.equal(spreads.rows[0].sectorAsOf, selection.entries[0].sectorAsOf)
}))
test('unavailable sector sources never reject a stock that satisfies price and volume', () => fixture(async (directory, path) => {
  let calls = 0
  const sectors = await createStockSectors(path, { now: () => NOW, fetcher: async () => { calls++; throw Error('Network unavailable') } })
  const stocks = await createStockFilter(join(directory, 'stocks'), {}, { now: () => NOW, sectors, wait: async () => {}, yahoo: async () => [{ date: '2026-10-23', close: 20, volume: 9e6 }], brokerFactory: () => ({ close() {} }) })
  stocks.start({ universeMode: 'custom', symbols: ['PASS', 'OTHER'] })
  while (stocks.snapshot().state === 'running') await new Promise(resolve => setTimeout(resolve, 2))
  assert.equal(stocks.snapshot().rows.length, 2); assert.equal(stocks.snapshot().state, 'complete')
  assert.equal(stocks.snapshot().rows[0].sector, undefined)
  assert.ok(calls <= 3)
}))
