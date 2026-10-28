import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
const version = JSON.parse(await readFile('package.json')).version
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15000)
let status = { state: 'idle', configured: false, installedVersion: version, busy: false, blocked: false }
let posts = [], failure = false, unavailable = false
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname
  let body = { state: 'offline', isBusy: false }, code = 200
  if (path === '/api/app-update') {
    if (request.method() === 'POST') {
      assert.equal(request.headers()['x-requested-with'], 'trading-monitor')
      const input = request.postDataJSON(); posts.push(input)
      if (failure) { code = 409; body = { message: 'Test: scan nog bezig.' } }
      else { status = { ...status, state: 'queued', busy: true, message: 'Update wordt gestart…' }; body = status }
    } else { code = unavailable ? 503 : 200; body = status }
  }
  await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) })
})
const base = process.env.UPDATE_URL || 'http://127.0.0.1:5197'
try {
  await page.goto(base + '/#updates')
  await page.getByRole('heading', { name: 'Updates', exact: true }).waitFor()
  await page.getByText('De updateservice moet eenmalig op de server worden geïnstalleerd.', { exact: false }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Controleren op updates', exact: true }).isDisabled(), true)
  status = { ...status, configured: true }
  await page.reload()
  await page.getByRole('button', { name: 'Controleren op updates', exact: true }).click()
  assert.deepEqual(posts, [{ action: 'check' }])
  await page.getByRole('button', { name: 'Bezig…', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Bezig…', exact: true }).isDisabled(), true)
  status = { ...status, state: 'complete', busy: false, available: true, latestVersion: '0.99.0', message: 'Versie 0.99.0 is beschikbaar.' }
  await page.getByRole('button', { name: 'Versie 0.99.0 installeren', exact: true }).waitFor()
  failure = true
  await page.getByRole('button', { name: 'Versie 0.99.0 installeren', exact: true }).click()
  await page.getByRole('alert').getByText('Test: scan nog bezig.', { exact: true }).waitFor()
  failure = false
  await page.getByRole('button', { name: 'Versie 0.99.0 installeren', exact: true }).click()
  status = { ...status, state: 'building', busy: true, message: 'Nieuwe webapp bouwen…' }
  await page.getByText('Nieuwe webapp bouwen…', { exact: true }).waitFor()
  await page.reload()
  await page.getByText('Nieuwe webapp bouwen…', { exact: true }).waitFor()
  unavailable = true
  await page.getByText('Verbinding herstellen na serverherstart…', { exact: true }).waitFor()
  unavailable = false
  status = { ...status, installedVersion: '0.99.0', state: 'complete', busy: false, available: false, installed: true, message: 'Versie 0.99.0 is geïnstalleerd. Open de nieuwe webapp.' }
  await page.getByRole('button', { name: 'Nieuwe versie openen', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Nieuwe versie openen', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Nieuwe versie openen', exact: true }).waitFor()
  await mkdir('data/private/update-validation', { recursive: true })
  await page.screenshot({ path: 'data/private/update-validation/desktop.png', fullPage: true })
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at ' + width)
  }
  await page.screenshot({ path: 'data/private/update-validation/mobile.png', fullPage: true })
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at 200% zoom')
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  status = { ...status, state: 'error', message: 'Test: build mislukt.', installed: false }
  await page.getByRole('alert').getByText('Test: build mislukt.', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Updates verified: setup, check/install, disabled duplicate actions, API restart and reload recovery, errors, keyboard, 360–1440px and zoom; no page errors.')
} finally { await browser.close() }
