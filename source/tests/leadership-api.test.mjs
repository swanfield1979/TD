import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'

test('real HTTP API validates origin/config, starts asynchronous scan and reports unavailable Gateway', async () => {
  const probe = createServer()
  await new Promise((r) => probe.listen(0, '127.0.0.1', r))
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  const dir = await mkdtemp(join(tmpdir(), 'breakout-api-'))
  const child = spawn(process.execPath, ['server/ibkr-api.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      IBKR_API_PORT: String(port),
      IBKR_PORT: '1',
      IBKR_SNAPSHOT_PATH: join(dir, 'snapshot.json'),
      IBKR_BREAKOUT_PATH: join(dir, 'scan.json'),
      IBKR_ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    },
    stdio: 'pipe',
  })
  let logs = ''
  child.stderr.on('data', (chunk) => (logs += chunk))
  const url = `http://127.0.0.1:${port}/api/breakout`
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(url)).ok) break
      } catch {}
      await new Promise((r) => setTimeout(r, 100))
    }
    const initial = await (await fetch(url)).json()
    assert.equal(initial.state, 'idle')
    const denied = await fetch(url, { method: 'POST', body: '{}' })
    assert.equal(denied.status, 403)
    const headers = {
      Origin: 'http://127.0.0.1:5173',
      'X-Requested-With': 'trading-monitor',
      'Content-Type': 'application/json',
    }
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ config: { periods: [0, 1, 2] } }),
        })
      ).status,
      400,
    )
    const started = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ universe: 'custom', symbols: 'NVDA' }),
    })
    assert.equal(started.status, 202)
    let state
    for (let i = 0; i < 120; i++) {
      state = await (await fetch(url)).json()
      if (state.state !== 'running') break
      await new Promise((r) => setTimeout(r, 100))
    }
    assert.equal(state.state, 'error')
    assert.equal(state.rows.length, 0)
    assert.match(state.message, /Gateway|IBKR/)
    assert.equal(logs, '')
  } finally {
    child.kill()
    await new Promise((r) => child.once('exit', r))
    await rm(dir, { recursive: true, force: true })
  }
})
