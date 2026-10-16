import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeMartin, completedBars, makeLists, premarketSignal } from '../shared/martin-selection.mjs'
import { parseSymbols, download } from '../scripts/scan-martin.mjs'

const bars = () => Array.from({ length: 65 }, (_, i) => { const close = 20 + i * 0.2; return { date: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10), open: close, high: close * 1.04, low: close * 0.96, close, volume: 5e6 } })
test('EMA leader, ADR en premier; brede stop geen focus', () => {
  const r = analyzeMartin(bars())
  assert.equal(r.trend, true); assert.equal(r.premier, true); assert.equal(r.eligible, true)
  assert.equal(r.riskFits, false); assert.equal(r.status, 'VOLGEN')
  assert.ok(Math.abs(r.stopPct - (r.trigger - r.stopReference) / r.trigger * 100) < 1e-10)
})
test('compacte inside day met beheersbare referentiestop', () => {
  const data = bars(), last = data.at(-1)
  Object.assign(last, { high: last.close + 0.1, low: last.close - 0.1 })
  const r = analyzeMartin(data)
  assert.equal(r.insideDay, true); assert.equal(r.riskFits, true); assert.equal(r.status, 'KLAARZETTEN')
})
test('onvolledige, dubbele en ongeldige data worden uitgesloten', () => {
  assert.throws(() => analyzeMartin(bars().slice(0, 30)), /60/)
  const data = bars(); data.at(-1).volume = null
  assert.throws(() => analyzeMartin(data), /OHLCV/)
  assert.throws(() => analyzeMartin([...bars(), bars()[0]]), /dubbele/)
})
test('open dag en toekomstige dagen ontbreken, DST gebruikt New York', () => {
  const data = [{ date: '2026-10-15' }, { date: '2026-10-16' }, { date: '2026-10-19' }]
  assert.equal(completedBars(data, Date.parse('2026-10-16T19:00:00Z')).length, 1)
  assert.equal(completedBars(data, Date.parse('2026-10-16T20:15:00Z')).length, 2)
})
test('premarket vereist actuele quote, handelsvenster en echt volume', () => {
  const now = Date.parse('2026-10-16T12:00:00Z'), row = { date: '2026-10-15', close: 100 }
  const quote = { asOf: '2026-10-16T11:58:00Z', price: 105, volume: 200000 }
  assert.equal(premarketSignal(quote, row, now).status, 'GAPPER')
  assert.equal(premarketSignal(null, row, now).status, 'ONTBREEKT')
  assert.equal(premarketSignal({ ...quote, asOf: '2026-10-15T11:58:00Z' }, row, now).status, 'ONGELDIG_OF_OUD')
  assert.equal(premarketSignal(quote, row, now + 4 * 3600000).status, 'ONGELDIG_OF_OUD')
  assert.equal(premarketSignal({ ...quote, volume: 1 }, row, now).status, 'GEEN_MATCH')
})
test('rankings gebruiken kandidaten; onbekende thema’s vormen geen cluster', () => {
  const base = { eligible: true, status: 'KLAARZETTEN', premarket: { status: 'ONTBREEKT' }, dayReturn: 1, monthReturn: 5 }
  const lists = makeLists([{ ...base, symbol: 'A', theme: 'AI' }, { ...base, symbol: 'B', theme: 'AI', monthReturn: 10 }, { ...base, symbol: 'C', eligible: false, monthReturn: 90 }])
  assert.deepEqual(lists.leaders.map(r => r.symbol), ['B', 'A'])
  assert.equal(lists.themes.length, 1); assert.equal(lists.focus.length, 2)
  assert.equal(lists.premarket.length, 0)
})
test('tickerlijst ontdubbelen en ongeldige tekens weigeren', () => {
  assert.deepEqual(parseSymbols('nvda,AMD\nNVDA'), ['NVDA', 'AMD'])
  assert.throws(() => parseSymbols('<script>'))
})
test('provider behoudt dagdata en telt uitsluitend afgesloten premarketcandles', async t => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  const daily = { meta: { currency: 'USD', instrumentType: 'EQUITY' }, timestamp: [Date.parse('2026-10-15T13:30:00Z') / 1000], indicators: { quote: [{ open: [100], high: [103], low: [99], close: [102], volume: [1e6] }] } }
  const intraday = { timestamp: ['2026-10-15T11:50:00Z', '2026-10-16T07:55:00Z', '2026-10-16T11:50:00Z', '2026-10-16T11:55:00Z', '2026-10-16T12:00:00Z'].map(d => Date.parse(d) / 1000), indicators: { quote: [{ close: [10, 20, 105, 106, 200], volume: [999, 888, 100, 200, 777] }] } }
  t.mock.method(globalThis, 'fetch', async url => ({ ok: true, json: async () => ({ chart: { result: [url.includes('interval=1d') ? daily : intraday] } }) }))
  const result = await download('TEST', now)
  assert.equal(result.bars.length, 1)
  assert.deepEqual(result.premarket, { asOf: '2026-10-16T12:00:00.000Z', price: 106, volume: 300 })
})
