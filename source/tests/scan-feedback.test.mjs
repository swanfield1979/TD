import test from 'node:test'
import assert from 'node:assert/strict'
import { scanResponse, scanWarningSummary } from '../shared/scan-feedback.mjs'

test('scan failure distinguishes forbidden origin, outdated backend and unreachable API', async () => {
  for (const [status, hint] of [[403, /IBKR_ALLOWED_ORIGINS/], [404, /backend bij/], [502, /trading-monitor-api.service/]]) {
    await assert.rejects(scanResponse(new Response('{}', { status })), hint)
  }
  await assert.rejects(scanResponse(new Response('<html>Error</html>', { status: 500 })), /HTTP 500/)
  await assert.rejects(scanResponse(new Response('{}')), /geen geldig scanresultaat/)
  assert.deepEqual(await scanResponse(new Response('{"portfolio":[],"market":[]}')), { portfolio: [], market: [] })
})
test('data warnings explain the cause without revealing rejected stock names', () => {
  const summary = scanWarningSummary(['REJECTED_ONE: Actuele aandelenkoers ontbreekt.', 'REJECTED_TWO: Actuele aandelenkoers ontbreekt.',
    'STK.US.NASDAQ: IV-scanner niet beschikbaar; terugval naar MOST_ACTIVE.', 'REJECTED_THREE: IVR niet toetsbaar.'])
  assert.equal(summary[0].count, 2)
  assert.match(summary[0].label, /marktdatarechten/)
  assert.match(summary[1].label, /actieve aandelen/)
  assert.doesNotMatch(JSON.stringify(summary), /REJECTED|STK.US/)
})
