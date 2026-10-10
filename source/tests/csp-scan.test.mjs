import test from 'node:test'
import assert from 'node:assert/strict'
import { cspCandidate, daysToExpiry, ivRank, scanDate, sortCandidates } from '../shared/csp-scan.mjs'

const today = '2026-10-11'
const put = { symbol: 'TEST', expiry: '20261120', strike: 20, underlyingPrice: 24, delta: -0.18,
  ivr: 45, bid: 0.5, ask: 0.6, multiplier: 100, right: 'P', currency: 'USD' }
test('CSP returns premium, collateral, delta POP and comparable annualized yield', () => {
  const row = cspCandidate(put, today)
  assert.equal(row.dte, 40)
  assert.equal(row.premium, 50)
  assert.equal(row.collateral, 2000)
  assert.equal(row.pop, 82)
  assert.equal(row.yieldPercentage, 2.5)
  assert.equal(row.annualizedYield, 22.8125)
})
test('strict POP and IVR limits; inclusive DTE and lower delta bounds', () => {
  for (const change of [{ delta: -0.20 }, { delta: -0.22 }, { delta: -0.1599 }, { delta: 0.18 }, { ivr: 30 },
    { strike: 24 }, { expiry: '20261114' }, { expiry: '20261201' }, { right: 'C' }, { multiplier: 10 },
    { bid: 0 }, { ask: 0.4 }, { delta: null }, { ivr: NaN }, { underlyingPrice: null }]) {
    assert.equal(cspCandidate({ ...put, ...change }, today), null, JSON.stringify(change))
  }
  for (const change of [{ delta: -0.16 }, { delta: -0.1999 }, { expiry: '20261115' }, { expiry: '20261130' }]) {
    assert.ok(cspCandidate({ ...put, ...change }, today))
  }
})
test('discovery restricts underlying price, portfolio does not', () => {
  for (const price of [9.99, 50.01]) {
    const quote = { ...put, strike: 5, underlyingPrice: price }
    assert.equal(cspCandidate(quote, today, true), null)
    assert.ok(cspCandidate(quote, today))
  }
  assert.ok(cspCandidate({ ...put, strike: 5, underlyingPrice: 10 }, today, true))
  assert.ok(cspCandidate({ ...put, underlyingPrice: 50 }, today, true))
})
test('IVR needs a recent complete year and is rank rather than percentile', () => {
  const bars = Array.from({ length: 366 }, (_, index) => ({ date: new Date(Date.parse('2025-10-11T00:00:00Z') + index * 86400000).toISOString().slice(0, 10), close: index % 2 ? 0.6 : 0.2 }))
  assert.ok(Math.abs(ivRank(0.4, bars, today) - 50) < 0.0001)
  assert.equal(ivRank(0.4, bars.slice(-50), today), null)
  assert.equal(ivRank(null, bars, today), null)
  assert.equal(ivRank(0.4, bars.map((bar) => ({ ...bar, close: 0.3 })), today), null)
  assert.equal(ivRank(0.4, bars.slice(0, -20), today), null)
})
test('calendar days follow New York trading date; sorting does not mutate input', () => {
  assert.equal(scanDate(new Date('2026-10-12T01:00:00Z')), today)
  assert.equal(daysToExpiry('20261120', today), 40)
  const low = cspCandidate(put, today)
  const high = cspCandidate({ ...put, symbol: 'HIGH', bid: 0.6 }, today)
  const input = [low, high]
  assert.equal(sortCandidates(input)[0].symbol, 'HIGH')
  assert.equal(input[0].symbol, 'TEST')
})
