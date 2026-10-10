import { EventEmitter } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventName, MarketDataType } from '@stoqey/ib'
import { runCspScan } from '../server/csp-scanner.mjs'
import { scanDate } from '../shared/csp-scan.mjs'

for (const fallback of [false, true]) test(fallback ? 'closed-market quotes and disabled IV scanner use frozen data and active-stock fallback' : 'Gateway scan prioritizes holdings, discovers stocks, applies filters and cleans subscriptions', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => `Symbol,Security\n${Array.from({ length: 501 }, (_, i) => `SP${i},Company`).join('\n')}` }))
  const today = scanDate()
  const expiry = new Date(Date.parse(`${today}T00:00:00Z`) + 40 * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
  const checked = [], subscriptions = new Set(), marketDataTypes = []
  let disconnected = false
  class FakeApi extends EventEmitter {
    connect() { queueMicrotask(() => this.emit(EventName.connected)) }
    disconnect() { disconnected = true }
    reqMarketDataType(type) { this.marketDataType = type; marketDataTypes.push(type) }
    reqContractDetails(id, contract) { checked.push(contract.symbol); this.emit(EventName.contractDetails, id, { contract: { ...contract, conId: 1 } }); this.emit(EventName.contractDetailsEnd, id) }
    reqMktData(id, contract) {
      subscriptions.add(id)
      if (fallback && this.marketDataType === MarketDataType.DELAYED) return
      this.emit(EventName.marketDataType, id, this.marketDataType)
      this.emit(EventName.tickPrice, id, 1, contract.secType === 'STK' ? 24 : 0.5)
      this.emit(EventName.tickPrice, id, 2, contract.secType === 'STK' ? 25 : 0.6)
      if (contract.secType === 'STK') this.emit(EventName.tickGeneric, id, 24, 0.4)
      else this.emit(EventName.tickOptionComputation, id, 13, 0, 0.4, contract.strike === 20 ? -0.18 : -0.21, 0.5, 0, 0, 0, 0, 24)
    }
    cancelMktData(id) { subscriptions.delete(id) }
    reqHistoricalData(id) {
      for (let index = 0; index < 365; index++) {
        const date = new Date(Date.parse(`${today}T00:00:00Z`) - index * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
        this.emit(EventName.historicalData, id, date, 0, 0, 0, index % 2 ? 0.2 : 0.6)
      }
      this.emit(EventName.historicalData, id, 'finished')
    }
    cancelHistoricalData() {}
    reqSecDefOptParams(id) { this.emit(EventName.securityDefinitionOptionParameter, id, 'SMART', 1, 'STANDARD', '100', [expiry], [20, 22]); this.emit(EventName.securityDefinitionOptionParameterEnd, id) }
    reqScannerSubscription(id, subscription) {
      checked.push(subscription.locationCode)
      if (fallback && subscription.scanCode === 'HIGH_OPT_IMP_VOLAT') {
        this.emit(EventName.error, new Error('Scanner type with code 27 is disabled.'), 162, id)
        return
      }
      if (subscription.locationCode === 'STK.US.NASDAQ') {
        for (const symbol of ['OWNED', 'NEW']) this.emit(EventName.scannerData, id, 0, { contract: { symbol, secType: 'STK', currency: 'USD', conId: 2 } })
      } else this.emit(EventName.scannerData, id, 0, { contract: { symbol: 'NOT_SP', secType: 'STK', conId: 3 } })
      this.emit(EventName.scannerDataEnd, id)
    }
    cancelScannerSubscription() {}
  }
  const state = { portfolio: [], market: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
  await runCspScan({ clientId: 77, scanQuoteWaitMs: 1 }, ['OWNED'], state, FakeApi)
  assert.equal(state.state, fallback ? 'partial' : 'complete')
  if (fallback) {
    assert.ok(marketDataTypes.includes(MarketDataType.FROZEN))
    assert.equal(state.portfolio[0].marketDataType, MarketDataType.FROZEN)
    assert.equal(state.warnings.filter((warning) => warning.includes('MOST_ACTIVE')).length, 2)
  }
  assert.equal(checked[0], 'OWNED')
  assert.equal(state.portfolio.length, 1)
  assert.equal(state.portfolio[0].symbol, 'OWNED')
  assert.equal(state.market.length, 1)
  assert.equal(state.market[0].symbol, 'NEW')
  assert.equal(state.market[0].universe, 'NASDAQ')
  assert.equal(state.contractsChecked, 4)
  assert.equal(state.symbolsChecked, 2)
  assert.equal(subscriptions.size, 0)
  assert.equal(disconnected, true)
})
