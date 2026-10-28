import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { collectSnapshot } from './gateway-client.mjs'
import { withPreviousBalance } from './ibkr-domain.mjs'
import { mergeExecutions } from '../shared/gateway-trades.mjs'
import { runCspScan } from './csp-scanner.mjs'
import { spreadFilters } from '../shared/put-spread.mjs'
import { normalizeShortlist } from '../shared/leaps-scan.mjs'
import { createScanStore } from './scan-store.mjs'
import { scanGuard } from './scan-guard.mjs'
import { createSpreadCache } from './spread-cache.mjs'
import { runSpreadScan } from './spread-scan.mjs'
import { createMartinScan } from './martin-scan.mjs'
import { createStockFilter } from './stock-filter.mjs'
import { createBlockedStocks } from './blocked-stocks.mjs'
import { makeFilteredIvState, runFilteredIvScan, ivSelection, ivFilters } from './filtered-iv-scan.mjs'
import { createWeeklySpreadSchedule } from './weekly-spread-schedule.mjs'
import { createStockSectors } from './stock-sectors.mjs'
import { autoBlockStock, reconcileMissingStocks } from './auto-block-stocks.mjs'
import { fileURLToPath } from 'node:url'
import { createAppUpdater } from './app-update.mjs'

const scanControllers = {}
const activeScanJobs = new Set()
let scanState = { state: 'idle', portfolio: [], market: [], warnings: [], progress: '', symbolsChecked: 0, contractsChecked: 0 }

async function startScan() {
  try {
    let portfolio
    try { portfolio = JSON.parse(await readFile(config.snapshotPath, 'utf8')) }
    catch { portfolio = JSON.parse(await readFile(new URL('../public/data/portfolio-summary.json', import.meta.url), 'utf8')) }
    try {
      const imported = JSON.parse(await readFile(new URL('../public/data/portfolio-summary.json', import.meta.url), 'utf8'))
      if (imported.balance?.toDate > (portfolio.asOfDate ?? portfolio.balance?.toDate ?? '')) portfolio = imported
    } catch { /* A live snapshot also works without a Flex import. */ }
    scanState.portfolioAsOfDate = portfolio.asOfDate ?? portfolio.balance?.toDate
    const positions = portfolio.positions ?? [...(portfolio.stockHoldings ?? []), ...(portfolio.optionHoldings ?? [])]
    const symbols = [...new Set(positions.filter((position) => (position.quantity ?? position.position) !== 0)
      .map((position) => position.symbol).filter((symbol) => typeof symbol === 'string' && /^[A-Z0-9. -]{1,20}$/.test(symbol)))]
    scanState.portfolioSymbols = symbols
    await runCspScan({ ...config, scanSignal: scanControllers.csp.signal, onScanCheckpoint: saveScanResults }, symbols, scanState)
  } catch (error) { scanState.state = 'error'; scanState.message = error.message }
  finally { await saveScanResults() }
}

