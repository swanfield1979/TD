import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiveSnapshot, updatePosition, withPreviousBalance } from '../server/ibkr-domain.mjs'
import { optionExpiry } from '../shared/option-expiry.mjs'

test('vorige dagmeting overleeft dagwissel, herhaalde updates en herstart', () => {
  const previous = { asOfDate: '2026-09-27', netLiquidation: 1000, currency: 'USD' }
  const current = { asOfDate: '2026-09-28', netLiquidation: 1100, currency: 'USD' }
  const saved = withPreviousBalance(current, previous)
  assert.deepEqual(saved.previousBalance, { date: '2026-09-27', value: 1000 })
  const refreshed = withPreviousBalance({ ...current, netLiquidation: 1200 }, JSON.parse(JSON.stringify(saved)))
  assert.deepEqual(refreshed.previousBalance, saved.previousBalance)
  assert.deepEqual(withPreviousBalance({ ...current, asOfDate: '2026-09-29' }, refreshed).previousBalance,
    { date: '2026-09-28', value: 1200 })
  assert.equal(withPreviousBalance(current, { ...previous, currency: 'EUR' }).previousBalance, undefined)
  assert.equal(withPreviousBalance(current, undefined).previousBalance, undefined)
})

test('herhaalde portfolio-events vervangen posities en een nulupdate sluit ze', () => {
  const positions = new Map()
  const initial = { conid: 1, position: 100, assetCategory: 'STK', marketValue: 1000 }
  updatePosition(positions, initial)
  const quoteReference = [...positions.values()][0]
  updatePosition(positions, { ...initial, marketValue: 1100 })
  quoteReference.previousClose = 9
  assert.equal(positions.size, 1)
  assert.equal([...positions.values()][0].previousClose, 9)
  const accountValues = new Map([['NetLiquidation', { value: 1500, currency: 'USD' }]])
  const snapshot = createLiveSnapshot({ accountValues, positions: [initial, ...positions.values()] })
  assert.equal(snapshot.positions.length, 1)
  assert.equal(snapshot.positions[0].currentValue, 1100)
  updatePosition(positions, { ...initial, position: 0 })
  assert.equal(createLiveSnapshot({ accountValues, positions: [initial, ...positions.values()] }).positions.length, 0)
})

test('expiratie gebruikt een geldige contractdatum of de OCC-naam, nooit een verzonnen datum', () => {
  assert.equal(optionExpiry(null, 'SOFI 261023P00016000'), '2026-10-23')
  assert.equal(optionExpiry('20260230', 'SOFI 261023P00016000'), '2026-10-23')
  assert.equal(optionExpiry('2026-11-20', 'SOFI 261023P00016000'), '2026-11-20')
  assert.equal(optionExpiry(null, 'SOFI 260230P00016000'), null)
  assert.equal(optionExpiry('202610', 'SOFI'), null)
})

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
