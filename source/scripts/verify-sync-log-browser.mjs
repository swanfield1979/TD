import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
let failure = false
let status = { state: 'offline', isBusy: false, canStop: false, lastUpdatedAt: null, message: 'IBKR Gateway is niet verbonden.' }
let stopFailure = false, releaseStop, stopPosts = 0, holdStop = false
let data = { entries: [], retained: 0, limit: 5000, storageError: null }
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/ibkr/logs') return route.fulfill({ status: failure ? 503 : 200, json: failure ? {} : data })
  if (path === '/api/ibkr/stop') {
    stopPosts++
    assert.equal(route.request().headers()['x-requested-with'], 'trading-monitor')
    if (stopFailure) return route.fulfill({ status: 503, json: { message: 'Test: stoppen tijdelijk niet beschikbaar.' } })
    if (holdStop) await new Promise(resolve => { releaseStop = resolve })
    status = { ...status, state: 'stopped', isBusy: false, canStop: false, message: 'Lopende synchronisatie gestopt. Gateway en automatische planning blijven actief.' }
    data.entries.unshift({ sessionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', source: 'scheduled', event: 'cancelled', at: '2026-11-07T09:00:04Z', message: 'Lopende synchronisatie door een stopverzoek onderbroken.' })
    data.retained++
    return route.fulfill({ json: { ...status, stopped: true } })
  }
  if (path === '/api/ibkr/snapshot') return route.fulfill({ status: 404, json: {} })
  return route.fulfill({ json: status })
})
await page.route('**/data/portfolio-summary.json', route => route.fulfill({ status: 404, json: {} }))
async function refresh() { await page.getByRole('button', { name: 'Logboek vernieuwen', exact: true }).click() }
try {
  await page.goto('http://127.0.0.1:5197/#logs')
  await page.getByText(/Nog geen synchronisaties vastgelegd/).waitFor()
  assert.equal(await page.getByText('Dashboarddata ontbreekt').count(), 0)
  const sessionId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
  data = { ...data, retained: 3, entries: [
    { sessionId, source: 'scheduled', event: 'awaiting_mfa', at: '2026-11-07T09:00:02Z', message: 'Gateway-start geaccepteerd; wachten op verbinding en eventuele IB Key-bevestiging.' },
    { sessionId, source: 'scheduled', event: 'gateway_start', at: '2026-11-07T09:00:01Z', message: 'Start van IB Gateway aangevraagd; dit kan een IB Key-verzoek veroorzaken.' },
    { sessionId, source: 'scheduled', event: 'started', at: '2026-11-07T09:00:00Z', message: 'Synchronisatiesessie gestart.' },
  ] }
  // The first new session must appear through automatic polling, without a reload.
  await page.getByRole('cell', { name: 'Wachten op verbinding / IB Key', exact: true }).waitFor()
  assert.match(await page.locator('tbody tr').first().innerText(), /10:00:02/)
  await page.getByLabel('Bron', { exact: true }).selectOption('manual')
  await page.getByText(/Geen regels voor deze filters/).waitFor()
  await page.getByRole('button', { name: 'Filters wissen', exact: true }).click()
  await page.getByLabel('Sessie zoeken', { exact: true }).fill('does-not-exist')
  await page.getByText(/Geen regels voor deze filters/).waitFor()
  await page.getByRole('button', { name: 'Filters wissen', exact: true }).click()
  failure = true; await refresh()
  await page.getByRole('alert').getByText(/Het logboek kon niet worden geladen/).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 3, 'Stale logs remain visible')
  failure = false; data.storageError = 'Test: logopslag mislukt.'
  await page.getByRole('button', { name: 'Opnieuw laden', exact: true }).click()
  await page.getByRole('alert').getByText('Test: logopslag mislukt.', { exact: true }).waitFor()
  data.storageError = null; await refresh()
  await page.getByRole('button', { name: 'Logboek vernieuwen', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Logboek vernieuwen', exact: true }).waitFor()
  await mkdir('data/private/sync-log-validation', { recursive: true })
  status = { ...status, state: 'awaiting_mfa', isBusy: true, canStop: true }
  await page.reload()
  const stop = page.getByRole('button', { name: 'Synchronisatie stoppen', exact: true })
  await stop.waitFor()
  await page.locator('.ibkr-control').screenshot({ path: 'data/private/sync-log-validation/stop-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 360, height: 1000 })
  await stop.waitFor()
  await page.locator('.ibkr-control').screenshot({ path: 'data/private/sync-log-validation/stop-mobile.png', animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await stop.waitFor()
  stopFailure = true; await stop.click()
  await page.getByRole('alert').getByText('Test: stoppen tijdelijk niet beschikbaar.', { exact: true }).waitFor()
  stopFailure = false; holdStop = true
  await stop.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Stoppen…', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Stoppen…', exact: true }).isDisabled(), true)
  while (!releaseStop) await new Promise(resolve => setTimeout(resolve, 10))
  releaseStop()
  await page.getByText('Synchronisatie gestopt', { exact: true }).waitFor()
  assert.equal(stopPosts, 2, 'Only one retry request, no duplicates while stopping')
  assert.equal(await stop.count(), 0)
  await page.getByRole('cell', { name: 'Gestopt', exact: true }).waitFor()
  await mkdir('data/private/sync-log-validation', { recursive: true })
  await page.screenshot({ path: 'data/private/sync-log-validation/desktop.png', fullPage: true, animations: 'disabled' })
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow at ' + width)
  }
  await page.getByRole('button', { name: 'Donkere modus: aan', exact: true }).click()
  await page.screenshot({ path: 'data/private/sync-log-validation/light.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Donkere modus: uit', exact: true }).click()
  await page.setViewportSize({ width: 360, height: 1000 })
  await page.screenshot({ path: 'data/private/sync-log-validation/mobile.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow at 200% zoom')
  assert.deepEqual(errors, [])
  console.log('Sync log verified: no portfolio required, empty/data/filter/error/stale/storage states, timezone, keyboard, 360–1440px and zoom; no page errors.')
} finally { await browser.close() }