const config = {
  listenHost: process.env.IBKR_API_HOST || '127.0.0.1',
  listenPort: Number(process.env.IBKR_API_PORT || 8787),
  gatewayHost: process.env.IBKR_HOST || '127.0.0.1',
  gatewayPort: Number(process.env.IBKR_PORT || 4001),
  clientId: Number(process.env.IBKR_CLIENT_ID || 77),
  stockVolumeMultiplier: Number(process.env.IBKR_STOCK_VOLUME_MULTIPLIER || 1),
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
  let previous
  try {
    previous = JSON.parse(await readFile(config.snapshotPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  snapshot = withPreviousBalance(snapshot, previous)
  snapshot.executions = mergeExecutions(previous?.executions, snapshot.executions)
    .filter((execution) => execution.account === snapshot.account)
  await mkdir(dirname(config.snapshotPath), { recursive: true })
  const temporaryPath = `${config.snapshotPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, config.snapshotPath)
}

// Capture executions while Gateway is running, also when no browser is open.
// Background checks never start Gateway or initiate an MFA login.
async function refreshConnectedGateway() {
  if (runtime.isBusy || appUpdater.isBusy()) return
  runtime.isBusy = true
  try {
    const snapshot = await collectSnapshot(config)
    await saveSnapshot(snapshot)
    setStatus('connected', 'Alle actuele IBKR-gegevens zijn bijgewerkt.', {
      lastUpdatedAt: snapshot.generatedAt, isBusy: false,
    })
  } catch (error) {
    setStatus('offline', error instanceof Error ? error.message : 'IBKR Gateway is niet verbonden.', { isBusy: false })
  }
}

async function refreshInBackground() {
  if (runtime.isBusy) return
  setStatus('refreshing', 'Alle actuele gegevens worden bij IBKR opgehaald.', { isBusy: true })

  try {
    try {
      const snapshot = await collectSnapshot(config)
      await saveSnapshot(snapshot)
      return setStatus('connected', 'Alle actuele IBKR-gegevens zijn bijgewerkt.', {
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
        const snapshot = await collectSnapshot(config, 10_000)
        await saveSnapshot(snapshot)
        return setStatus('connected', 'Alle actuele IBKR-gegevens zijn bijgewerkt.', {
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

const shortlistPath = resolve(process.env.LEAPS_SHORTLIST_PATH || dirname(config.snapshotPath) + '/leaps-shortlist.json')
let shortlist = []
let shortlistError = null
try { shortlist = normalizeShortlist(JSON.parse(await readFile(shortlistPath, 'utf8'))) }
catch (error) { if (error.code !== 'ENOENT') shortlistError = 'Shortlist kon niet worden gelezen; controleer het opgeslagen bestand voordat je opnieuw opslaat.' }
const optionScans = {
  spreads: { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 },
  iv: { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 },
  leaps: { state: 'idle', rows: [], warnings: [], assessments: [], symbolsChecked: 0, contractsChecked: 0 },
}
const scanResultsPath = resolve(process.env.SCAN_RESULTS_PATH || dirname(config.snapshotPath) + '/scan-results.json')
const spreadCache = createSpreadCache(resolve(dirname(config.snapshotPath), 'put-spread-cache'), `${config.gatewayHost}:${config.gatewayPort}`)
const scanStore = createScanStore(scanResultsPath, `${config.gatewayHost}:${config.gatewayPort}`)
let scanStorageError = null
try {
  const stored = await scanStore.load()
  if (stored) {
    for (const mode of ['iv', 'leaps', 'spreads']) if (stored.scans[mode]) optionScans[mode] = stored.scans[mode]
    if (stored.scans.csp) scanState = stored.scans.csp
    if (stored.round) scanGuard(config).ivRound = stored.round
  }
} catch { scanStorageError = 'Opgeslagen scans konden niet worden gelezen. Controleer scan-results.json; dit bestand wordt niet overschreven.' }
async function saveScanResults() {
  if (scanStorageError) return
  try {
    await scanStore.save({ ...optionScans, csp: scanState }, scanGuard(config).ivRound)
    for (const state of [scanState, ...Object.values(optionScans)]) delete state.storageError
  } catch {
    for (const state of [scanState, ...Object.values(optionScans)]) state.storageError = 'Scan kon niet worden opgeslagen; controleer de schrijfbevoegdheid van de privédatamap.'
  }
}
async function runOptionScan(mode, symbols, state, previous) {
  activeScanJobs.add(mode)
  try {
    const signal = scanControllers[mode].signal
    const researchConfig = { ...config, scanSignal: signal, onStockDetails: (symbol, details) => stockSectors.rememberIbkr(symbol, details) }
    const runBatch = () => runCspScan({ ...config, scanSignal: signal, ivContinueRound: mode === 'iv' && state.batchesCompleted > 0, onScanCheckpoint: saveScanResults }, symbols, state, undefined, mode)
    if (mode === 'spreads') await runSpreadScan(researchConfig, state, { cache: spreadCache, checkpoint: saveScanResults, blocked: symbol => blockedStocks.has(symbol), autoBlock: failure => autoBlockStock(blockedStocks, failure) })
    else if (mode === 'iv') await runFilteredIvScan(researchConfig, state, { cache: spreadCache, checkpoint: saveScanResults, blocked: symbol => blockedStocks.has(symbol), autoBlock: failure => autoBlockStock(blockedStocks, failure) })
    else await runBatch()
    if (mode === 'leaps' && state.rows.length === 0 && ['error', 'cancelled'].includes(state.state) && previous.rows.length) {
      state.rows = previous.rows
      state.showingPreviousResults = true
      state.previousFinishedAt = previous.previousFinishedAt || previous.finishedAt || previous.savedAt
    }
    if (mode === 'iv' && ['complete', 'partial'].includes(state.state)) {
      const directory = resolve(dirname(config.snapshotPath), 'iv-scan-history')
      await mkdir(directory, { recursive: true })
      const path = resolve(directory, state.id + '.json')
      await writeFile(path + '.tmp', JSON.stringify(state), { mode: 0o600 }); await rename(path + '.tmp', path)
    }
  } catch (error) { state.state = 'error'; state.message = error.message }
  finally { await saveScanResults(); activeScanJobs.delete(mode) }
}
let shortlistSaving = false
async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > 8192) throw new Error('Aanvraag te groot.')
  }
  return JSON.parse(body)
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

const martinScan = await createMartinScan(resolve(process.env.MARTIN_SCAN_DIR || dirname(config.snapshotPath) + '/martin'))
const blockedStocks = await createBlockedStocks(resolve(dirname(config.snapshotPath), 'blocked-stocks.json'))
const stockSectors = await createStockSectors(resolve(dirname(config.snapshotPath), 'stock-sectors.json'), { enabled: process.env.SECTOR_LOOKUPS_DISABLED !== '1' })
const stockFilter = await createStockFilter(resolve(dirname(config.snapshotPath), 'stock-filter'), config, { blocked: symbol => blockedStocks.has(symbol), sectors: stockSectors, autoBlock: failure => autoBlockStock(blockedStocks, failure) })
// Also migrate the per-stock missing-data reports from the preceding version.
// Explicitly unblocked stocks have durable timestamps preventing reblocking by an old report.
try {
  await reconcileMissingStocks(blockedStocks, { stock: stockFilter.snapshot(), iv: optionScans.iv, options: optionScans.spreads })
  await saveScanResults()
} catch (error) { optionScans.iv.autoBlockError = `Automatisch blokkeren kon niet worden opgeslagen: ${error.message}` }
const workBusy = () => runtime.isBusy || martinScan.snapshot().state === 'running' || blockedStocks.isSaving() || activeScanJobs.size > 0 || scanState.state === 'running' || Object.values(optionScans).some(scan => scan.state === 'running') || stockFilter.snapshot().state === 'running'
let weeklySchedule
const appUpdater = createAppUpdater({ path: resolve(dirname(config.snapshotPath), 'app-update.json'),
  sourceRoot: fileURLToPath(new URL('..', import.meta.url)),
  installedVersion: JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version,
  busy: () => workBusy() || weeklySchedule?.isRunning(),
})
await appUpdater.snapshot()
setInterval(() => { void appUpdater.snapshot().catch(() => {}) }, 2000).unref()
const scansBusy = () => appUpdater.isBusy() || workBusy()
function startFilteredIv(selection, filters, resume = false) {
  const previous = optionScans.iv
  if (resume) {
    if (!previous.id || previous.stockSelectionId !== selection.id || !previous.entries || previous.universeChecked >= previous.entries.length && !Number.isInteger(previous.retryFrom) || JSON.stringify(ivFilters(filters)) !== JSON.stringify(previous.filters)) throw Error('Hervat met dezelfde Stock Filter en IV-criteria van een onvoltooide scan.')
    optionScans.iv = { ...previous, state: 'running', message: undefined }
  } else optionScans.iv = makeFilteredIvState(selection, filters)
  const state = optionScans.iv
  scanControllers.iv = new AbortController()
  const done = runOptionScan('iv', [], state, previous)
  return { state, done }
}
weeklySchedule = await createWeeklySpreadSchedule(resolve(dirname(config.snapshotPath), 'put-spread-schedule.json'), {
  busy: scansBusy,
  async runStock() {
    blockedStocks.assertReadable()
    const previous = stockFilter.snapshot()
    stockFilter.start({ universeMode: previous.universeMode || 'us', symbols: previous.symbols || [], filters: previous.filters })
    while (stockFilter.snapshot().state === 'running') await delay(500)
    const result = stockFilter.snapshot()
    if (result.storageError) throw Error(result.storageError)
    return result
  },
  async runIv(selectionId) {
    if (scanStorageError) throw Error(scanStorageError)
    const selection = stockFilter.selection(selectionId)
    const job = startFilteredIv(selection, optionScans.iv.filters)
    await job.done
    if (job.state.storageError) throw Error(job.state.storageError)
    return job.state
  },
})
const weeklyTimer = setInterval(() => { if (process.env.PUT_SPREAD_SCHEDULE_DISABLED !== '1') void weeklySchedule.tick().catch(() => {}) }, 30000)
weeklyTimer.unref()
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/api/app-update') {
      if (request.method === 'GET') return sendJson(response, 200, await appUpdater.snapshot())
      if (request.method === 'POST') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        try { return sendJson(response, 202, await appUpdater.start((await readJsonBody(request)).action)) }
        catch (error) { return sendJson(response, 409, { message: error.message }) }
      }
      return sendJson(response, 405, { message: 'Methode niet toegestaan.' })
    }
    if (request.method === 'POST' && appUpdater.isBusy()) return sendJson(response, 409, { message: 'Applicatie-update bezig. Wacht tot deze klaar is.' })
    if (request.url === '/api/put-spreads/schedule') {
      if (request.method === 'GET') return sendJson(response, 200, weeklySchedule.snapshot())
      if (request.method === 'POST') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        try { return sendJson(response, 200, await weeklySchedule.configure(await readJsonBody(request))) }
        catch (error) { return sendJson(response, 400, { message: error.message }) }
      }
    }
    if (request.url === '/api/put-spreads/blocked') {
      if (request.method === 'GET') return sendJson(response, 200, blockedStocks.snapshot())
      if (request.method === 'POST') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        try {
          const input = await readJsonBody(request)
          if (scansBusy() || weeklySchedule.isRunning()) return sendJson(response, 409, { message: 'Stop de lopende scan voordat je aandelen blokkeert of deblokkeert.' })
          if (typeof input.blocked !== 'boolean') throw Error('Kies blokkeren of deblokkeren.')
          return sendJson(response, 200, await blockedStocks.update(input.symbol, input.blocked))
        } catch (error) { return sendJson(response, 400, { message: error.message }) }
      }
    }
    if (request.url === '/api/stock-filter' || request.url === '/api/stock-filter/stop') {
      if (request.method === 'GET' && request.url === '/api/stock-filter') {
        const result = stockFilter.snapshot()
        void stockSectors.warm(result.rows)
        if (stockSectors.warning()) result.warnings = [...new Set([...result.warnings, stockSectors.warning()])]
        return sendJson(response, 200, result)
      }
      if (request.method === 'POST') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        if (request.url.endsWith('/stop')) return sendJson(response, 202, stockFilter.stop())
        if (weeklySchedule.isRunning()) return sendJson(response, 409, { message: 'De geplande weekscan is bezig.' })
        if (blockedStocks.isSaving() || activeScanJobs.size) return sendJson(response, 409, { message: 'Scanresultaten of blokkeerlijst worden opgeslagen.' })
        if (scanState.state === 'running' || Object.values(optionScans).some(scan => scan.state === 'running')) return sendJson(response, 409, { message: 'Stop eerst de lopende optiescan.' })
        try {
          const input = await readJsonBody(request)
          blockedStocks.assertReadable()
          if (blockedStocks.isSaving() || activeScanJobs.size || weeklySchedule.isRunning()) return sendJson(response, 409, { message: 'Een scan of opslagbewerking is bezig.' })
          if (scanState.state === 'running' || Object.values(optionScans).some(scan => scan.state === 'running')) return sendJson(response, 409, { message: 'Stop eerst de lopende optiescan.' })
          return sendJson(response, 202, stockFilter.start(input))
        }
        catch (error) { return sendJson(response, 400, { message: error.message }) }
      }
    }
    if (request.url.split('?')[0] === '/api/martin-scan') {
      if (request.method === 'GET') return sendJson(response, 200, martinScan.snapshot(new URL(request.url, 'http://localhost').searchParams.get('reportVersion')))
      if (request.method === 'POST') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        try {
          const body = await readJsonBody(request)
          return sendJson(response, 202, await martinScan.start(body.symbols, { universeMode: body.universeMode, resume: body.resume === true }))
        } catch (error) { return sendJson(response, 400, { message: error.message }) }
      }
    }
    if (request.url === '/api/martin-scan/stop' && request.method === 'POST') {
      if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
      return sendJson(response, 202, martinScan.stop())
    }
    const stopMode = { '/api/put-spreads/stop': 'spreads', '/api/put-spreads/iv/stop': 'iv', '/api/iv-scan/stop': 'iv', '/api/leaps/stop': 'leaps', '/api/scans/stop': 'csp' }[request.url]
    if (stopMode && request.method === 'POST') {
      if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
      const state = stopMode === 'csp' ? scanState : optionScans[stopMode]
      if (state.state === 'running') { state.progress = 'Scan stoppen…'; scanControllers[stopMode]?.abort() }
      return sendJson(response, 202, state)
    }
    if (request.url === '/api/leaps/shortlist') {
      if (request.method === 'GET') return sendJson(response, shortlistError ? 500 : 200, { symbols: shortlist, message: shortlistError })
      if (request.method === 'PUT') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        if (shortlistError) return sendJson(response, 409, { message: shortlistError })
        if (shortlistSaving) return sendJson(response, 409, { message: 'Opslaan is bezig; probeer opnieuw.' })
        shortlistSaving = true
        try {
          const body = await readJsonBody(request)
          const values = normalizeShortlist(body.symbols)
          await mkdir(dirname(shortlistPath), { recursive: true })
          await writeFile(shortlistPath + '.tmp', JSON.stringify(values))
          await rename(shortlistPath + '.tmp', shortlistPath)
          shortlist = values
          return sendJson(response, 200, { symbols: shortlist })
        } catch (error) { return sendJson(response, 400, { message: error.message }) }
        finally { shortlistSaving = false }
      }
    }
    const mode = request.url === '/api/put-spreads' ? 'spreads' : ['/api/iv-scan', '/api/put-spreads/iv'].includes(request.url) ? 'iv' : request.url === '/api/leaps' ? 'leaps' : null
    if (mode) {
      if (request.method === 'GET') {
        const rows = mode === 'leaps' ? optionScans[mode].rows : optionScans[mode].rows.filter(row => !blockedStocks.has(row.symbol)).map(stockSectors.decorate)
        if (mode !== 'leaps') void stockSectors.warm(rows)
        return sendJson(response, 200, { ...optionScans[mode], state: activeScanJobs.has(mode) ? 'running' : optionScans[mode].state, rows, storageError: scanStorageError || optionScans[mode].storageError })
      }
      if (request.method === 'POST') {
        if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
        if (weeklySchedule.isRunning()) return sendJson(response, 409, { message: 'De geplande weekscan is bezig.' })
        if (blockedStocks.isSaving() || activeScanJobs.size && optionScans[mode].state !== 'running') return sendJson(response, 409, { message: 'Scanresultaten of blokkeerlijst worden opgeslagen.' })
        if (scanStorageError) return sendJson(response, 409, { message: scanStorageError })
        if (stockFilter.snapshot().state === 'running') return sendJson(response, 409, { message: 'Rond eerst de aandelenfilter af of stop deze.' })
        if (optionScans[mode].state === 'running') return sendJson(response, 202, optionScans[mode])
        if (scanState.state === 'running' || Object.values(optionScans).some(scan => scan.state === 'running'))
          return sendJson(response, 409, { message: 'Er loopt al een optiescan. Wacht tot deze klaar is.' })
        if (mode === 'leaps' && (shortlistError || !shortlist.length)) return sendJson(response, 400, { message: shortlistError || 'Voeg eerst aandelen toe aan de shortlist.' })
        if (mode === 'iv') {
          try {
            blockedStocks.assertReadable()
            const body = await readJsonBody(request)
            const selection = stockFilter.selection(body.selectionId)
            if (scansBusy() || weeklySchedule.isRunning()) return sendJson(response, 409, { message: 'Er loopt al een scan.' })
            return sendJson(response, 202, startFilteredIv(selection, body.filters, body.resume === true).state)
          } catch (error) { return sendJson(response, 400, { message: error.message }) }
        }
        let symbols = mode === 'leaps' ? [...shortlist] : []
        let filters, universeMode, selection, resume = false
        if (mode === 'spreads') {
          try {
            const body = await readJsonBody(request)
            universeMode = body.universeMode ?? (Array.isArray(body.symbols) && body.symbols.length ? 'custom' : 'us')
            if (!['us', 'custom'].includes(universeMode)) throw Error('Ongeldig aandelenuniversum.')
            symbols = universeMode === 'custom' ? normalizeShortlist(body.symbols) : []
            if (universeMode === 'custom' && !symbols.length) throw Error('Vul minstens één ticker in voor een eigen lijst.')
            filters = spreadFilters(body.filters)
            resume = body.resume === true
            if (!resume) {
              if (stockFilter.snapshot().state === 'running') throw Error('Wacht tot de aandelenfilter klaar is.')
              selection = stockFilter.selection(body.selectionId)
              const iv = ivSelection(optionScans.iv, selection, body.ivSelectionId, symbol => blockedStocks.has(symbol))
              selection = { ...selection, entries: iv.entries, ivSelectionId: iv.id, ivSelectionAt: iv.finishedAt }
              filters = spreadFilters({ ...filters, minIvr: iv.filters.minIvr })
              if (filters.minPrice !== selection.filters.minPrice || filters.maxPrice !== selection.filters.maxPrice) throw Error('Koersgrenzen gewijzigd; voer eerst de aandelenfilter opnieuw uit.')
            }
            if (resume) {
              const previous = optionScans.spreads
              if (filters.minAvgOptionVolume > 0 && previous.filters?.minAvgOptionVolume === undefined) throw Error('Start een nieuwe scan om het nieuwe volumefilter ook op eerdere aandelen toe te passen.')
              if (!previous.entries || previous.universeChecked >= previous.entries.length && !Number.isInteger(previous.retryFrom) || JSON.stringify(spreadFilters(previous.filters)) !== JSON.stringify(filters) || previous.universeMode !== universeMode || (universeMode === 'custom' && JSON.stringify(previous.symbols) !== JSON.stringify(symbols)))
                throw Error('Hervatten kan alleen met dezelfde criteria en hetzelfde universum van een onvoltooide scan.')
            }
          } catch (error) { return sendJson(response, 400, { message: error.message }) }
        }
        if (mode === 'spreads' && (scanState.state === 'running' || Object.values(optionScans).some(scan => scan.state === 'running')))
          return sendJson(response, 409, { message: 'Er loopt al een optiescan. Wacht tot deze klaar is.' })
        const state = resume ? { ...optionScans.spreads, state: 'running', message: undefined, finishedAt: undefined } : { state: 'running', filters, universeMode, rows: [], puts: [], portfolio: [], market: [], assessments: [], warnings: [], symbols,
          symbolsChecked: 0, contractsChecked: 0, startedAt: new Date().toISOString(), progress: 'Verbinding met IBKR maken' }
        if (selection) Object.assign(state, { entries: selection.entries, universeCount: selection.entries.length, universeName: 'Opgeslagen Stock Filter en IV Scan', stockSelectionId: selection.id, stockSelectionAt: selection.finishedAt, ivSelectionId: selection.ivSelectionId, ivSelectionAt: selection.ivSelectionAt, stockFilters: selection.filters })
        const previous = optionScans[mode]
        optionScans[mode] = state
        scanControllers[mode] = new AbortController()
        void runOptionScan(mode, symbols, state, previous)
        return sendJson(response, 202, state)
      }
    }
    if (request.method === 'GET' && request.url === '/api/scans') return sendJson(response, 200, { ...scanState, storageError: scanStorageError || scanState.storageError })
    if (request.method === 'POST' && request.url === '/api/scans') {
      if (weeklySchedule.isRunning()) return sendJson(response, 409, { message: 'De geplande weekscan is bezig.' })
      if (stockFilter.snapshot().state === 'running') return sendJson(response, 409, { message: 'Rond eerst de aandelenfilter af of stop deze.' })
      if (scanStorageError) return sendJson(response, 409, { message: scanStorageError })
      if (!isAllowedPost(request)) return sendJson(response, 403, { message: 'Ongeldige aanvraag.' })
      if (Object.values(optionScans).some(scan => scan.state === 'running')) return sendJson(response, 409, { message: 'Er loopt al een IV- of Leaps-scan.' })
      if (scanState.state !== 'running') {
        scanState = { state: 'running', startedAt: new Date().toISOString(), portfolio: [], market: [], warnings: [], progress: 'Portfolio laden', symbolsChecked: 0, contractsChecked: 0 }
        scanControllers.csp = new AbortController()
        void startScan()
      }
      return sendJson(response, 202, scanState)
    }
    if (request.method === 'GET' && request.url === '/api/ibkr/status') {
      return sendJson(response, 200, publicStatus())
    }

    if (request.method === 'GET' && request.url === '/api/ibkr/snapshot') {
      try {
        const snapshot = JSON.parse(await readFile(config.snapshotPath, 'utf8'))
        // Keep the real account identifier only in the private server ledger.
        return sendJson(response, 200, { ...snapshot, account: snapshot.account ? 'selected' : undefined,
          executions: snapshot.executions?.map((execution) => ({ ...execution, account: 'selected' })),
        })
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
  void refreshConnectedGateway()
  setInterval(() => void refreshConnectedGateway(), 60_000).unref()
})
