import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppUpdater, newerVersion, writeUpdate } from '../server/app-update.mjs'
import { runAppUpdate } from '../server/app-update-worker.mjs'

const revision = 'a'.repeat(40)
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'tm-update-'))
  const sourceRoot = join(root, 'source'), path = join(root, 'state/update.json'), marker = join(root, 'setup.json')
  await mkdir(sourceRoot)
  await writeFile(marker, JSON.stringify({ sourceRoot, statePath: path }))
  const options = { sourceRoot, path, marker, installedVersion: '0.40.0', platform: 'linux', disabled: false }
  try { await fn({ root, ...options }) } finally { await rm(root, { recursive: true, force: true }) }
}
test('stable versions compare numerically and reject invalid releases', () => {
  assert.equal(newerVersion('0.41.0', '0.40.0'), true)
  assert.equal(newerVersion('0.100.0', '0.99.9'), true)
  assert.equal(newerVersion('0.40.0', '0.40.0'), false)
  assert.equal(newerVersion('0.39.0', '0.40.0'), false)
  assert.throws(() => newerVersion('0.41.0-beta', '0.40.0'))
})
test('updater requires setup and no active trading work; install needs a checked newer revision', async () => fixture(async options => {
  let calls = 0
  const run = async () => { calls++; return { stdout: '' } }
  await assert.rejects(createAppUpdater({ ...options, platform: 'win32', run }).start('check'), /nog niet geïnstalleerd/)
  await assert.rejects(createAppUpdater({ ...options, busy: () => true, run }).start('check'), /scans/)
  await assert.rejects(createAppUpdater({ ...options, run }).start('install'), /Controleer eerst/)
  await assert.rejects(createAppUpdater({ ...options, run }).start('shell'), /Kies/)
  assert.equal(calls, 0)
}))
test('a fixed unit is launched once, concurrent clicks are rejected and status survives API restart', async () => fixture(async options => {
  let release
  const entered = new Promise(done => { release = done })
  let finish
  const held = new Promise(done => { finish = done })
  const run = async (file, args) => {
    assert.equal(file, '/usr/bin/sudo')
    assert.deepEqual(args, ['-n', '/usr/bin/systemctl', 'start', '--no-block', 'trading-monitor-update.service'])
    release(); await held; return { stdout: '' }
  }
  const controller = createAppUpdater({ ...options, run })
  const first = controller.start('check')
  await entered
  await assert.rejects(controller.start('check'), /al een updateactie/)
  finish(); await first
  const restored = createAppUpdater({ ...options, run })
  assert.equal((await restored.snapshot()).state, 'queued')
  await assert.rejects(restored.start('install'), /al een updateactie/)
  await writeUpdate(options.path, { state: 'complete', available: true, targetRevision: revision, latestVersion: '0.41.0' })
  await controller.start('install')
  assert.equal(JSON.parse(await readFile(options.path)).targetRevision, revision)
}))
test('start failures and dead workers produce a recoverable error without leaking command output', async () => fixture(async options => {
  const controller = createAppUpdater({ ...options, run: async () => { throw Error('secret token') } })
  const failed = await controller.start('check')
  assert.equal(failed.state, 'error'); assert.doesNotMatch(failed.message, /secret/)
  await writeUpdate(options.path, { state: 'building', updatedAt: new Date(Date.now() - 20000).toISOString() })
  const stopped = await createAppUpdater({ ...options, run: async () => ({ stdout: 'failed' }) }).snapshot()
  assert.equal(stopped.state, 'error'); assert.equal(stopped.busy, false)
}))

async function workerFixture(fn, { action = 'install', dirty = false, remote = 'https://github.com/swanfield1979/TD.git', latest = '0.41.0', fail } = {}) {
  await fixture(async options => {
    const calls = []
    await mkdir(join(options.sourceRoot, 'public/data'), { recursive: true })
    await writeFile(join(options.sourceRoot, 'public/data/portfolio-summary.json'), '{"private-baseline":true}')
    await mkdir(join(options.sourceRoot, 'node_modules'))
    await writeUpdate(options.path, { state: 'queued', action, currentVersion: '0.40.0', targetRevision: revision, latestVersion: '0.41.0' })
    const run = async (file, args, config) => {
      calls.push([file, ...args])
      if (file === 'git') {
        if (args[0] === 'remote') return { stdout: remote }
        if (args[0] === 'branch') return { stdout: 'main' }
        if (args[0] === 'status') return { stdout: dirty ? ' M source/package.json' : '' }
        if (args[0] === 'rev-parse') return { stdout: revision }
        if (args[0] === 'show') return { stdout: JSON.stringify({ version: latest }) }
        if (args[0] === 'worktree' && args[1] === 'add') await mkdir(join(args[3], 'source'), { recursive: true })
      }
      if (file === 'npm') {
        if (fail && args.includes(fail)) throw Object.assign(Error('https://user:secret@example.invalid npm failure'), { cmd: 'npm secret' })
        assert.equal(config.env.APP_UPDATER_DISABLED, '1')
        if (args[0] === 'ci') await mkdir(join(config.cwd, 'node_modules'))
        if (args.includes('build')) {
          assert.equal(JSON.parse(await readFile(join(config.cwd, 'public/data/portfolio-summary.json')) )['private-baseline'], true)
          await mkdir(join(config.cwd, 'dist'))
          await writeFile(join(config.cwd, 'dist/index.html'), 'candidate')
        }
      }
      return { stdout: '' }
    }
    const result = await runAppUpdate({ ...options, run, fetchHealth: async () => ({ ok: true, json: async () => ({ installedVersion: latest }) }), wait: async () => {} })
    await fn(result, calls, options)
  })
}
test('check only fetches and compares; it does not build, merge or publish', async () => workerFixture(async (result, calls) => {
  assert.equal(result.available, true); assert.equal(result.latestVersion, '0.41.0')
  assert.equal(calls.some(([file]) => file === 'npm' || file === '/usr/bin/sudo'), false)
  assert.equal(calls.some(([, action]) => action === 'merge'), false)
}, { action: 'check' }))
test('installation tests and builds in isolation, preserves private baseline and confirms restarted version', async () => workerFixture(async (result, calls) => {
  assert.equal(result.state, 'complete'); assert.equal(result.installed, true)
  const merge = calls.findIndex(([file, action]) => file === 'git' && action === 'merge')
  const build = calls.findIndex(([file, , action]) => file === 'npm' && action === 'build')
  assert.ok(build >= 0 && merge > build)
  assert.deepEqual(calls.find(([file]) => file === '/usr/bin/sudo'), ['/usr/bin/sudo', '-n', '/usr/local/libexec/trading-monitor-publish'])
}))
test('dirty checkouts, unexpected remotes and a changed release cannot be published', async () => {
  for (const options of [{ dirty: true }, { remote: 'https://github.com/other/project.git' }, { latest: '0.42.0' }]) {
    await workerFixture(async (result, calls) => {
      assert.equal(result.state, 'error')
      assert.equal(calls.some(([file]) => file === 'npm' || file === '/usr/bin/sudo'), false)
    }, options)
  }
})
test('failed candidate tests leave the active checkout untouched and hide raw logs', async () => workerFixture(async (result, calls) => {
  assert.equal(result.state, 'error'); assert.equal(result.failedPhase, 'testing')
  assert.doesNotMatch(result.message, /secret|user:/)
  assert.equal(calls.some(([, action]) => action === 'merge'), false)
  assert.equal(calls.some(([file]) => file === '/usr/bin/sudo'), false)
}, { fail: 'test' }))
