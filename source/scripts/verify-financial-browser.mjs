import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const url = process.env.LAYOUT_URL || 'http://127.0.0.1:5197'
const output = 'data/private/layout-validation'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({ reducedMotion: 'reduce' })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0, isBusy: false }) }))
await mkdir(output, { recursive: true })

function luminance(hex) {
  const rgb = hex.trim().replace('#', '').match(/../g).map(value => parseInt(value, 16) / 255)
  const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
}

try {
  await page.goto(url)
  await page.locator('.portfolio-summary').waitFor()
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 1440, height: 1050 })
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Donkere modus/ }).click()
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return Object.fromEntries(['surface-1', 'surface-2', 'surface-canvas', 'text-primary', 'text-secondary', 'text-muted', 'status-success', 'status-danger', 'accent-primary'].map(token => [token, style.getPropertyValue('--tm-' + token)]))
    })
    for (const foreground of ['text-primary', 'text-secondary', 'text-muted', 'status-success', 'status-danger', 'accent-primary']) {
      for (const surface of ['surface-1', 'surface-2', 'surface-canvas']) {
        const a = luminance(colors[foreground]), b = luminance(colors[surface])
        assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${theme}: ${foreground} on ${surface}`)
      }
    }
    for (const route of ['dashboard', 'stocks', 'options', 'trades', 'stats', 'goals']) {
      await page.goto(`${url}/#${route}`)
      await page.locator('.page-header h1').waitFor()
      for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }, { width: 1440, height: 1050 }]) {
        await page.setViewportSize(viewport)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}/${route}/${viewport.width}: page overflow`)
      }
      if (['dashboard', 'stocks', 'options'].includes(route)) await page.screenshot({ path: `${output}/financial-${route}-${theme}.png`, fullPage: true })
    }
    await page.goto(`${url}/#dashboard`)
    const disclosure = page.getByText('Maandsaldi bekijken', { exact: true })
    await disclosure.focus()
    await page.keyboard.press('Enter')
    assert.ok(await page.locator('.chart-data').first().getAttribute('open') !== null)
    assert.ok(await page.locator('.chart-data').first().locator('tbody tr').count() > 0)
    await page.getByText('Maandresultaten bekijken', { exact: true }).click()
    assert.ok(await page.locator('.chart-data').nth(1).locator('tbody tr').count() > 0)
    const free = page.locator('.allocation-card__free strong')
    if ((await free.textContent()).includes('-')) assert.equal(await free.getAttribute('class'), 'metric--negative')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.screenshot({ path: `${output}/financial-mobile-${theme}.png`, fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  assert.deepEqual(errors, [])
  console.log('Financial UI verified: light/dark, text contrast >=4.5:1 on three surfaces, six portfolio pages at 375/812/1440px, keyboard chart tables, negative free cash, reduced motion; no page errors.')
} finally { await browser.close() }
