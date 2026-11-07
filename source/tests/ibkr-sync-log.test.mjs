import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncLog } from '../server/sync-log.mjs'
import { createIbkrSynchronizer } from '../server/ibkr-sync.mjs'

async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'tm-sync-log-'))
  try { await fn(join(dir, 'log.json'), dir) } finally { await rm(dir, { recursive: true, force: true }) }
}
function runner(log, overrides = {}) {
  const runtime = { isBusy: false }, calls = [], saved = []
  const sync = createIbkrSynchronizer({ log, runtime, config: { mfaTimeoutMs: 10 },
    collectSnapshot: async () => ({ generatedAt: '2026-11-07T12:00:00Z' }),
    saveSnapshot: async snapshot => saved.push(snapshot), startGatewayService: () => calls.push('gateway'),
    setStatus: (state, message, extra) => Object.assign(runtime, { state, message, ...extra }), updateBusy: () => false, ...overrides,
  })
  return { sync, runtime, calls, saved }
}
test('all four sync sources persist linked start/result events across restarts without account data', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  const { sync } = runner(log)
  for (const source of ['manual', 'scheduled', 'startup', 'background']) await sync(source)
  const restored = await createSyncLog({ path })
  const { entries } = await restored.snapshot()
  assert.equal(entries.length, 8)
  for (const source of ['manual', 'scheduled', 'startup', 'background']) {
    const events = entries.filter(e => e.source === source)
    assert.deepEqual(events.map(e => e.event), ['completed', 'started'])
    assert.equal(events[0].sessionId, events[1].sessionId)
    assert.ok(Number.isFinite(Date.parse(events[0].at)))
  }
  assert.doesNotMatch(await readFile(path, 'utf8'), /generatedAt|account|netLiquidation/)
}))
test('automatic startup/background attempts never start Gateway; manual and scheduled login transitions are logged', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  const offline = runner(log, { collectSnapshot: async () => { throw Error('account SECRET password') } })
  await offline.sync('startup'); await offline.sync('background')
  assert.deepEqual(offline.calls, [])
  for (const source of ['manual', 'scheduled']) {
    let attempts = 0
    const { sync, calls } = runner(log, { collectSnapshot: async () => {
      if (attempts++ === 0) throw Error('private broker error')
      return { generatedAt: '2026-11-07T12:00:00Z' }
    }, delay: async () => {} })
    await sync(source)
    assert.deepEqual(calls, ['gateway'])
    assert.deepEqual((await log.snapshot()).entries.filter(e => e.source === source).map(e => e.event), ['completed', 'awaiting_mfa', 'gateway_start', 'started'])
  }
  assert.doesNotMatch(await readFile(path, 'utf8'), /SECRET|password|private broker error/)
}))
test('timeout, service failure, save failure and overlapping requests have distinct safe outcomes', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  let clock = 0
  const timeout = runner(log, { collectSnapshot: async () => { throw Error('offline') }, now: () => clock, delay: async () => { clock += 20 } })
  await timeout.sync('scheduled')
  assert.equal((await log.snapshot()).entries[0].event, 'timed_out')
  assert.equal(timeout.runtime.isBusy, false)
  const failed = runner(log, { collectSnapshot: async () => { throw Error('private') }, startGatewayService: () => { throw Error('password=SECRET') } })
  await failed.sync('manual')
  assert.equal((await log.snapshot()).entries[0].event, 'failed')
  const badSave = runner(log, { saveSnapshot: async () => { throw Error('disk unavailable') } })
  await badSave.sync('manual')
  assert.deepEqual(badSave.calls, [], 'Storage errors must not trigger a new Gateway login')
  let release
  const running = runner(log, { collectSnapshot: () => new Promise(resolve => { release = resolve }) })
  const first = running.sync('manual')
  while (!release) await new Promise(resolve => setTimeout(resolve, 1))
  await running.sync('scheduled')
  await running.sync('background')
  assert.equal(running.runtime.isBusy, true, 'Skipped request cannot release another session lock')
  release({ generatedAt: '2026-11-07T12:00:00Z' }); await first
  const entries = (await log.snapshot()).entries
  assert.ok(entries.some(e => e.source === 'scheduled' && e.event === 'skipped'))
  assert.doesNotMatch(await readFile(path, 'utf8'), /SECRET|disk unavailable/)
}))
test('retention is bounded, unfinished sessions are marked interrupted, corrupt logs stay intact and failures are visible', async () => fixture(async (path, dir) => {
  let log = await createSyncLog({ path, limit: 4 })
  const pending = log.begin('scheduled'); await pending.saved
  log = await createSyncLog({ path, limit: 4 })
  assert.equal((await log.snapshot()).entries[0].event, 'interrupted')
  for (let i = 0; i < 5; i++) await runner(log).sync('manual')
  assert.equal((await log.snapshot()).entries.length, 4)
  assert.equal(JSON.parse(await readFile(path, 'utf8')).length, 4)
  await writeFile(path, 'corrupt')
  log = await createSyncLog({ path }); await runner(log).sync('background')
  assert.ok((await log.snapshot()).storageError)
  assert.equal(await readFile(path, 'utf8'), 'corrupt')
  const file = join(dir, 'not-a-directory'); await writeFile(file, 'x')
  log = await createSyncLog({ path: join(file, 'log.json') }); await runner(log).sync('manual')
  assert.ok((await log.snapshot()).storageError)
}))
