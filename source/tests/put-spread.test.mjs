import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { bullPutSpread, selectSpreads, spreadFilters } from '../shared/put-spread.mjs'
import { scanDate } from '../shared/csp-scan.mjs'
import { runCspScan } from '../server/csp-scanner.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'
import { restoreScans, serializeScans } from '../server/scan-store.mjs'
const today = scanDate()
const expiry = new Date(Date.parse(`${today}T00:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
const short = { symbol: 'TEST', expiry, tradingClass: 'TEST', right: 'P', currency: 'USD', multiplier: 100, strike: 75, bid: 1.2, ask: 1.4, delta: -.12, underlyingPrice: 110, ivr: 45, marketDataType: 3, quotedAt: '2026-10-24T10:00:00Z' }
const long = { ...short, strike: 65, bid: .5, ask: .6, delta: -.08 }
test('a 75/65 credit spread uses executable sides and 100 shares, not midpoint or naked collateral', () => {
  const row = bullPutSpread(short, long, today)
  assert.equal(row.credit, .6)
  assert.equal(row.maxProfit, 60)
  assert.equal(row.maxLoss, 940)
  assert.equal(row.breakEven, 74.4)
  assert.ok(Math.abs(row.returnOnRisk - 60 / 940 * 100) < 1e-10)
  assert.equal(row.otmProxy, 88)
  assert.equal(row.dte, 90)
  assert.equal(selectSpreads([short, long], today).length, 1)
  assert.equal(selectSpreads([short, long], today, { maxLoss: 939 }).length, 0)
  assert.equal(selectSpreads([short, long], today, { minProfit: 61 }).length, 0)
  assert.equal(selectSpreads([short, long], today, { minOtm: 89 }).length, 0)
  assert.equal(selectSpreads([short, long], today, { maxQuoteSpread: .1 }).length, 0)
})
test('invalid, crossed, debit, expired, adjusted and mixed contracts never become candidates', () => {
  for (const change of [{ symbol: 'OTHER' }, { expiry: '20200101' }, { tradingClass: 'ADJUSTED' }, { currency: 'EUR' }, { multiplier: 10 }, { right: 'C' }, { bid: 1, ask: .5 }, { ask: 1.3 }, { ask: 0 }, { strike: 80 }, { delta: NaN }])
    assert.equal(bullPutSpread(short, { ...long, ...change }, today), null, JSON.stringify(change))
  assert.equal(bullPutSpread({ ...short, bid: 11, ask: 12 }, long, today), null)
  assert.equal(bullPutSpread({ ...short, strike: 111 }, long, today), null)
})
test('invalid API filter values are rejected and missing keys get defaults', () => {
  assert.equal(spreadFilters({ minIvr: 0 }).minIvr, 0)
  for (const value of [{ minDte: 100, maxDte: 80 }, { minDte: 1.5 }, { minIvr: 101 }, { maxLoss: -1 }, { minBuffer: 100 }, { minProfit: '50' }, { minProfit: null }, { maxQuoteSpread: NaN }]) assert.throws(() => spreadFilters(value))
})
test('spread rows, filters and quote timestamps survive restart; active scans become interrupted', () => {
  const restored = restoreScans(serializeScans({ spreads: { state: 'running', rows: [bullPutSpread(short, long, today)], filters: spreadFilters(), warnings: [], puts: [short] } }, null, 'test'), 'test').scans.spreads
  assert.equal(restored.state, 'interrupted')
  assert.equal(restored.rows[0].shortQuotedAt, short.quotedAt)
  assert.equal(restored.filters.maxLoss, 1000)
  assert.equal(restored.puts, undefined)
})
test('broker scan pairs only matching puts, checkpoints, stays read-only and cancels data subscriptions', async () => {
  resetScanGuards()
  let disconnected = false, maxActive = 0, checkpoints = 0, chainCalls = 0, historyCalls = 0, saved
  const active = new Set()
  class Fake extends EventEmitter {
    connect() { queueMicrotask(() => this.emit(EventName.connected)) }
    disconnect() { disconnected = true }
    reqMarketDataType() { assert.equal(active.size, 0, 'Switch data type only after all active quotes finish') }
    reqContractDetails(id, contract) { this.emit(EventName.contractDetails, id, { contract: { ...contract, conId: 1 } }); this.emit(EventName.contractDetailsEnd, id) }
    reqMktData(id, contract) {
      active.add(id); maxActive = Math.max(maxActive, active.size)
      const stock = contract.secType === 'STK', q = contract.strike === 75 ? short : long
      this.emit(EventName.tickPrice, id, 1, stock ? 110 : q.bid); this.emit(EventName.tickPrice, id, 2, stock ? 110.1 : q.ask)
      if (stock) { this.emit(EventName.tickSize, id, 87, 10000); this.emit(EventName.tickSize, id, 29, 400); this.emit(EventName.tickSize, id, 30, 600) }
      if (stock) this.emit(EventName.tickGeneric, id, 24, .4)
      else this.emit(EventName.tickOptionComputation, id, 13, 0, .4, q.delta, 0, 0, 0, 0, 0, 110)
    }
    cancelMktData(id) { active.delete(id) }
    reqHistoricalData(id) {
      historyCalls++
      for (let i = 0; i < 365; i++) this.emit(EventName.historicalData, id, new Date(Date.parse(`${today}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10), 0, 0, 0, i === 0 ? .6 : .2)
      this.emit(EventName.historicalData, id, 'finished')
    }
    cancelHistoricalData() {}
    reqSecDefOptParams(id) { chainCalls++; this.emit(EventName.securityDefinitionOptionParameter, id, 'SMART', 1, 'TEST', '100', [expiry], [45, 50, 55, 60, 65, 75, 105]); this.emit(EventName.securityDefinitionOptionParameterEnd, id) }
  }
  const state = { state: 'running', filters: spreadFilters(), rows: [], puts: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
  await runCspScan({ clientId: 77, scanPacer: { acquire: async () => {} }, onSpreadSnapshot: async snapshot => { saved = snapshot }, onScanCheckpoint: async () => { checkpoints++ } }, ['TEST'], state, Fake, 'spreads')
  assert.equal(state.state, 'complete'); assert.equal(state.rows.length, 1); assert.equal(state.contractsChecked, 6)
  assert.equal(state.rows[0].maxLoss, 940); assert.equal(state.symbolsChecked, 1)
  assert.equal(disconnected, true); assert.equal(active.size, 0); assert.equal(maxActive, 4); assert.equal(checkpoints, 2)
  assert.equal(saved.puts.length, 6); assert.equal(saved.chains.length, 1)
  assert.equal(chainCalls, 1)
  const before = historyCalls
  for (const filters of [{ maxPrice: 100 }, { minIvr: 80 }]) {
    resetScanGuards()
    const filtered = { state: 'running', filters: spreadFilters(filters), rows: [], puts: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
    await runCspScan({ clientId: 77, scanPacer: { acquire: async () => {} } }, ['TEST'], filtered, Fake, 'spreads')
    assert.equal(chainCalls, 1, 'No option-chain request for a rejected stock')
    assert.equal(filtered.contractsChecked, 0); assert.equal(filtered.assessments[0].status, 'filtered')
    if (filters.maxPrice) assert.equal(historyCalls, before, 'Price filter also skips IV history')
  }
  class Fallback extends Fake {
    reqMarketDataType(type) { super.reqMarketDataType(type); this.type = type }
    reqMktData(id, contract) {
      if (contract.strike === 65 && this.type === 3) {
        active.add(id)
        this.emit(EventName.error, Error('Temporary quote error'), 200, id)
      } else super.reqMktData(id, contract)
    }
  }
  resetScanGuards()
  const fallback = { ...state, rows: [], puts: [], warnings: [], assessments: [], contractsChecked: 0 }
  await runCspScan({ clientId: 77, scanPacer: { acquire: async () => {} } }, ['TEST'], fallback, Fallback, 'spreads')
  assert.equal(fallback.rows.length, 1)
  assert.equal(fallback.rows[0].shortDataType, 3)
  assert.equal(fallback.rows[0].longDataType, 2)
  assert.equal(active.size, 0)

  for (const reason of ['stop', 'pacing']) {
    resetScanGuards()
    const controller = new AbortController()
    class Interrupted extends Fake {
      reqMktData(id, contract) {
        if (contract.secType === 'STK') return super.reqMktData(id, contract)
        active.add(id)
        queueMicrotask(() => reason === 'stop' ? controller.abort() : this.emit(EventName.error, Error('Max rate exceeded'), 100, id))
      }
    }
    const interrupted = { ...state, rows: [], puts: [], warnings: [], assessments: [], contractsChecked: 0 }
    await runCspScan({ clientId: 77, scanSignal: controller.signal, scanPacer: { acquire: async () => {} } }, ['TEST'], interrupted, Interrupted, 'spreads')
    assert.equal(interrupted.state, reason === 'stop' ? 'cancelled' : 'error')
    assert.equal(interrupted.rows.length, 0)
    assert.equal(active.size, 0, 'All subscriptions cancelled on ' + reason)
  }
})

