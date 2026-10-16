import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUsListings, loadUsUniverse, US_SOURCES } from '../server/martin-universe.mjs'

const nasdaq = `Symbol|Security Name|Test Issue|ETF|NextShares
NEW|New Leader - Common Stock|N|N|N
FUND|Index ETF|N|Y|N
TEST|Test - Common Stock|Y|N|N
WAR|Company - Warrants to purchase Common Stock|N|N|N
PREF|Preferred Bank - Common Stock|N|N|N
ADR|Issuer - American Depositary Shares|N|N|N
File Creation Time: 1016202609:16||||`
const other = `ACT Symbol|Security Name|Exchange|ETF|Test Issue
BRK.B|Berkshire Common Stock|N|N|N
NEW|New Leader Common Stock|N|N|N
UNIT|Issuer Units with Common Stock|N|N|N
PFD|Issuer Preferred Stock convertible to Common Stock|N|N|N
File Creation Time: 1016202609:16||||`
test('Officiële directoryvelden sluiten fondsen, tests en afgeleide effecten uit', () => {
  assert.deepEqual(parseUsListings(nasdaq, US_SOURCES[0]).entries.map(e => e.symbol), ['NEW', 'PREF', 'ADR'])
  assert.deepEqual(parseUsListings(other, US_SOURCES[1]).entries.map(e => e.symbol), ['BRK-B', 'NEW'])
  assert.throws(() => parseUsListings(nasdaq.replace(/File Creation Time:.*/, ''), US_SOURCES[0]), /Onvolledige/)
  assert.throws(() => parseUsListings('Symbol|Name\nABC|Common Stock', US_SOURCES[0]), /kopregel/)
})
test('Nasdaq en overige beurzen worden ontdubbeld; bronuitval heeft geen shortlistfallback', async () => {
  const universe = await loadUsUniverse(undefined, async url => ({ ok: true, text: async () => url === US_SOURCES[0].url ? nasdaq : other }))
  assert.deepEqual(universe.entries.map(e => e.symbol), ['ADR', 'BRK-B', 'NEW', 'PREF'])
  assert.equal(universe.sources.length, 2)
  await assert.rejects(loadUsUniverse(undefined, async () => ({ ok: false, status: 503 })), /503/)
})
