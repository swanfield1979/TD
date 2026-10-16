import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMartinScan } from '../server/martin-scan.mjs'

async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'martin-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
const report = () => ({ generatedAt: new Date().toISOString(), analyzed: 1, requested: 1, rows: [{ symbol: 'TEST' }], lists: { focus: [], potent: [], leaders: [], premarket: [], themes: [] }, failures: [] })
test('Martin-job voorkomt dubbele starts, meldt voortgang en herstelt resultaten', async t => {
  const dir = await directory(t)
  let finish, calls = 0
  const service = await createMartinScan(dir, async (args, hooks) => {
    calls++; assert.ok(args.includes('TEST')); hooks.onProgress({ checked: 1, total: 1 })
    await new Promise(resolve => { finish = resolve })
    return report()
  })
  const starts = await Promise.all([service.start('TEST'), service.start('OTHER')])
  assert.equal(starts[0].state, 'running'); assert.equal(calls, 1)
  assert.equal(service.snapshot().checked, 1)
  const copy = service.snapshot(); copy.symbols.push('MUTATION')
  assert.deepEqual(service.snapshot().symbols, ['TEST'])
  const interrupted = await createMartinScan(dir)
  assert.equal(interrupted.snapshot().state, 'interrupted')
  finish(); await service.wait()
  assert.equal(service.snapshot().state, 'complete')
  const restored = await createMartinScan(dir)
  assert.equal(restored.snapshot().report.rows[0].symbol, 'TEST')
  assert.equal(restored.snapshot().restored, true)
})
test('Totale data-uitval bewaart vorige resultaten en rapporteert fouten', async t => {
  const dir = await directory(t)
  await writeFile(join(dir, 'scan.json'), JSON.stringify(report()))
  const service = await createMartinScan(dir, async () => ({ analyzed: 0, failures: [{ symbol: 'TEST', error: 'HTTP 429' }] }))
  await service.start('TEST'); await service.wait()
  assert.equal(service.snapshot().state, 'error')
  assert.equal(service.snapshot().showingPrevious, true)
  assert.equal(service.snapshot().report.rows[0].symbol, 'TEST')
  assert.equal(service.snapshot().failures[0].error, 'HTTP 429')
})
test('Ongeldige universe en corrupte opslag starten geen downloads', async t => {
  const dir = await directory(t)
  let called = false
  const service = await createMartinScan(dir, async () => { called = true })
  await assert.rejects(service.start(''), /tickers/)
  await assert.rejects(service.start('<script>'), /tickers/)
  await assert.rejects(service.start(Array.from({ length: 201 }, (_, i) => `T${i}`).join(',')), /200/)
  assert.equal(called, false)
  await writeFile(join(dir, 'ui-state.json'), 'broken')
  const broken = await createMartinScan(dir)
  assert.ok(broken.snapshot().storageError)
  await assert.rejects(broken.start('TEST'), /niet worden gelezen/)
  assert.equal(await readFile(join(dir, 'ui-state.json'), 'utf8'), 'broken')
})
test('Runnerfout wordt foutstatus en schrijft geen schijnsucces', async t => {
  const service = await createMartinScan(await directory(t), async () => { throw Error('failed') })
  await service.start('TEST'); await service.wait()
  assert.equal(service.snapshot().state, 'error')
  assert.equal(service.snapshot().report, null)
})
