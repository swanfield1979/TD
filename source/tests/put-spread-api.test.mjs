import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer } from 'node:net'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
test('spread API validates inputs, enforces origin and scan lock, supports stop and restores its filters', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tm-spreads-'))
  const socket = createServer().listen(0, '127.0.0.1'); await once(socket, 'listening')
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  const headers = { Origin: origin, 'X-Requested-With': 'trading-monitor', 'Content-Type': 'application/json' }
  let child
  const start = async () => {
    child = spawn(process.execPath, ['server/ibkr-api.mjs'], { stdio: 'ignore', env: { ...process.env, IBKR_API_PORT: String(port), IBKR_API_HOST: '127.0.0.1', IBKR_ALLOWED_ORIGINS: origin, IBKR_PORT: '1', IBKR_SNAPSHOT_PATH: join(directory, 'snapshot.json'), SCAN_RESULTS_PATH: join(directory, 'scans.json'), LEAPS_SHORTLIST_PATH: join(directory, 'shortlist.json') } })
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/api/put-spreads`)).ok) return } catch {} await pause(30) }
    throw Error('Test API did not start')
  }
  const stop = async () => { const done = once(child, 'exit'); child.kill(); await done }
  const post = body => fetch(`${origin}/api/put-spreads`, { method: 'POST', headers, body: JSON.stringify({ universeMode: 'custom', ...body }) })
  try {
    await start()
    assert.equal((await fetch(`${origin}/api/put-spreads`, { method: 'POST', body: '{}' })).status, 403)
    for (const body of [{ symbols: [] }, { symbols: ['../bad'] }, { symbols: ['AMD'], filters: { maxLoss: -1 } }, { symbols: ['AMD'], filters: { minDte: 100, maxDte: 80 } }]) assert.equal((await post(body)).status, 400)
    const response = await post({ symbols: [' amd ', 'HOOD', 'AMD'], filters: { maxLoss: 900 } })
    assert.equal(response.status, 202)
    const running = await response.json(); assert.deepEqual(running.symbols, ['AMD', 'HOOD']); assert.equal(running.filters.maxLoss, 900)
    assert.equal((await fetch(`${origin}/api/iv-scan`, { method: 'POST', headers })).status, 409)
    assert.equal((await fetch(`${origin}/api/put-spreads/stop`, { method: 'POST', headers })).status, 202)
    let state
    for (let i = 0; i < 100; i++) { state = await (await fetch(`${origin}/api/put-spreads`)).json(); if (state.state !== 'running') break; await pause(30) }
    assert.equal(state.state, 'cancelled')
    // Allow the atomic checkpoint to finish before stopping the API.
    await pause(100); await stop(); await start()
    const restored = await (await fetch(`${origin}/api/put-spreads`)).json()
    assert.equal(restored.state, 'cancelled'); assert.equal(restored.filters.maxLoss, 900); assert.equal(restored.restoredFromDisk, true)
  } finally { if (child?.exitCode === null) await stop(); await rm(directory, { recursive: true, force: true }) }
})
