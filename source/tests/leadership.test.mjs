import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeStock,
  rankStocks,
  selectLeaders,
  validateConfig,
} from '../shared/leadership.mjs'

function fixture(breakout = true) {
  const bars = []
  const add = (close, range = 1) => {
    const d = new Date(Date.UTC(2025, 0, 1 + bars.length * 2))
    bars.push({
      date: d.toISOString().slice(0, 10),
      open: close - 0.1,
      high: close + range / 2,
      low: close - range / 2,
      close,
      volume: 100000,
    })
  }
  for (let i = 0; i < 140; i++) add(45 + i * 0.025)
  for (let i = 1; i <= 10; i++) add(48.5 + i * 3.5, 2)
  for (let i = 0; i < 24; i++) add(82 + i * 0.1, 6 - i * 0.21)
  add(breakout ? 90 : 84.5, breakout ? 5 : 1)
  return bars
}

test('stair-step breakout uses prior range and stores full diagnostics', () => {
  const bars = fixture(),
    row = analyzeStock('TEST', bars)
  assert.equal(row.status, 'breakout')
  assert.ok(row.move.pct >= 30)
  assert.ok(row.base.sessions >= 10)
  assert.ok(row.base.high < row.close)
  assert.equal(row.base.end, bars.at(-2).date)
  assert.ok(row.indicators.rangeExpansion >= 1.3)
  for (const p of [10, 20, 50])
    assert.ok(Number.isFinite(row.indicators[`ma${p}`]))
  assert.ok(row.base.tighteningRange)
  assert.ok(row.base.advancePct <= 5)
  assert.ok(
    row.base.depthPct < 10,
    'Doorgaande impuls mag niet als diepe basis gelden',
  )
})
test('tight base is ready without expansion', () =>
  assert.equal(analyzeStock('TEST', fixture(false)).status, 'ready'))
test('short base remains forming', () => {
  const bars = fixture(false)
  bars.splice(155, 18)
  assert.equal(analyzeStock('TEST', bars).status, 'forming')
})
test('risk violation fails structure', () => {
  const bars = fixture()
  Object.assign(bars.at(-1), { open: 60, high: 61, low: 59, close: 60 })
  const row = analyzeStock('TEST', bars)
  assert.equal(row.status, 'failed')
  assert.ok(row.reasons.some((r) => r.includes('risicogrens')))
})
test('insufficient history never fabricates six-month momentum', () => {
  const row = analyzeStock('NEW', fixture().slice(-50))
  assert.equal(row.status, 'insufficient_data')
  assert.equal(row.returns[2], null)
})
test('volume optional, enforced only when configured', () => {
  const bars = fixture()
  bars.forEach((b) => (b.volume = null))
  assert.equal(analyzeStock('TEST', bars).status, 'breakout')
  assert.equal(
    analyzeStock('TEST', bars, { requireVolume: true }).status,
    'forming',
  )
})
test('momentum session indexing and unlimited impulse percentage', () => {
  const bars = fixture()
  const row = analyzeStock('TEST', bars)
  assert.equal(
    row.returns[0],
    (bars.at(-1).close / bars.at(-22).close - 1) * 100,
  )
  const extreme = fixture()
  for (let i = 140; i < extreme.length; i++)
    for (const k of ['open', 'high', 'low', 'close']) extreme[i][k] *= 3
  assert.ok(analyzeStock('MOON', extreme).move.pct > 100)
})
test('prefix scan is unchanged by future bars', () => {
  const bars = fixture(),
    earlier = analyzeStock('TEST', bars)
  const extended = [
    ...bars,
    {
      date: '2026-12-01',
      open: 200,
      high: 202,
      low: 199,
      close: 201,
      volume: 100,
    },
  ]
  assert.deepEqual(
    analyzeStock('TEST', extended.slice(0, bars.length)),
    earlier,
  )
  const changed = fixture()
  changed.at(-1).high = 150
  assert.equal(analyzeStock('TEST', changed).base.high, earlier.base.high)
  assert.equal(
    analyzeStock('TEST', changed).indicators.atr20,
    earlier.indicators.atr20,
  )
})
test('top 1/2/5 percent computed over full eligible universe per period', () => {
  const rows = rankStocks(
    Array.from({ length: 200 }, (_, i) => ({
      symbol: `S${String(i).padStart(3, '0')}`,
      returns: [i, 200 - i, i],
      status: 'forming',
    })),
  )
  assert.equal(selectLeaders(rows, 1, 0).length, 2)
  assert.equal(selectLeaders(rows, 2, 0).length, 4)
  assert.equal(selectLeaders(rows, 5, 0).length, 10)
  assert.equal(selectLeaders(rows, 1, 0)[0].symbol, 'S199')
  assert.equal(selectLeaders(rows, 1, 1)[0].symbol, 'S000')
  assert.equal(selectLeaders([], 1, 0).length, 0)
})
test('configuration and input validation', () => {
  for (const input of [
    { periods: [21, 63, 0] },
    { baseMinSessions: 0 },
    { weights: [1, 1, 1] },
    { expansionRatio: -1 },
    { requireVolume: 1 },
    { unknown: 1 },
    { baseMaxSessions: 5 },
  ])
    assert.throws(() => validateConfig(input))
  assert.throws(() =>
    analyzeStock('TEST', [
      { date: '2026-01-01', open: 10, high: 9, low: 8, close: 10 },
    ]),
  )
})
