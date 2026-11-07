import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer } from 'node:net'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
test('real API records startup, app and scheduled requests, excludes rejected requests and restores logs on restart', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tm-sync-api-'))
  const socket = createServer().listen(0, '127.0.0.1'); await once(socket, 'listening')
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  let child
  async function stop() {
    if (!child || child.exitCode !== null) return
    const done = once(child, 'exit'); child.kill(); await done; child = null
  }
  async function logs() {
    const response = await fetch(`${origin}/api/ibkr/logs`)
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
    return response.json()
  }
  async function waitIdle() {
    for (let i = 0; i < 150; i++) {
      try { const r = await fetch(`${origin}/api/ibkr/status`); if (r.ok && !(await r.json()).isBusy) return } catch {}
      await pause(30)
    }
    throw Error('Test API did not become idle')
  }
  function start() {
    child = spawn(process.execPath, ['server/ibkr-api.mjs'], { stdio: 'ignore', env: { ...process.env,
      IBKR_API_HOST: '127.0.0.1', IBKR_API_PORT: String(port), IBKR_HOST: '127.0.0.1', IBKR_PORT: '1',
      // A deliberately nonexistent unit prevents starting a real Gateway even on Linux.
      IBKR_SYSTEMD_UNIT: 'trading-monitor-nonexistent-test.service',
      IBKR_ALLOWED_ORIGINS: origin, IBKR_SNAPSHOT_PATH: join(directory, 'snapshot.json'),
      IBKR_SYNC_LOG_PATH: join(directory, 'log.json'), SCAN_RESULTS_PATH: join(directory, 'scans.json'),
      LEAPS_SHORTLIST_PATH: join(directory, 'shortlist.json'), PUT_SPREAD_SCHEDULE_DISABLED: '1', SECTOR_LOOKUPS_DISABLED: '1',
    } })
  }
  try {
    start(); await waitIdle()
    assert.deepEqual((await logs()).entries.map(e => e.event), ['offline', 'started'])
    const denied = await fetch(`${origin}/api/ibkr/refresh`, { method: 'POST' })
    assert.equal(denied.status, 403)
    assert.equal((await logs()).entries.length, 2)
    for (const source of ['manual', 'scheduled']) {
      const response = await fetch(`${origin}/api/ibkr/refresh`, { method: 'POST', headers: {
        Origin: origin, 'X-Requested-With': 'trading-monitor', ...(source === 'scheduled' ? { 'X-Sync-Source': 'scheduled' } : {}),
      } })
      assert.equal(response.status, 202); await waitIdle()
      assert.deepEqual((await logs()).entries.filter(e => e.source === source).map(e => e.event), ['failed', 'gateway_start', 'started'])
    }
    const oldIds = new Set((await logs()).entries.map(e => e.sessionId))
    await stop(); start(); await waitIdle()
    const restored = await logs()
    assert.ok([...oldIds].every(id => restored.entries.some(e => e.sessionId === id)))
    assert.equal(restored.storageError, null)
    assert.doesNotMatch(await readFile(join(directory, 'log.json'), 'utf8'), /sudo|password|account|PRIVATE/)
  } finally { await stop(); await rm(directory, { recursive: true, force: true }) }
})

test('stop API interrupts a live pending broker socket, requires valid origin, preserves snapshot and supports retry', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tm-sync-stop-'))
  const clients = new Set()
  const gateway = createServer(socket => { clients.add(socket); socket.on('error', () => {}); socket.on('close', () => clients.delete(socket)) }).listen(0, '127.0.0.1')
  await once(gateway, 'listening')
  const reserve = createServer().listen(0, '127.0.0.1'); await once(reserve, 'listening')
  const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve))
  const origin = `http://127.0.0.1:${port}`, path = join(directory, 'snapshot.json')
  const saved = JSON.stringify({ account: 'PRIVATE-TEST', generatedAt: '2026-11-07T08:00:00Z' })
  await writeFile(path, saved)
  const headers = { Origin: origin, 'X-Requested-With': 'trading-monitor' }
  const child = spawn(process.execPath, ['server/ibkr-api.mjs'], { stdio: 'ignore', env: { ...process.env,
    IBKR_API_HOST: '127.0.0.1', IBKR_API_PORT: String(port), IBKR_HOST: '127.0.0.1', IBKR_PORT: String(gateway.address().port),
    IBKR_ALLOWED_ORIGINS: origin, IBKR_SNAPSHOT_PATH: path, IBKR_SYNC_LOG_PATH: join(directory, 'log.json'),
    SCAN_RESULTS_PATH: join(directory, 'scans.json'), LEAPS_SHORTLIST_PATH: join(directory, 'shortlist.json'),
    IBKR_SYSTEMD_UNIT: 'trading-monitor-nonexistent-test.service', PUT_SPREAD_SCHEDULE_DISABLED: '1', SECTOR_LOOKUPS_DISABLED: '1',
  } })
  try {
    for (let i = 0; i < 150; i++) {
      try { const r = await fetch(`${origin}/api/ibkr/status`); if (r.ok && (await r.json()).canStop) break } catch {}
      await pause(30)
    }
    assert.equal((await fetch(`${origin}/api/ibkr/stop`, { method: 'POST' })).status, 403)
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) assert.equal((await fetch(`${origin}/api/ibkr/refresh`, { method: 'POST', headers })).status, 202)
      const response = await fetch(`${origin}/api/ibkr/stop`, { method: 'POST', headers })
      assert.equal(response.status, 200)
      const status = await response.json()
      assert.equal(status.stopped, true); assert.equal(status.state, 'stopped')
      assert.equal(status.isBusy, false); assert.equal(status.canStop, false)
      assert.equal(await readFile(path, 'utf8'), saved)
    }
    const events = (await (await fetch(`${origin}/api/ibkr/logs`)).json()).entries
    assert.equal(events.filter(e => e.event === 'cancelled').length, 2)
    assert.equal(events.filter(e => e.event === 'stop_requested').length, 2)
    assert.equal(events.filter(e => e.event === 'gateway_start').length, 0)
    const idle = await (await fetch(`${origin}/api/ibkr/stop`, { method: 'POST', headers })).json()
    assert.equal(idle.stopped, false)
  } finally {
    const done = once(child, 'exit'); child.kill(); await done
    for (const socket of clients) socket.destroy()
    await new Promise(resolve => gateway.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
