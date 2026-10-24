import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { volumeSnapshot, volumeGate } from '../shared/option-volume.mjs'
import { spreadDefaults, spreadFilters } from '../shared/put-spread.mjs'
import { runCspScan } from '../server/csp-scanner.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'
import { createSpreadCache } from '../server/spread-cache.mjs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
test('defaults reflect the requested search profile; volume is an independent configurable filter', () => {
  assert.deepEqual([spreadDefaults.minPrice, spreadDefaults.maxPrice, spreadDefaults.minIvr, spreadDefaults.minDte, spreadDefaults.maxDte, spreadDefaults.minBuffer, spreadDefaults.minProfit, spreadDefaults.maxLoss, spreadDefaults.minOtm, spreadDefaults.maxQuoteSpread], [5,150,20,40,100,25,15,1000,70,1])
  assert.equal(spreadDefaults.minAvgOptionVolume, 5000)
  for (const value of [-1, .5, null, '5000']) assert.throws(() => spreadFilters({ minAvgOptionVolume: value }))
})
test('volume counts contracts without a stock multiplier; unknown is distinct from zero and partial daily totals', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  const volume = volumeSnapshot({ avgOptionVolume: 6000, callOptionVolume: 1200, putOptionVolume: 800 }, null, now)
  assert.equal(volume.avgOptionVolume, 6000); assert.equal(volume.dayOptionVolume, 2000)
  assert.equal(volumeGate(volume, 5000), 'pass')
  assert.equal(volumeGate(volumeSnapshot({ avgOptionVolume: 0 }, null, now), 5000), 'below')
  assert.equal(volumeGate(volumeSnapshot({}, null, now), 5000), 'unknown')
  assert.equal(volumeGate({}, 0), 'disabled')
  assert.equal(volumeSnapshot({ callOptionVolume: 10 }, null, now).dayOptionVolume, undefined)
  assert.equal(volumeSnapshot({ callOptionVolume: 0, putOptionVolume: 0 }, null, now).dayOptionVolume, 0)
  assert.equal(volumeSnapshot({ avgOptionVolume: -1 }, null, now).avgOptionVolume, undefined)
})
test('cached liquidity retains original dates, expires after seven days and is persisted independently of chains', async () => {
  const old = volumeSnapshot({ avgOptionVolume: 9000, callOptionVolume: 5, putOptionVolume: 5 }, null, new Date('2026-10-23T19:00:00Z'))
  const reused = volumeSnapshot({}, old, new Date('2026-10-24T12:00:00Z'))
  assert.equal(reused.avgOptionVolumeAt, old.avgOptionVolumeAt); assert.equal(reused.volumeSource, 'cache')
  assert.equal(volumeSnapshot({}, old, new Date('2026-10-31T12:00:00Z')).avgOptionVolume, undefined)
  const dir = await mkdtemp(join(tmpdir(), 'tm-volume-'))
  try {
    await createSpreadCache(dir, 'A').saveLiquidity('TEST', old)
    assert.equal((await createSpreadCache(dir, 'A').getLiquidity('TEST')).avgOptionVolume, 9000)
    await assert.rejects(createSpreadCache(dir, 'B').getLiquidity('TEST'))
  } finally { await rm(dir, { recursive: true, force: true }) }
})
for (const amount of [0, 4000, undefined]) test(`volume gate ${amount ?? 'unknown'} prevents history and chains with one underlying quote`, async () => {
  resetScanGuards()
  let quotes = 0, history = 0, chains = 0, requested, saved
  class Broker extends EventEmitter {
    connect() { queueMicrotask(() => this.emit(EventName.connected)) }
    disconnect() {}
    reqMarketDataType() {}
    reqContractDetails(id, contract) { this.emit(EventName.contractDetails, id, { contract: { ...contract, conId: 1 } }); this.emit(EventName.contractDetailsEnd, id) }
    reqMktData(id, _contract, generic) { quotes++; requested = generic; this.emit(EventName.tickPrice, id, 4, 100); if (amount !== undefined) this.emit(EventName.tickSize, id, 87, amount); this.emit(EventName.tickSize, id, 29, 0); this.emit(EventName.tickSize, id, 30, 0) }
    cancelMktData() {}
    reqHistoricalData() { history++; assert.fail('History should not be requested') }
    reqSecDefOptParams() { chains++; assert.fail('Chain should not be requested') }
  }
  const state = { filters: spreadFilters(), rows: [], puts: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
  await runCspScan({ clientId: 77, scanQuoteWaitMs: 1, scanPacer: { acquire: async () => {} }, saveSpreadLiquidity: async (_s, data) => { saved = data } }, ['TEST'], state, Broker, 'spreads')
  assert.equal(requested, '100,105,106'); assert.equal(quotes, 1); assert.equal(history, 0); assert.equal(chains, 0)
  assert.equal(state.assessments[0].status, amount === undefined ? 'missing' : 'filtered')
  assert.equal(state.assessments[0].avgOptionVolume, amount)
  assert.equal(saved.dayOptionVolume, 0)
})
