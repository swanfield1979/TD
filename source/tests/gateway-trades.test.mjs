import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { collectSnapshot } from '../server/gateway-client.mjs'
import { gatewayClosures, gatewayOpenings, mergeExecutions, normalizeExecution } from '../shared/gateway-trades.mjs'

const contract = { conId: 1, symbol: 'SOFI', localSymbol: 'SOFI OLD PUT', secType: 'OPT', right: 'P', strike: 17, multiplier: '100', currency: 'USD' }
const execution = (id, conid, quantity, realizedPNL, time = '20260930 15:00:00') => ({
  ...normalizeExecution({ ...contract, conId: conid }, { execId: id, acctNumber: 'A', shares: Math.abs(quantity),
    side: quantity > 0 ? 'BOT' : 'SLD', price: 0.2, time }), realizedPNL,
})
const summary = { balance: { toDate: '2026-09-24' }, currency: 'USD', optionHoldings: [
  { conid: '1', quantity: -2, averageOpenPrice: 0.6, openedAt: '2026-09-01' },
  { conid: '2', quantity: -3, averageOpenPrice: 0.7, openedAt: '2026-09-02' },
] }
const snapshot = { account: 'A', positions: [{ conid: '3', quantity: -2 }, { conid: '4', quantity: -3 }], executions: [
  execution('close1.01', 1, 2, 78), execution('open1.01', 3, -2, Number.MAX_VALUE),
  execution('close2.01', 2, 3, 148), execution('open2.01', 4, -3, Number.MAX_VALUE),
] }

test('twee rolls tonen twee sluitingen en tellen nieuwe openingen niet als afsluiting', () => {
  const { closures, pending } = gatewayClosures(summary, snapshot)
  assert.equal(pending, 0)
  assert.equal(closures.length, 2)
  assert.equal(closures[0].profit, 78)
  assert.equal(closures[0].openingValue, 120)
  assert.equal(closures[0].openedAt, '2026-09-01')
  assert.deepEqual(closures.map(trade => trade.quantity), [2, 3])
})

test('herhaald ophalen, herstart en correcties dupliceren geen uitvoeringen', () => {
  const persisted = JSON.parse(JSON.stringify(mergeExecutions(snapshot.executions, snapshot.executions)))
  assert.equal(persisted.length, 4)
  const updated = mergeExecutions(persisted, [execution('close1.02', 1, 2, 75)])
  assert.equal(updated.length, 4)
  assert.equal(updated.find(row => row.execId === 'close1.02').realizedPNL, 75)
  assert.deepEqual(mergeExecutions(updated, [execution('close1.01', 1, 2, 78)]), updated)
})

test('nieuwe historie verdringt Gateway-trades zonder dubbele sluitingen', () => {
  assert.equal(gatewayClosures({ ...summary, tradesThroughDate: '2026-09-30' }, snapshot).closures.length, 0)
  assert.equal(gatewayClosures({ ...summary, balance: { toDate: '2026-09-30' }, tradesThroughDate: '2026-09-24' }, snapshot).closures.length, 2)
})

test('reconstrueert openingsdata van nieuwe posities uit bewaarde Gateway-uitvoeringen', () => {
  const live = {
    account: 'A',
    positions: [
      { conid: '3', assetCategory: 'OPT', quantity: -2, optionExpiry: '2026-10-23' },
      { conid: '4', assetCategory: 'OPT', quantity: -1, optionExpiry: '2026-10-30' },
    ],
    executions: [
      { ...execution('open-a.01', 3, -1, Number.MAX_VALUE, '20261005 14:00:00'), price: 0.5 },
      { ...execution('open-b.01', 3, -2, Number.MAX_VALUE, '20261006 14:00:00'), price: 0.8 },
      execution('partial-close.01', 3, 1, 20, '20261007 14:00:00'),
    ],
  }

  const openings = gatewayOpenings({ ...summary, tradesThroughDate: '2026-10-02' }, live)
  assert.deepEqual(openings.get('3'), {
    openedAt: '2026-10-06',
    chosenDte: 17,
    averageOpenPrice: 0.8,
  })
  assert.equal(openings.has('4'), false)
})

