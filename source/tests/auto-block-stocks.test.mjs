import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { autoBlockStock, shouldAutoBlock, reconcileMissingStocks } from '../server/auto-block-stocks.mjs'
import { createBlockedStocks } from '../server/blocked-stocks.mjs'
import { makeFilteredIvState, runFilteredIvScan } from '../server/filtered-iv-scan.mjs'
import { createStockFilter } from '../server/stock-filter.mjs'
import { runSpreadScan } from '../server/spread-scan.mjs'
import { spreadFilters } from '../shared/put-spread.mjs'

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'tm-auto-block-'))
  try { await run(directory, join(directory, 'blocked.json')) } finally { await rm(directory, { recursive: true, force: true }) }
}
const missingIv = 'Geen bruikbare IV of recente volledige IV-jaarhistorie. Controleer beschikbaarheid in TWS en datarechten; er wordt geen IV verzonnen.'
test('the missing-data examples are blocked, ordinary filter rejections and optional sectors are not', () => {
  for (const message of [missingIv, 'AIOK: IBKR 162: HMDS query returned no data: AIOK@SMART Option_Implied_Volatility', 'Geen volledige IV-jaarhistorie.', 'Geen recente volledige slotkoers en dagvolume beschikbaar.', 'Geen ondersteund USD-aandeel.', 'Yahoo HTTP 404']) assert.equal(shouldAutoBlock({ message }), true, message)
  for (const message of ['Geen passende spread gevonden.', 'IV-rank lager dan minimum', 'Geen standaardputs binnen de gekozen looptijd en buffer beschikbaar.', 'Sector onbekend', 'Gemiddeld optievolume onbekend']) assert.equal(shouldAutoBlock({ message }), false, message)
})
test('global outages, missing permissions, pacing, timeouts and cancellation do not create permanent blocks', () => {
  for (const message of ['IBKR Gateway niet bereikbaar.', 'IBKR-aanvraag verlopen.', 'Connection closed', 'read ECONNRESET', 'No market data permissions', 'Not subscribed', 'IBKR-pauze actief', 'pacing violation', 'Yahoo HTTP 429', 'Yahoo HTTP 503', 'fetch failed', 'Scan gestopt door gebruiker.']) assert.equal(shouldAutoBlock({ code: 'IV_UNAVAILABLE', message }), false, message)
  assert.equal(shouldAutoBlock({ ibCode: 354, code: 'IV_UNAVAILABLE', message: 'Onbekende brokertekst' }), false)
  assert.equal(shouldAutoBlock({ code: 'VOLUME_UNAVAILABLE', message: 'Gemiddeld optievolume onbekend' }), false)
})
test('automatic block reason, scan stage and timestamp persist; manual blocks are retained', () => fixture(async (_directory, path) => {
  const store = await createBlockedStocks(path)
  await autoBlockStock(store, { symbol: 'ALM', message: missingIv, stage: 'iv' })
  const restored = await createBlockedStocks(path), entry = restored.snapshot().entries[0]
  assert.equal(restored.has('ALM'), true); assert.equal(entry.automatic, true); assert.equal(entry.stage, 'iv'); assert.equal(entry.reason, missingIv)
  await restored.update('MANUAL', true)
  await autoBlockStock(restored, { symbol: 'MANUAL', message: missingIv, stage: 'iv' })
  assert.equal(restored.snapshot().entries.find(item => item.symbol === 'MANUAL').automatic, undefined)
}))
test('unblocking survives restart and old failure reports cannot reblock it; a new failed scan can', () => fixture(async (_directory, path) => {
  const store = await createBlockedStocks(path), observedAt = new Date(Date.now() - 10000).toISOString()
  const scan = { failures: [{ symbol: 'ALM', message: missingIv, observedAt }], rows: [] }
  await reconcileMissingStocks(store, { iv: scan }); assert.equal(store.has('ALM'), true)
  await store.update('ALM', false)
  const restored = await createBlockedStocks(path)
  await reconcileMissingStocks(restored, { iv: scan }); assert.equal(restored.has('ALM'), false)
  await autoBlockStock(restored, { symbol: 'ALM', message: missingIv, stage: 'iv', observedAt: new Date(Date.now() + 1000).toISOString() })
  assert.equal(restored.has('ALM'), true)
}))
test('IV scan automatically blocks missing histories, continues past five and skips them in the next scan', () => fixture(async (_directory, path) => {
  const store = await createBlockedStocks(path), symbols = ['AIOK', 'ALM', 'BOLT', 'CBRS', 'FPS', 'FRVO'], calls = []
  const selection = { id: 'stocks', entries: symbols.map(symbol => ({ symbol })) }
  const dependencies = { cache: {}, connection: { close() {} }, blocked: symbol => store.has(symbol), autoBlock: failure => autoBlockStock(store, failure), wait: async () => {}, scan: async (_c, values, part) => { calls.push(...values); part.state = 'partial'; part.failures = [{ symbol: values[0], code: 'IV_UNAVAILABLE', message: missingIv }] } }
  const iv = makeFilteredIvState(selection, {})
  await runFilteredIvScan({}, iv, dependencies)
  assert.equal(iv.state, 'partial'); assert.equal(iv.universeChecked, 6); assert.equal(iv.autoBlocked, 6); assert.equal(iv.retryFrom, undefined)
  assert.equal(iv.failures.every(row => row.automaticallyBlocked), true)
  await runFilteredIvScan({}, makeFilteredIvState(selection, {}), dependencies)
  assert.equal(calls.length, 6)
}))
test('broker connection errors stop IV without blocking the active stock', () => fixture(async (_directory, path) => {
  const store = await createBlockedStocks(path), iv = makeFilteredIvState({ id: 'stocks', entries: [{ symbol: 'PASS' }] }, {})
  await runFilteredIvScan({}, iv, { cache: {}, connection: { close() {} }, autoBlock: failure => autoBlockStock(store, failure), scan: async (_c, _v, part) => { part.state = 'error'; part.message = 'Gateway niet bereikbaar.' } })
  assert.equal(iv.state, 'error'); assert.equal(store.snapshot().entries.length, 0)
}))
test('stock filter auto-blocks confirmed missing Yahoo data after fallback fails, but not a source-wide outage', () => fixture(async (directory, path) => {
  const store = await createBlockedStocks(path), stock = await createStockFilter(join(directory, 'stocks'), {}, { blocked: symbol => store.has(symbol), autoBlock: failure => autoBlockStock(store, failure), yahoo: async () => { throw Error('Geen recente volledige slotkoers en dagvolume beschikbaar.') }, brokerFactory: () => ({ close() {}, history() { throw Error('Gateway niet bereikbaar.') } }) })
  stock.start({ universeMode: 'custom', symbols: ['MISSING'] })
  while (stock.snapshot().state === 'running') await new Promise(resolve => setTimeout(resolve, 2))
  assert.equal(store.has('MISSING'), true); assert.equal(stock.snapshot().failures[0].automaticallyBlocked, true)
  const outage = await createStockFilter(join(directory, 'outage'), {}, { autoBlock: failure => autoBlockStock(store, failure), yahoo: async () => { throw Object.assign(Error('Yahoo HTTP 429'), { limited: true }) }, brokerFactory: () => ({ close() {} }) })
  outage.start({ universeMode: 'custom', symbols: ['OTHER'] })
  while (outage.snapshot().state === 'running') await new Promise(resolve => setTimeout(resolve, 2))
  assert.equal(outage.snapshot().state, 'paused'); assert.equal(store.has('OTHER'), false)
}))
test('Option Scan auto-blocks genuine missing IV while normal no-match stocks stay available', () => fixture(async (_directory, path) => {
  const store = await createBlockedStocks(path), state = { state: 'running', entries: [{ symbol: 'MISSING' }, { symbol: 'PASS' }], rows: [], warnings: [], contractsChecked: 0, filters: spreadFilters({ minAvgOptionVolume: 0 }) }
  await runSpreadScan({}, state, { cache: { get: async () => null }, connection: { close() {} }, wait: async () => {}, autoBlock: failure => autoBlockStock(store, failure), scan: async (_c, values, part) => { part.state = 'partial'; part.assessments.push(values[0] === 'MISSING' ? { symbol: values[0], status: 'missing', code: 'IV_UNAVAILABLE', reason: missingIv } : { symbol: values[0], status: 'no-match', reason: 'Geen passende spread gevonden.' }) } })
  assert.equal(store.has('MISSING'), true); assert.equal(store.has('PASS'), false); assert.equal(state.autoBlocked, 1)
}))
test('migration skips failures when a usable result exists and excludes general broker errors', () => fixture(async (_directory, path) => {
  const store = await createBlockedStocks(path)
  await reconcileMissingStocks(store, { iv: { failures: [{ symbol: 'OLD', message: missingIv }, { symbol: 'VALID', message: missingIv }, { symbol: 'BRK B', message: missingIv }, { symbol: 'OFFLINE', message: 'Gateway niet bereikbaar.' }], rows: [{ symbol: 'VALID' }, { symbol: 'BRK.B' }] } })
  assert.deepEqual(store.snapshot().entries.map(row => row.symbol), ['OLD'])
}))
