import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeShortlist, ivMetrics, leapPut, compareLeaps } from '../shared/leaps-scan.mjs'
const today = '2026-10-13'
const expiry = days => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0,10).replaceAll('-', '')
const quote = { symbol: 'HOOD', expiry: expiry(400), strike: 40, underlyingPrice: 100, delta: -.12,
  bid: 8, ask: 8.5, multiplier: 100, right: 'P', currency: 'USD', ivr: 60, ivPercentile: 70 }
test('manual shortlist normalizes, deduplicates and rejects invalid or oversized input', () => {
  assert.deepEqual(normalizeShortlist([' hood ', 'NVDA', 'HOOD']), ['HOOD','NVDA'])
  for (const values of [null, ['../../etc'], [''], [123], Array(51).fill('HOOD')]) assert.throws(() => normalizeShortlist(values))
})
test('IV percentile and IV rank remain distinct; insufficient coverage is rejected', () => {
  const bars = Array.from({length: 365}, (_, i) => ({date: new Date(Date.parse(`${today}T00:00:00Z`) - i * 86400000).toISOString().slice(0,10), close: i === 0 ? .6 : .2}))
  const metrics = ivMetrics(.4, bars, today)
  assert.ok(Math.abs(metrics.ivr - 50) < 1e-8)
  assert.ok(metrics.ivPercentile > 99)
  assert.equal(ivMetrics(.4, bars.slice(0,20), today), null)
})
test('Leaps uses bid, full cash collateral, expiry break-even and 50% exit', () => {
  const row = leapPut(quote,today)
  assert.equal(row.premium,800); assert.equal(row.collateral,4000)
  assert.equal(row.breakEven,32); assert.equal(row.exitPrice,4)
  assert.ok(Math.abs(row.buffer - 68) < 1e-8)
  assert.equal(row.annualizedYield,18.25)
  for (const change of [{ivr:40},{ivPercentile:50},{delta:-.16},{delta:-.09},{delta:.12},{bid:0},{ask:7},{multiplier:10},{underlyingPrice:40},{expiry:expiry(51)},{expiry:expiry(701)},{expiry:expiry(299)}])
    assert.equal(leapPut({...quote,...change},today),null)
  for(const dte of [30,50,300,700]) assert.ok(leapPut({...quote,expiry:expiry(dte)},today))
})
test('long puts must beat strongest short comparison within delta tolerance, never another symbol', () => {
  const long = leapPut(quote,today)
  const short = leapPut({...quote,expiry:expiry(40),bid:.5,ask:.6},today)
  let [result] = compareLeaps([long,short])
  assert.equal(result.qualifies,true); assert.equal(result.reference.id,short.id)
  const betterShort = leapPut({...quote,expiry:expiry(40),bid:1,ask:1.1,strike:41},today)
  ;[result] = compareLeaps([long,short,betterShort])
  assert.equal(result.qualifies,false); assert.equal(result.reference.id,betterShort.id)
  for(const reference of [{...short,symbol:'NVDA'},{...short,absoluteDelta:.15}]) {
    const [missing] = compareLeaps([long,reference])
    assert.equal(missing.qualifies,false); assert.equal(missing.reference,null)
  }
})
