import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer } from 'node:net'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
test('saved IBKR snapshot and sync date survive offline gateway and API restarts', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tm-saved-ibkr-'))
  const socket = createServer().listen(0, '127.0.0.1'); await once(socket, 'listening')
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
  const origin = `http://127.0.0.1:${port}`, path = join(directory, 'snapshot.json')
  const saved = { account: 'PRIVATE-TEST', generatedAt: '2026-10-29T18:00:00Z', asOfDate: '2026-10-29', currency: 'USD', netLiquidation: 12345, positions: [], executions: [{ account: 'PRIVATE-TEST', execId: 'test' }] }
  await writeFile(path, JSON.stringify(saved))
  let child
  async function stop() {
    if (!child || child.exitCode !== null) return
    const done = once(child, 'exit'); child.kill(); await done; child = null
  }
  async function start() {
    child = spawn(process.execPath, ['server/ibkr-api.mjs'], { stdio: 'ignore', env: { ...process.env, IBKR_API_HOST: '127.0.0.1', IBKR_API_PORT: String(port), IBKR_HOST: '127.0.0.1', IBKR_PORT: '1', IBKR_SNAPSHOT_PATH: path, SCAN_RESULTS_PATH: join(directory, 'scans.json'), LEAPS_SHORTLIST_PATH: join(directory, 'shortlist.json'), PUT_SPREAD_SCHEDULE_DISABLED: '1', SECTOR_LOOKUPS_DISABLED: '1' } })
    for (let i = 0; i < 150; i++) {
      try {
        const response = await fetch(`${origin}/api/ibkr/status`)
        const state = await response.json()
        if (response.ok && !state.isBusy) return state
      } catch {}
      await pause(30)
    }
    throw Error('Test API did not start')
  }
  try {
    for (let restart = 0; restart < 2; restart++) {
      const status = await start()
      assert.equal(status.state, 'offline')
      assert.equal(status.lastUpdatedAt, saved.generatedAt)
      const response = await fetch(`${origin}/api/ibkr/snapshot`)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const snapshot = await response.json()
      assert.equal(snapshot.netLiquidation, saved.netLiquidation)
      assert.equal(snapshot.generatedAt, saved.generatedAt)
      assert.equal(snapshot.account, 'selected')
      assert.equal(snapshot.executions[0].account, 'selected')
      assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), saved, 'Offline gateway cannot overwrite the saved synchronization')
      await stop()
    }
    await rm(path)
    const status = await start()
    assert.equal(status.lastUpdatedAt, null)
    assert.equal((await fetch(`${origin}/api/ibkr/snapshot`)).status, 404)
    await writeFile(path, 'broken')
    assert.equal((await fetch(`${origin}/api/ibkr/snapshot`)).status, 500)
    assert.equal(await readFile(path, 'utf8'), 'broken')
  } finally { await stop(); await rm(directory, { recursive: true, force: true }) }
})
