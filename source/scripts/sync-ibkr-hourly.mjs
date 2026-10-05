import { nyseSyncWindow } from '../shared/nyse-session.mjs'

const window = nyseSyncWindow()
if (!window.shouldSync) {
  console.log(`IBKR-synchronisatie overgeslagen: ${window.marketDate} ${String(window.hour).padStart(2, '0')}:00 ET (${window.reason}).`)
  process.exit(0)
}

const host = process.env.IBKR_API_HOST || '127.0.0.1'
const port = Number(process.env.IBKR_API_PORT || 8787)
const origin = process.env.IBKR_REFRESH_ORIGIN
  || (process.env.IBKR_ALLOWED_ORIGINS || 'http://192.168.1.22').split(',')[0].trim()
const url = `http://${host}:${port}/api/ibkr/refresh`

let response
let lastError
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Origin: origin, 'X-Requested-With': 'trading-monitor' },
      signal: AbortSignal.timeout(10_000),
    })
    break
  } catch (error) {
    lastError = error
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
}

if (!response) throw new Error(`Trading Monitor API is niet bereikbaar: ${lastError instanceof Error ? lastError.message : 'onbekende fout'}`)
const body = await response.json().catch(() => ({}))
if (!response.ok) throw new Error(body.message || `Synchronisatie geweigerd (HTTP ${response.status}).`)
console.log(`IBKR-synchronisatie gestart: ${body.state || 'refreshing'}${body.message ? ` — ${body.message}` : ''}`)
