import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { IBApi, EventName, MarketDataType } from '@stoqey/ib'
import { createLiveSnapshot, updatePosition } from './ibkr-domain.mjs'

const PREVIOUS_CLOSE_TICK_TYPES = new Set([9, 75])
const MARKET_DATA_REQUEST_ID_START = 900_000

const config = {
  listenHost: process.env.IBKR_API_HOST || '127.0.0.1',
  listenPort: Number(process.env.IBKR_API_PORT || 8787),
  gatewayHost: process.env.IBKR_HOST || '127.0.0.1',
  gatewayPort: Number(process.env.IBKR_PORT || 4001),
  clientId: Number(process.env.IBKR_CLIENT_ID || 77),
  serviceUnit: process.env.IBKR_SYSTEMD_UNIT || 'ibc-gateway.service',
  snapshotPath: resolve(process.env.IBKR_SNAPSHOT_PATH || '/var/lib/trading-monitor/live-snapshot.json'),
  allowedOrigins: new Set((process.env.IBKR_ALLOWED_ORIGINS || 'http://192.168.1.22').split(',').map((value) => value.trim())),
  mfaTimeoutMs: Number(process.env.IBKR_MFA_TIMEOUT_MS || 180_000),
}

if (!/^[a-zA-Z0-9_.@-]+$/.test(config.serviceUnit)) throw new Error('Ongeldige systemd-unitnaam.')

const runtime = {
  state: 'offline',
  message: 'IBKR Gateway is niet verbonden.',
  lastUpdatedAt: null,
  isBusy: false,
}

function publicStatus() {
  return {
    state: runtime.state,
    message: runtime.message,
    lastUpdatedAt: runtime.lastUpdatedAt,
    isBusy: runtime.isBusy,
  }
}

function setStatus(state, message, extra = {}) {
  Object.assign(runtime, { state, message, ...extra })
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

function collectSnapshot(timeoutMs = 12_000) {
  return new Promise((resolveSnapshot, rejectSnapshot) => {
    const accountValues = new Map()
    const positions = new Map()
    const quoteRequests = new Map()
    let activeAccount
    let quoteTimeout
    let settled = false
    const ib = new IBApi({ host: config.gatewayHost, port: config.gatewayPort })

    const finish = (error, snapshot) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(quoteTimeout)
      try {
        for (const requestId of quoteRequests.keys()) ib.cancelMktData(requestId)
        if (activeAccount) ib.reqAccountUpdates(false, activeAccount)
        ib.disconnect()
      } catch {
        // De socket kan al gesloten zijn; opruimen blijft best-effort.
      }
      if (error) rejectSnapshot(error)
      else resolveSnapshot(snapshot)
    }

    const createSnapshot = () => {
      try {
        finish(null, createLiveSnapshot({ accountValues, positions: [...positions.values()] }))
      } catch (error) {
        finish(error)
      }
    }

    const requestPreviousCloses = () => {
      const stockPositions = [...positions.values()].filter((position) => position.position !== 0 && position.assetCategory === 'STK' && position.contract)
      if (stockPositions.length === 0) return createSnapshot()

      try {
        // IBKR levert live data als die beschikbaar is en valt anders terug op vertraagde koersen.
        ib.reqMarketDataType(MarketDataType.DELAYED)
        stockPositions.forEach((position, index) => {
          const requestId = MARKET_DATA_REQUEST_ID_START + index
          const marketDataContract = {
            ...position.contract,
            exchange: position.contract.exchange || 'SMART',
          }
          quoteRequests.set(requestId, position)
          ib.reqMktData(requestId, marketDataContract, '', false, false)
        })
        quoteTimeout = setTimeout(createSnapshot, 4_000)
      } catch {
        createSnapshot()
      }
    }

    const timeout = setTimeout(() => finish(new Error('Geen tijdige reactie van IB Gateway.')), timeoutMs)

    ib.on(EventName.connected, () => ib.reqManagedAccts())
    ib.on(EventName.managedAccounts, (accountsList) => {
      const accounts = accountsList.split(',').map((value) => value.trim()).filter(Boolean)
      if (accounts.length === 0) return finish(new Error('IBKR heeft geen toegankelijke rekening teruggegeven.'))
      activeAccount = accounts[0]
      ib.reqAccountUpdates(true, activeAccount)
    })
    ib.on(EventName.updateAccountValue, (key, value, currency, accountName) => {
      if (accountName !== activeAccount) return
      accountValues.set(key, { value, currency })
    })
    ib.on(EventName.updatePortfolio, (contract, position, marketPrice, marketValue, averageCost, unrealizedPnl, realizedPnl, accountName) => {
      if (accountName !== activeAccount) return
      updatePosition(positions, {
        accountName,
        conid: contract.conId,
        symbol: contract.symbol,
        localSymbol: contract.localSymbol,
        assetCategory: contract.secType,
        optionRight: contract.right ? String(contract.right) : null,
        optionStrike: contract.strike ?? null,
        optionExpiry: contract.lastTradeDateOrContractMonth || contract.lastTradeDate || null,
        multiplier: contract.multiplier ?? null,
        currency: contract.currency,
        position,
        marketPrice,
        marketValue,
        averageCost,
        unrealizedPnl,
        realizedPnl,
        contract,
      })
    })
    ib.on(EventName.accountDownloadEnd, (accountName) => {
      if (accountName !== activeAccount) return
      requestPreviousCloses()
    })
    ib.on(EventName.tickPrice, (requestId, tickType, price) => {
      const position = quoteRequests.get(requestId)
      if (!position || !PREVIOUS_CLOSE_TICK_TYPES.has(tickType) || !Number.isFinite(price) || price <= 0) return
      position.previousClose = price
      quoteRequests.delete(requestId)
      try {
        ib.cancelMktData(requestId)
      } catch {
        // De quote kan al door Gateway zijn afgesloten.
      }
      if (quoteRequests.size === 0) createSnapshot()
    })
    ib.on(EventName.error, (...args) => {
      const error = args.find((value) => value instanceof Error)
      const hasConnectionCode = args.some((value) => value === 502 || value === 504)
      const message = args.filter((value) => typeof value === 'string').join(' ')
      if (hasConnectionCode || /connect|ECONNREFUSED|socket/i.test(`${error?.message || ''} ${message}`)) {
        finish(error || new Error(message || 'Kan geen verbinding maken met IB Gateway.'))
      }
    })
    ib.on(EventName.disconnected, () => {
      if (!settled && !activeAccount) finish(new Error('IB Gateway heeft de verbinding gesloten.'))
    })

    try {
      ib.connect(config.clientId)
    } catch (error) {
      finish(error)
    }
  })
}