test('prefiltered pairing matches exhaustive pairing for varied chains, missing values and filter boundaries', () => {
  let seed = 421
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32)
  for (let run = 0; run < 40; run++) {
    const f = spreadFilters({ minBuffer: run % 35, minOtm: run % 90, minProfit: run % 30, maxLoss: 100 + run * 100, maxQuoteSpread: (run % 4) / 2 })
    const puts = Array.from({ length: 50 }, (_, i) => ({ ...short, symbol: i % 3 ? 'TEST' : 'OTHER',
      strike: 10 + i * 2, bid: random() * 5, ask: random() * 6, delta: -random(), ivr: random() * 100 }))
    puts.push({ ...long, strike: NaN }, { ...short, bid: undefined }, { ...long, delta: NaN }, short, long)
    const expected = []
    for (const a of puts) for (const b of puts) {
      const row = bullPutSpread(a, b, today)
      if (row && row.underlyingPrice >= f.minPrice && row.underlyingPrice <= f.maxPrice && row.dte >= f.minDte && row.dte <= f.maxDte
        && row.ivr >= f.minIvr && row.buffer + 1e-8 >= f.minBuffer && row.maxProfit + 1e-8 >= f.minProfit && row.maxLoss <= f.maxLoss + 1e-8
        && row.otmProxy + 1e-8 >= f.minOtm && a.ask - a.bid <= f.maxQuoteSpread + 1e-8 && b.ask - b.bid <= f.maxQuoteSpread + 1e-8) expected.push(row)
    }
    expected.sort((a,b) => b.returnOnRisk - a.returnOnRisk || a.id.localeCompare(b.id))
    assert.deepEqual(selectSpreads(puts, today, f), expected)
  }
})
