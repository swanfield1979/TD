import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncLog } from '../server/sync-log.mjs'
import { createIbkrSynchronizer } from '../server/ibkr-sync.mjs'
import { EventEmitter, getEventListeners } from 'node:events'
import { collectSnapshot } from '../server/gateway-client.mjs'

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

test('stop cancels pending data collection, logs once, preserves saved data and permits a new session', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  let entered, blocked = true
  const started = new Promise(resolve => { entered = resolve })
  const current = runner(log, { collectSnapshot: async ({ signal }) => {
    if (!blocked) return { generatedAt: '2026-11-07T12:00:00Z' }
    entered()
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  } })
  assert.deepEqual(await current.sync.stop(), { stopped: false, reason: 'idle' })
  const task = current.sync('scheduled'); await started
  assert.equal(current.sync.canStop(), true)
  const [first, second] = await Promise.all([current.sync.stop(), current.sync.stop()])
  await task
  assert.deepEqual(first, { stopped: true }); assert.deepEqual(second, { stopped: true })
  assert.equal(current.runtime.state, 'stopped'); assert.equal(current.runtime.isBusy, false)
  assert.equal(current.sync.canStop(), false)
  assert.equal(current.saved.length, 0)
  assert.deepEqual(current.calls, [], 'Cancellation cannot fall through into a Gateway login')
  assert.deepEqual((await log.snapshot()).entries.map(e => e.event), ['cancelled', 'stop_requested', 'started'])
  blocked = false; await current.sync('manual')
  assert.equal(current.runtime.state, 'connected'); assert.equal(current.saved.length, 1)
}))

test('stop interrupts IB Key wait immediately and cannot falsely cancel an atomic snapshot commit', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  const current = runner(log, { config: { mfaTimeoutMs: 180000 }, collectSnapshot: async () => { throw Error('offline') } })
  const task = current.sync('manual')
  while (current.runtime.state !== 'awaiting_mfa') await new Promise(resolve => setTimeout(resolve, 1))
  const before = Date.now(); await current.sync.stop(); await task
  assert.ok(Date.now() - before < 1000, 'Does not wait for the five-second retry timer')
  assert.equal(current.runtime.state, 'stopped')
  assert.equal((await log.snapshot()).entries[0].event, 'cancelled')
  let release, saving
  const entered = new Promise(resolve => { saving = resolve })
  const committing = runner(log, { saveSnapshot: async () => { saving(); await new Promise(resolve => { release = resolve }) } })
  const commit = committing.sync('manual'); await entered
  assert.equal(committing.sync.canStop(), false)
  assert.deepEqual(await committing.sync.stop(), { stopped: false, reason: 'finishing' })
  release(); await commit
  assert.equal(committing.runtime.state, 'connected')
  assert.equal((await log.snapshot()).entries[0].event, 'completed')
}))

test('stopping before the first broker request and restarting an unfinished stop are recorded safely', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  const current = runner(log)
  const task = current.sync('manual')
  await current.sync.stop(); await task
  assert.equal(current.saved.length, 0); assert.deepEqual(current.calls, [])
  const pending = log.begin('scheduled'); await pending.saved
  await log.record(pending.sessionId, 'scheduled', 'stop_requested')
  const restored = await createSyncLog({ path })
  assert.equal((await restored.snapshot()).entries[0].event, 'interrupted')
}))

test('snapshot cancellation disconnects the IB socket and removes its abort listener', async () => {
  let instance, constructed = 0
  class PassiveApi extends EventEmitter {
    constructor() { super(); instance = this; constructed++ }
    connect() { this.emit('connected') }
    reqManagedAccts() { this.requests = (this.requests || 0) + 1 }
    disconnect() { this.disconnected = true }
  }
  const controller = new AbortController()
  const pending = collectSnapshot({ signal: controller.signal }, 12000, PassiveApi)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 1)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(instance.disconnected, true)
  instance.emit('connected')
  assert.doesNotThrow(() => instance.emit('managedAccounts', 'PRIVATE-TEST'))
  assert.equal(instance.requests, 1, 'Late callbacks cannot start new broker requests after stop')
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  await assert.rejects(collectSnapshot({ signal: controller.signal }, 12000, PassiveApi), { name: 'AbortError' })
  assert.equal(constructed, 1, 'An already cancelled session never opens a broker socket')
})

test('stop also aborts a pending Gateway start command without continuing into IB Key wait', async () => fixture(async path => {
  const log = await createSyncLog({ path })
  let entered
  const ready = new Promise(resolve => { entered = resolve })
  const current = runner(log, { collectSnapshot: async () => { throw Error('offline') },
    startGatewayService: signal => new Promise((resolve, reject) => {
      entered(); signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
  })
  const task = current.sync('scheduled'); await ready
  await current.sync.stop(); await task
  assert.equal(current.runtime.state, 'stopped')
  assert.deepEqual((await log.snapshot()).entries.map(e => e.event), ['cancelled', 'stop_requested', 'gateway_start', 'started'])
}))
