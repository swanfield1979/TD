import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiveSnapshot } from '../server/ibkr-domain.mjs'

test('normaliseert actuele IBKR rekening- en positiegegevens zonder rekeningnummer', () => {
  const accountValues = new Map([
    ['NetLiquidation', { value: '12500.55', currency: 'USD' }],
    ['TotalCashValue', { value: '2500.25', currency: 'USD' }],
    ['GrossPositionValue', { value: '10000.30', currency: 'USD' }],
  ])
  const snapshot = createLiveSnapshot({
    accountValues,
    positions: [{
      conid: 123,
      symbol: 'TEST',
      localSymbol: 'TEST',
      assetCategory: 'STK',
      currency: 'USD',
      position: 10,
      marketPrice: 105,
      marketValue: 1050,
      averageCost: 100,
      unrealizedPnl: 50,
      realizedPnl: 12.5,
    }],
    generatedAt: '2026-09-26T18:30:00.000Z',
  })

  assert.equal(snapshot.netLiquidation, 12500.55)
  assert.equal(snapshot.totalCashValue, 2500.25)
  assert.equal(snapshot.asOfDate, '2026-09-26')
  assert.deepEqual(snapshot.positions[0], {
    conid: '123',
    symbol: 'TEST',
    name: 'TEST',
    assetCategory: 'STK',
    optionRight: null,
    multiplier: null,
    currency: 'USD',
    quantity: 10,
    averagePurchasePrice: 100,
    purchaseValue: 1000,
    currentPrice: 105,
    currentValue: 1050,
    difference: 50,
    differencePercentage: 5,
    realizedPnl: 12.5,
  })
  assert.equal('account' in snapshot, false)
})

test('weigert een snapshot zonder netto liquidatiewaarde', () => {
  assert.throws(
    () => createLiveSnapshot({ accountValues: new Map(), positions: [] }),
    /netto liquidatiewaarde/,
  )
})
