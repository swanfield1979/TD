import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createYahooOptionClient, normalizeYahooOption, yahooSpreadContracts, yahooSymbol } from '../server/yahoo-option-chains.mjs'
import { spreadFilters } from '../shared/put-spread.mjs'
import { runSpreadScan } from '../server/spread-scan.mjs'
const at = Date.parse('2026-10-28T14:00:00Z'), expiry = '20270122', expiration = Date.parse('2027-01-22T00:00:00Z') / 1000
const raw = (strike, bid, ask, extra = {}) => ({ contractSymbol: `TEST270122P${String(strike * 1000).padStart(8, '0')}`, contractSize: 'REGULAR', currency: 'USD', strike, bid, ask, volume: null, openInterest: 100, impliedVolatility: .5, lastTradeDate: at / 1000 - 86400, ...extra })
const put = (strike, bid, ask) => normalizeYahooOption(raw(strike, bid, ask), 'TEST', expiry, 'P', new Date(at).toISOString())
const snapshot = { symbol: 'TEST', underlyingPrice: 110, fetchedAt: new Date(at).toISOString(), requests: 2, chains: [{ expiry, puts: [put(75, 1.2, 1.4), put(65, .5, .6)], calls: [] }] }
const json = result => new Response(JSON.stringify({ optionChain: { result: [result], error: null } }), { headers: { 'Content-Type': 'application/json' } })
test('normalization rejects adjusted, non-USD, wrong-root/date/strike contracts and keeps unknown volume unknown', () => {
  assert.equal(put(75, 1.2, 1.4).volume, null)
  assert.notEqual(put(75, 1.2, 1.4).lastTradeAt, put(75, 1.2, 1.4).fetchedAt)
  for (const extra of [{ contractSize: 'MINI' }, { currency: 'EUR' }, { contractSymbol: 'TEST1270122P00075000' }, { contractSymbol: 'OTHER270122P00075000' }, { strike: 74 }, { contractSymbol: 'TEST270123P00075000' }]) assert.equal(normalizeYahooOption(raw(75, 1.2, 1.4, extra), 'TEST', expiry, 'P', ''), null)
  assert.equal(yahooSymbol('BRK B'), 'BRK-B')
  assert.throws(() => yahooSymbol('../AAPL'))
})
test('one request per selected expiration with session reuse, persistent cache and original acquisition times', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tm-yahoo-'))
  let calls = [], clock = at
  const fetcher = async (input, options) => {
    const url = new URL(input); calls.push(url)
    if (url.hostname === 'fc.yahoo.com') return new Response('', { status: 404, headers: { 'Set-Cookie': 'A3=test; Path=/; Secure' } })
    assert.equal(options.headers.Cookie, 'A3=test')
    if (url.pathname.endsWith('getcrumb')) return new Response('valid/crumb')
    assert.equal(url.searchParams.get('crumb'), 'valid/crumb')
    const date = url.searchParams.has('date') ? expiration : at / 1000 + 86400
    return json({ quote: { symbol: 'TEST', currency: 'USD', quoteType: 'EQUITY', regularMarketPrice: 110, regularMarketTime: at / 1000 }, expirationDates: [at / 1000 + 86400, expiration],
      options: [{ expirationDate: date, calls: [], puts: [raw(75, 1.2, 1.4), raw(65, .5, .6)] }] })
  }
  try {
    const client = createYahooOptionClient({ directory, fetcher, now: () => clock, interval: 0 })
    const result = await client.scrape('TEST')
    assert.equal(calls.length, 4); assert.equal(result.requests, 2); assert.equal(result.chains.length, 1)
    assert.equal(result.chains[0].puts.length, 2)
    const original = result.chains[0].puts[0].fetchedAt
    clock += 300000
    const cached = await createYahooOptionClient({ directory, fetcher, now: () => clock, interval: 0 }).scrape('TEST')
    assert.equal(calls.length, 4); assert.equal(cached.requests, 0); assert.equal(cached.cacheHits, 2)
    assert.equal(cached.chains[0].puts[0].fetchedAt, original)
    assert.equal(cached.fetchedAt, result.fetchedAt)
    assert.notEqual(cached.generatedAt, result.generatedAt)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test('access/rate limits stop immediately without retries or alternative hosts', async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0
    const client = createYahooOptionClient({ fetcher: async () => { calls++; return new Response('', { status }) }, interval: 0 })
    await assert.rejects(client.scrape('TEST'), error => error.limited === true)
    assert.equal(calls, 1)
  }
})
test('aborted requests and invalid DTE never produce results', async () => {
  let calls = 0
  const controller = new AbortController(); controller.abort()
  const client = createYahooOptionClient({ fetcher: async () => { calls++; throw Error('Unexpected') }, interval: 0 })
  await assert.rejects(client.scrape('TEST', { signal: controller.signal }), /abort/i)
  await assert.rejects(client.scrape('TEST', { minDte: 100, maxDte: 40 }), /DTE/)
  assert.equal(calls, 0)
})
test('Yahoo shortlist uses executable bid/ask sides and does not invent delta or average option volume', () => {
  const candidates = yahooSpreadContracts(snapshot, spreadFilters())
  assert.deepEqual(candidates, [{ expiry, strike: 75 }, { expiry, strike: 65 }])
  assert.equal('delta' in snapshot.chains[0].puts[0], false)
  assert.equal('avgOptionVolume' in snapshot, false)
  assert.deepEqual(yahooSpreadContracts(snapshot, spreadFilters({ maxLoss: 939 })), [])
})
test('hybrid scan sends only the shortlisted legs to IBKR; broker results alone enter the result table', async () => {
  let calls = 0
  const state = { state: 'running', chainSource: 'yahoo', filters: spreadFilters({ minAvgOptionVolume: 0 }), universeMode: 'custom', symbols: ['TEST'], rows: [], warnings: [], contractsChecked: 0 }
  await runSpreadScan({}, state, { cache: { get: async () => null, save: async () => {} }, yahoo: { scrape: async () => snapshot }, connection: { close() {} }, now: () => new Date(at), scan: async (config, symbols, part) => {
    calls++; assert.deepEqual(config.spreadCandidateContracts, [{ expiry, strike: 75 }, { expiry, strike: 65 }])
    assert.deepEqual(symbols, ['TEST']); assert.equal(part.rows.length, 0)
    part.rows = [{ symbol: 'TEST', id: 'broker-only', returnOnRisk: 5 }]; part.contractsChecked = 2
    part.assessments = [{ symbol: 'TEST', status: 'match', source: 'broker' }]
  } })
  assert.equal(calls, 1); assert.equal(state.rows[0].id, 'broker-only'); assert.equal(state.yahooContracts, 2)
})
test('Yahoo throttling pauses at the exact cursor, while other source errors fall back to the broker', async () => {
  for (const limited of [true, false]) {
    let broker = 0, blocks = 0
    const state = { state: 'running', chainSource: 'yahoo', filters: spreadFilters({ minAvgOptionVolume: 0 }), universeMode: 'custom', symbols: ['TEST'], rows: [], warnings: [], contractsChecked: 0 }
    await runSpreadScan({}, state, { cache: { get: async () => null }, yahoo: { scrape: async () => { throw Object.assign(Error('Yahoo unavailable'), { limited }) } },
      connection: { close() {} }, now: () => new Date(at), autoBlock: async () => { blocks++ }, scan: async (config, symbols, part) => { broker++; assert.equal(config.spreadCandidateContracts, undefined); part.assessments = [{ symbol: 'TEST', source: 'broker', status: 'no-match' }] } })
    assert.equal(blocks, 0)
    assert.equal(broker, limited ? 0 : 1)
    assert.equal(state.universeChecked, limited ? 0 : 1)
    assert.equal(state.state, limited ? 'paused' : 'partial')
  }
})
