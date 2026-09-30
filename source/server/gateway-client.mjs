import { IBApi, EventName, MarketDataType } from '@stoqey/ib'
import { createLiveSnapshot, updatePosition } from './ibkr-domain.mjs'
import { normalizeExecution } from '../shared/gateway-trades.mjs'

const PREVIOUS_CLOSE_TICK_TYPES = new Set([9, 75])
const MARKET_DATA_REQUEST_ID_START = 900_000
const EXECUTIONS_REQUEST_ID = 800_000

export function collectSnapshot(config, timeoutMs = 12_000, Api = IBApi) {
  return new Promise((resolveSnapshot, rejectSnapshot) => {
    const accountValues = new Map()
    const positions = new Map()
    const quoteRequests = new Map()
    const executions = new Map()
    const commissions = new Map()
    let activeAccount
    let quoteTimeout
    let commissionTimeout
    let positionsReady = false
    let executionsReady = false
    let commissionsExpired = false
    let settled = false
    const ib = new Api({ host: config.gatewayHost, port: config.gatewayPort })

    const finish = (error, snapshot) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(quoteTimeout)
      clearTimeout(commissionTimeout)
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
      if (settled) return
      if (!positionsReady || !executionsReady) return
      if (!commissionsExpired && [...executions.keys()].some((id) => !commissions.has(id))) {
        commissionTimeout ??= setTimeout(() => { commissionsExpired = true; createSnapshot() }, 1_500)
        return
      }
      try {
        const snapshot = createLiveSnapshot({ accountValues, positions: [...positions.values()] })
        snapshot.account = activeAccount
        snapshot.executions = [...executions.values()].map((execution) => ({ ...execution, ...commissions.get(execution.execId) }))
        finish(null, snapshot)
      } catch (error) {
        finish(error)
      }
    }

    const requestPreviousCloses = () => {
      const stockPositions = [...positions.values()].filter((position) => position.position !== 0 && position.assetCategory === 'STK' && position.contract)
      if (stockPositions.length === 0) { positionsReady = true; return createSnapshot() }

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
        quoteTimeout = setTimeout(() => { positionsReady = true; createSnapshot() }, 4_000)
      } catch {
        positionsReady = true
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
      // No clientId filter: include manual orders and executions from other clients.
      ib.reqExecutions(EXECUTIONS_REQUEST_ID, { acctCode: activeAccount })
    })
    ib.on(EventName.execDetails, (requestId, contract, execution) => {
      if (requestId !== EXECUTIONS_REQUEST_ID || execution.acctNumber !== activeAccount) return
      const normalized = normalizeExecution(contract, execution)
      if (normalized) executions.set(normalized.execId, normalized)
    })
    ib.on(EventName.commissionReport, (report) => {
      commissions.set(report.execId, {
        commission: report.commission, commissionCurrency: report.currency, realizedPNL: report.realizedPNL,
      })
      createSnapshot()
    })
    ib.on(EventName.execDetailsEnd, (requestId) => {
      if (requestId !== EXECUTIONS_REQUEST_ID) return
      executionsReady = true
      createSnapshot()
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
      if (quoteRequests.size === 0) { positionsReady = true; createSnapshot() }
    })
    ib.on(EventName.error, (...args) => {
      const error = args.find((value) => value instanceof Error)
      if (args.includes(EXECUTIONS_REQUEST_ID)) return finish(error || new Error('IBKR-uitvoeringen konden niet worden opgehaald.'))
      const hasConnectionCode = args.some((value) => value === 502 || value === 504)
      const message = args.filter((value) => typeof value === 'string').join(' ')
      if (hasConnectionCode || /connect|ECONNREFUSED|socket/i.test(`${error?.message || ''} ${message}`)) {
        finish(error || new Error(message || 'Kan geen verbinding maken met IB Gateway.'))
      }
    })
    ib.on(EventName.disconnected, () => {
      if (!settled) finish(new Error('IB Gateway heeft de verbinding gesloten.'))
    })

    try {
      ib.connect(config.clientId)
    } catch (error) {
      finish(error)
    }
  })
}