function startGatewayService() {
  const result = spawnSync('/usr/bin/sudo', [
    '-n',
    '/usr/bin/systemctl',
    'start',
    config.serviceUnit,
  ], { encoding: 'utf8', timeout: 10_000 })

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Gateway kon niet worden gestart.').trim())
}

async function saveSnapshot(snapshot) {
  await mkdir(dirname(config.snapshotPath), { recursive: true })
  const temporaryPath = `${config.snapshotPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, config.snapshotPath)
}

async function refreshInBackground() {
  if (runtime.isBusy) return
  setStatus('refreshing', 'Actuele posities worden bij IBKR opgehaald.', { isBusy: true })

  try {
    try {
      const snapshot = await collectSnapshot()
      await saveSnapshot(snapshot)
      return setStatus('connected', 'Actuele IBKR-posities zijn bijgewerkt.', {
        lastUpdatedAt: snapshot.generatedAt,
        isBusy: false,
      })
    } catch {
      startGatewayService()
    }

    setStatus('awaiting_mfa', 'Bevestig de aanmelding in IBKR Mobile.', { isBusy: true })
    const deadline = Date.now() + config.mfaTimeoutMs

    while (Date.now() < deadline) {
      await delay(5_000)
      try {
        const snapshot = await collectSnapshot(10_000)
        await saveSnapshot(snapshot)
        return setStatus('connected', 'Actuele IBKR-posities zijn bijgewerkt.', {
          lastUpdatedAt: snapshot.generatedAt,
          isBusy: false,
        })
      } catch {
        // Tijdens MFA is een nog gesloten API-socket de verwachte toestand.
      }
    }

    throw new Error('De IBKR Mobile-bevestiging is verlopen. Klik op Opnieuw proberen.')
  } catch (error) {
    setStatus('error', error instanceof Error ? error.message : 'De IBKR-koppeling is mislukt.', { isBusy: false })
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function isAllowedPost(request) {
  const origin = request.headers.origin
  return request.headers['x-requested-with'] === 'trading-monitor'
    && typeof origin === 'string'
    && config.allowedOrigins.has(origin)
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/ibkr/status') {
      return sendJson(response, 200, publicStatus())
    }

    if (request.method === 'GET' && request.url === '/api/ibkr/snapshot') {
      try {
        const snapshot = JSON.parse(await readFile(config.snapshotPath, 'utf8'))
        return sendJson(response, 200, snapshot)
      } catch {
        return sendJson(response, 404, { message: 'Er is nog geen actuele IBKR-snapshot.' })
      }
    }

    if (request.method === 'POST' && request.url === '/api/ibkr/refresh') {
      if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
      if (!runtime.isBusy) void refreshInBackground()
      return sendJson(response, 202, publicStatus())
    }

    return sendJson(response, 404, { message: 'Niet gevonden.' })
  } catch (error) {
    return sendJson(response, 500, { message: error instanceof Error ? error.message : 'Interne serverfout.' })
  }
})

server.listen(config.listenPort, config.listenHost, () => {
  console.log(`Trading Monitor IBKR API luistert op http://${config.listenHost}:${config.listenPort}`)
})
