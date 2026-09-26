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
      optionStrike: null,
      currency: 'USD',
      position: 10,
      marketPrice: 105,
      marketValue: 1050,
      averageCost: 100,
      unrealizedPnl: 50,
      realizedPnl: 12.5,
      previousClose: 100,
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
    optionStrike: null,
    optionExpiry: null,
    multiplier: null,
    currency: 'USD',
    quantity: 10,
    averagePurchasePrice: 100,
    purchaseValue: 1000,
    currentPrice: 105,
    currentValue: 1050,
    difference: 50,
    differencePercentage: 5,
    previousClose: 100,
    dailyChangePercentage: 5,
    realizedPnl: 12.5,
  })
  assert.equal('account' in snapshot, false)
})

test('normaliseert optiecontractgegevens voor de Options-pagina', () => {
  const accountValues = new Map([['NetLiquidation', { value: '5000', currency: 'USD' }]])
  const snapshot = createLiveSnapshot({
    accountValues,
    positions: [{
      conid: 456,
      symbol: 'TEST',
      localSymbol: 'TEST  261120P00020000',
      assetCategory: 'OPT',
      optionRight: 'P',
      optionStrike: 20,
      optionExpiry: '20261120',
      multiplier: 100,
      currency: 'USD',
      position: -2,
      marketPrice: 1.25,
      marketValue: -250,
      averageCost: 150,
      unrealizedPnl: 50,
      realizedPnl: 0,
    }],
  })

  assert.equal(snapshot.positions[0].optionStrike, 20)
  assert.equal(snapshot.positions[0].optionExpiry, '2026-11-20')
  assert.equal(snapshot.positions[0].optionRight, 'P')
})

test('berekent de dagstijging op basis van de vorige slotkoers', () => {
  const accountValues = new Map([['NetLiquidation', { value: '1000', currency: 'USD' }]])
  const positions = [
    { conid: 1, symbol: 'UP', assetCategory: 'STK', position: 1, marketPrice: 101.25, marketValue: 101.25, averageCost: 100, unrealizedPnl: 1.25, previousClose: 100 },
    { conid: 2, symbol: 'FLAT', assetCategory: 'STK', position: 1, marketPrice: 50, marketValue: 50, averageCost: 50, unrealizedPnl: 0, previousClose: 50 },
    { conid: 3, symbol: 'DOWN', assetCategory: 'STK', position: 1, marketPrice: 48, marketValue: 48, averageCost: 50, unrealizedPnl: -2, previousClose: 50 },
    { conid: 4, symbol: 'UNKNOWN', assetCategory: 'STK', position: 1, marketPrice: 25, marketValue: 25, averageCost: 25, unrealizedPnl: 0 },
  ]

  const snapshot = createLiveSnapshot({ accountValues, positions })

  assert.equal(snapshot.positions.find((position) => position.symbol === 'UP').dailyChangePercentage, 1.25)
  assert.equal(snapshot.positions.find((position) => position.symbol === 'FLAT').dailyChangePercentage, 0)
  assert.equal(snapshot.positions.find((position) => position.symbol === 'DOWN').dailyChangePercentage, -4)
  assert.equal(snapshot.positions.find((position) => position.symbol === 'UNKNOWN').dailyChangePercentage, null)
})

test('weigert een snapshot zonder netto liquidatiewaarde', () => {
  assert.throws(
    () => createLiveSnapshot({ accountValues: new Map(), positions: [] }),
    /netto liquidatiewaarde/,
  )
})
