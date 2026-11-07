import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { dailyCacheKey } from '../server/martin-market-scan.mjs'
import { createScanStore } from '../server/scan-store.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer } from 'node:net'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
test('spread API validates inputs, enforces origin and scan lock, supports stop and restores its filters', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tm-spreads-'))
  const socket = createServer().listen(0, '127.0.0.1'); await once(socket, 'listening')
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  const headers = { Origin: origin, 'X-Requested-With': 'trading-monitor', 'Content-Type': 'application/json' }
  let child
  const start = async () => {
    child = spawn(process.execPath, ['server/ibkr-api.mjs'], { stdio: 'ignore', env: { ...process.env, SECTOR_LOOKUPS_DISABLED: '1', IBKR_API_PORT: String(port), IBKR_API_HOST: '127.0.0.1', IBKR_ALLOWED_ORIGINS: origin, IBKR_PORT: '1', IBKR_SNAPSHOT_PATH: join(directory, 'snapshot.json'), SCAN_RESULTS_PATH: join(directory, 'scans.json'), LEAPS_SHORTLIST_PATH: join(directory, 'shortlist.json') } })
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/api/put-spreads`)).ok && !(await (await fetch(`${origin}/api/ibkr/status`)).json()).isBusy) return } catch {} await pause(30) }
    throw Error('Test API did not start')
  }
  const stop = async () => { const done = once(child, 'exit'); child.kill(); await done }
  const post = body => fetch(`${origin}/api/put-spreads`, { method: 'POST', headers, body: JSON.stringify({ universeMode: 'custom', ...body }) })
  try {
    const selection = { id: 'test-selection', state: 'complete', key: dailyCacheKey(Date.now()), finishedAt: new Date().toISOString(), rows: [{ symbol: 'AMD' }, { symbol: 'HOOD' }], entries: [{ symbol: 'AMD' }, { symbol: 'HOOD' }], failures: [], observations: {}, warnings: [], checked: 2, total: 2, filters: { minPrice: 5, maxPrice: 150, minVolume: 5e6 } }
    await mkdir(join(directory, 'stock-filter'))
    await writeFile(join(directory, 'stock-filter', 'selection.json'), JSON.stringify(selection))
    const sectorAsOf = new Date().toISOString()
    await writeFile(join(directory, 'stock-sectors.json'), JSON.stringify({ version: 1, bulkAt: Date.now(), records: { AMD: { sector: 'Technology', sectorSource: 'Nasdaq', sectorAsOf }, HOOD: { sector: 'Financials', sectorSource: 'Nasdaq', sectorAsOf } } }))
    await createScanStore(join(directory, 'scans.json'), '127.0.0.1:1').save({ iv: { id: 'iv-selection', stockSelectionId: selection.id, state: 'complete', filters: { minIvr: 40 }, entries: selection.entries, universeChecked: 2, rows: selection.rows.map(row => ({ ...row, ivr: 60 })), warnings: [], finishedAt: new Date().toISOString() } })
    await start()
    const update = await (await fetch(`${origin}/api/app-update`)).json()
    assert.match(update.installedVersion, /^\d+\.\d+\.\d+$/)
    assert.equal(typeof update.configured, 'boolean')
    assert.equal((await fetch(`${origin}/api/app-update`, { method: 'POST', body: JSON.stringify({ action: 'install' }) })).status, 403)
    assert.equal((await fetch(`${origin}/api/app-update`, { method: 'POST', headers, body: JSON.stringify({ action: 'shell', command: 'echo forbidden' }) })).status, 409)
    assert.equal((await fetch(`${origin}/api/put-spreads`, { method: 'POST', body: '{}' })).status, 403)
    for (const body of [{ symbols: [] }, { symbols: ['../bad'] }, { symbols: ['AMD'], filters: { maxLoss: -1 } }, { symbols: ['AMD'], filters: { minDte: 100, maxDte: 80 } }]) assert.equal((await post(body)).status, 400)
    assert.equal((await post({ symbols: ['AMD'] })).status, 400, 'No option requests before completed selection')
    assert.equal((await post({ symbols: ['AMD'], selectionId: 'obsolete' })).status, 400)
    assert.equal((await post({ symbols: ['AMD'], selectionId: selection.id })).status, 400, 'IV selection required before options')
    const response = await post({ symbols: [' amd ', 'HOOD', 'AMD'], filters: { maxLoss: 900 }, selectionId: selection.id, ivSelectionId: 'iv-selection' })
    assert.equal(response.status, 202)
    const running = await response.json(); assert.deepEqual(running.symbols, ['AMD', 'HOOD']); assert.equal(running.filters.maxLoss, 900)
    assert.deepEqual(running.entries.map(row => row.symbol), ['AMD', 'HOOD'])
    assert.equal(running.stockSelectionId, selection.id)
    assert.equal(running.entries[0].sector, 'Technology')
    assert.equal((await (await fetch(`${origin}/api/stock-filter`)).json()).rows[0].sector, 'Technology')
    assert.equal((await (await fetch(`${origin}/api/put-spreads/iv`)).json()).rows[1].sector, 'Financials')
    assert.equal((await fetch(`${origin}/api/stock-filter`, { method: 'POST', headers, body: '{}' })).status, 409)
    assert.equal((await fetch(`${origin}/api/iv-scan`, { method: 'POST', headers })).status, 409)
    assert.equal((await fetch(`${origin}/api/put-spreads/stop`, { method: 'POST', headers })).status, 202)
    let state
    for (let i = 0; i < 100; i++) { state = await (await fetch(`${origin}/api/put-spreads`)).json(); if (state.state !== 'running') break; await pause(30) }
    assert.equal(state.state, 'cancelled')
    // Allow the atomic checkpoint to finish before stopping the API.
    await pause(100); await stop(); await start()
    const restored = await (await fetch(`${origin}/api/put-spreads`)).json()
    assert.equal(restored.state, 'cancelled'); assert.equal(restored.filters.maxLoss, 900); assert.equal(restored.restoredFromDisk, true)
    assert.equal((await (await fetch(`${origin}/api/stock-filter`)).json()).id, selection.id)
    assert.equal((await fetch(`${origin}/api/put-spreads/blocked`, { method: 'POST', body: '{}' })).status, 403)
    const block = (symbol, blocked) => fetch(`${origin}/api/put-spreads/blocked`, { method: 'POST', headers, body: JSON.stringify({ symbol, blocked }) })
    assert.equal((await block('../bad', true)).status, 400)
    assert.equal((await block('hood', true)).status, 200)
    assert.deepEqual((await (await fetch(`${origin}/api/stock-filter`)).json()).rows.map(row => row.symbol), ['AMD'])
    assert.deepEqual((await (await fetch(`${origin}/api/put-spreads/iv`)).json()).rows.map(row => row.symbol), ['AMD'])
    await stop(); await start()
    assert.equal((await (await fetch(`${origin}/api/put-spreads/blocked`)).json()).entries[0].symbol, 'HOOD')
    assert.equal((await block('HOOD', false)).status, 200)
    assert.equal((await (await fetch(`${origin}/api/stock-filter`)).json()).rows.length, 2)
    const settings = { enabled: true, stockDay: 0, stockTime: '09:00', ivAtMarketOpen: true }
    assert.equal((await fetch(`${origin}/api/put-spreads/schedule`, { method: 'POST', headers, body: JSON.stringify(settings) })).status, 200)
    assert.equal((await (await fetch(`${origin}/api/put-spreads/schedule`)).json()).settings.stockTime, '09:00')
    const iv = await fetch(`${origin}/api/put-spreads/iv`, { method: 'POST', headers, body: JSON.stringify({ selectionId: selection.id, filters: { minIvr: 40 } }) })
    assert.equal(iv.status, 202); assert.equal((await iv.json()).stockSelectionId, selection.id)
    assert.equal((await block('HOOD', true)).status, 409)
    await fetch(`${origin}/api/put-spreads/iv/stop`, { method: 'POST', headers })
    for (let i = 0; i < 50; i++) { if ((await (await fetch(`${origin}/api/put-spreads/iv`)).json()).state !== 'running') break; await pause(20) }
    assert.equal((await (await fetch(`${origin}/api/put-spreads/iv`)).json()).state, 'cancelled')
    await stop()
    const store = createScanStore(join(directory, 'scans.json'), '127.0.0.1:1'), savedScans = await store.load()
    savedScans.scans.iv.failures = [{ symbol: 'AIOK', message: 'IBKR 162: HMDS query returned no data: AIOK@SMART Option_Implied_Volatility', observedAt: new Date(Date.now() - 10000).toISOString() }, { symbol: 'OFFLINE', message: 'Gateway niet bereikbaar.' }]
    await store.save(savedScans.scans, savedScans.round)
    await start()
    const automatic = (await (await fetch(`${origin}/api/put-spreads/blocked`)).json()).entries
    assert.equal(automatic.find(row => row.symbol === 'AIOK').automatic, true)
    assert.equal(automatic.find(row => row.symbol === 'AIOK').stage, 'iv')
    assert.equal(automatic.some(row => row.symbol === 'OFFLINE'), false)
    await block('AIOK', false)
    await stop(); await start()
    assert.equal((await (await fetch(`${origin}/api/put-spreads/blocked`)).json()).entries.some(row => row.symbol === 'AIOK'), false, 'Old failure must not undo explicit unblock on restart')
    // The single-ticker route bypasses Stock Filter/IV selection but has its own durable state.
    const singleUrl = `${origin}/api/single-put-spread`
    const singlePost = body => fetch(singleUrl, { method: 'POST', headers, body: JSON.stringify(body) })
    const original = await (await fetch(`${origin}/api/put-spreads`)).json()
    assert.equal((await (await fetch(singleUrl)).json()).state, 'idle')
    assert.equal((await fetch(singleUrl, { method: 'POST', body: '{}' })).status, 403)
    assert.equal((await fetch(`${singleUrl}/stop`, { method: 'POST' })).status, 403)
    for (const body of [{}, { symbol: '' }, { symbol: ['AMD'] }, { symbols: ['AMD', 'HOOD'] }, { symbol: 'AMD,HOOD' }, { symbol: 'AMD HOOD' }, { symbol: '../bad' }, { symbol: 'AMD', filters: { maxLoss: -1 } }, { symbol: 'AMD', chainSource: 'unknown' }, { symbol: 'AMD', resume: true }]) {
      assert.equal((await singlePost(body)).status, 400, JSON.stringify(body))
    }
    await block('HOOD', true)
    const blockedSingle = await singlePost({ symbol: 'HOOD' })
    assert.equal(blockedSingle.status, 400)
    assert.match((await blockedSingle.json()).message, /Geblokkeerde Stocks/)
    const single = await singlePost({ symbol: ' brk.b ', chainSource: 'ibkr', filters: { minDte: 30, maxDte: 60, maxLoss: 800 } })
    assert.equal(single.status, 202)
    const startedSingle = await single.json()
    assert.deepEqual(startedSingle.symbols, ['BRK B'])
    assert.deepEqual(startedSingle.entries, [{ symbol: 'BRK B' }])
    assert.equal(startedSingle.universeMode, 'custom')
    assert.equal(startedSingle.universeCount, 1)
    assert.equal(startedSingle.stockSelectionId, undefined)
    assert.equal(startedSingle.ivSelectionId, undefined)
    assert.equal((await post({ symbols: ['AMD'], selectionId: selection.id, ivSelectionId: 'iv-selection' })).status, 409)
    assert.equal((await fetch(`${origin}/api/stock-filter`, { method: 'POST', headers, body: '{}' })).status, 409)
    assert.equal((await fetch(`${singleUrl}/stop`, { method: 'POST', headers })).status, 202)
    let singleState
    for (let i = 0; i < 100; i++) { singleState = await (await fetch(singleUrl)).json(); if (singleState.state !== 'running') break; await pause(30) }
    assert.equal(singleState.state, 'cancelled')
    const unchanged = await (await fetch(`${origin}/api/put-spreads`)).json()
    for (const key of ['state', 'symbols', 'filters', 'rows', 'startedAt']) assert.deepEqual(unchanged[key], original[key], key)
    await pause(100); await stop(); await start()
    const restoredSingle = await (await fetch(singleUrl)).json()
    assert.equal(restoredSingle.restoredFromDisk, true)
    assert.deepEqual(restoredSingle.symbols, ['BRK B'])
    assert.equal(restoredSingle.filters.maxLoss, 800)
    assert.equal(restoredSingle.state, 'cancelled')

  } finally { if (child?.exitCode === null) await stop(); await rm(directory, { recursive: true, force: true }) }
})