test('verwerkt een mutatie op de saldodag wanneer de laatste Flex-trade ouder is', () => {
  const sameDay = { positions: [], executions: [execution('same-day.01', 1, 2, 78, '20260924 15:00:00')] }
  const { closures } = gatewayClosures({ ...summary, tradesThroughDate: '2026-09-23' }, sameDay)

  assert.equal(closures.length, 1)
  assert.equal(closures[0].closedAt, '2026-09-24')
  assert.equal(closures[0].profit, 78)
})

test('gedeeltelijke sluiting en heropening op dezelfde dag blijven apart', () => {
  const live = { positions: [{ conid: '1', quantity: -1 }], executions: [
    execution('a.01', 1, 1, 39, '20260930 14:00:00'),
    execution('b.01', 1, 1, 39, '20260930 14:01:00'),
    execution('c.01', 1, -2, Number.MAX_VALUE, '20260930 14:02:00'),
    execution('d.01', 1, 1, 9, '20260930 14:03:00'),
  ] }
  const { closures } = gatewayClosures(summary, live)
  assert.equal(closures.length, 3)
  assert.equal(closures[2].openedAt, '2026-09-30')
  assert.equal(closures[2].openingValue, 20)
})

test('ontbrekende resultaten worden gemeld; sentinelwaarden worden geen winst', () => {
  const live = { ...snapshot, executions: snapshot.executions.map(row => ({ ...row, realizedPNL: Number.MAX_VALUE })) }
  assert.deepEqual(gatewayClosures(summary, live), { closures: [], pending: 2 })
})

test('IBKR-resultaat blijft zichtbaar wanneer een eerdere positie niet meer te reconstrueren is', () => {
  const live = { positions: [{ conid: '1', quantity: 5 }], executions: [execution('x.01', 1, 1, 12)] }
  const { closures } = gatewayClosures(summary, live)
  assert.equal(closures.length, 1)
  assert.equal(closures[0].profit, 12)
  assert.equal(closures[0].direction, 'short')
  assert.equal(closures[0].openedAt, null)
  assert.equal(closures[0].profitPercentage, null)
})

test('normalisatie weigert combo-totalen en andere accounts worden niet samengevoegd', () => {
  assert.equal(normalizeExecution({ ...contract, secType: 'BAG' }, {}), null)
  const live = { ...snapshot, executions: snapshot.executions.map(row => ({ ...row, account: 'B' })) }
  assert.equal(gatewayClosures(summary, live).closures.length, 0)
})

test('collector weigert een afgebroken uitvoeringsdownload', async () => {
  class MockApi extends EventEmitter {
    connect() { queueMicrotask(() => this.emit('connected')) }
    reqManagedAccts() { this.emit('managedAccounts', 'A') }
    reqAccountUpdates() {}
    reqExecutions(id) { this.emit('error', new Error('Executions geweigerd'), 321, id) }
    disconnect() {}
  }
  await assert.rejects(collectSnapshot({}, 500, MockApi), /Executions geweigerd/)
})

test('collector wacht op account, uitvoeringen en latere commissies en filtert andere accounts', async () => {
  class MockApi extends EventEmitter {
    connect() { queueMicrotask(() => this.emit('connected')) }
    reqManagedAccts() { this.emit('managedAccounts', 'A,B') }
    reqAccountUpdates(enabled) {
      if (!enabled) return
      this.emit('updateAccountValue', 'NetLiquidation', '1000', 'USD', 'A')
      this.emit('accountDownloadEnd', 'A')
    }
    reqExecutions(id, filter) {
      assert.deepEqual(filter, { acctCode: 'A' })
      this.emit('execDetails', id, contract, { execId: 'x.01', acctNumber: 'A', shares: 2, side: 'BOT', price: 0.2, time: '20260930 15:00:00' })
      this.emit('execDetails', id, contract, { execId: 'y.01', acctNumber: 'B', shares: 2, side: 'BOT', price: 0.2, time: '20260930 15:00:00' })
      this.emit('execDetailsEnd', id)
      setTimeout(() => this.emit('commissionReport', { execId: 'x.01', realizedPNL: 78, commission: 2, currency: 'USD' }), 10)
    }
    disconnect() {}
  }
  const live = await collectSnapshot({}, 500, MockApi)
  assert.equal(live.account, 'A')
  assert.equal(live.executions.length, 1)
  assert.equal(live.executions[0].realizedPNL, 78)
})
