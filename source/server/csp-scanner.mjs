import { IBApi, EventName, MarketDataType } from '@stoqey/ib'
import { cspCandidate, daysToExpiry, ivRank, scanDate, sortCandidates } from '../shared/csp-scan.mjs'

export const SP500_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Separate read-only connection; requests are bounded and all subscriptions are cancelled.
export async function runCspScan(config, symbols, state, Api = IBApi) {
  const ib = new Api({ host: config.gatewayHost, port: config.gatewayPort })
  const today = scanDate()
  let nextId = 10000
  const pending = new Map()
  const subscriptions = new Set()
  const request = (start, endEvent, timeout = 12000, quote = false) => new Promise((resolve, reject) => {
    const id = nextId++
    const task = { rows: [], quote: {}, endEvent, finish(error) {
      clearTimeout(task.timer)
      pending.delete(id)
      if (subscriptions.delete(id)) ib.cancelMktData(id)
      if (endEvent === 'scannerDataEnd') ib.cancelScannerSubscription(id)
      if (endEvent === 'historicalData') ib.cancelHistoricalData(id)
      if (error) reject(error)
      else resolve(quote ? task.quote : task.rows)
    } }
    task.timer = setTimeout(() => task.finish(quote ? null : new Error('IBKR-aanvraag verlopen.')), timeout)
    pending.set(id, task)
    try { start(id) } catch (error) { task.finish(error) }
  })
  ib.on(EventName.error, (error, code, id) => {
    if ([2104, 2106, 2107, 2108, 2158, 2176, 10167, 10090].includes(code)) return
    // Errors such as missing market-data permissions must never become valid candidates.
    if (pending.has(id)) pending.get(id).finish(new Error(`IBKR ${code}: ${error.message}`))
  })
  ib.on(EventName.contractDetails, (id, details) => pending.get(id)?.rows.push(details))
  ib.on(EventName.contractDetailsEnd, (id) => pending.get(id)?.finish())
  ib.on(EventName.scannerData, (id, rank, details) => pending.get(id)?.rows.push(details))
  ib.on(EventName.scannerDataEnd, (id) => pending.get(id)?.finish())
  ib.on(EventName.securityDefinitionOptionParameter, (id, exchange, conid, tradingClass, multiplier, expirations, strikes) => {
    pending.get(id)?.rows.push({ exchange, tradingClass, multiplier: Number(multiplier), expirations, strikes })
  })
  ib.on(EventName.securityDefinitionOptionParameterEnd, (id) => pending.get(id)?.finish())
  ib.on(EventName.historicalData, (id, date, open, high, low, close) => {
    if (date.startsWith('finished')) pending.get(id)?.finish()
    else pending.get(id)?.rows.push({ date, close })
  })
  ib.on(EventName.marketDataType, (id, type) => { if (pending.has(id)) pending.get(id).quote.marketDataType = type })
  ib.on(EventName.tickPrice, (id, type, value) => {
    if (!pending.has(id) || value < 0 || !Number.isFinite(value)) return
    const field = ({ 1: 'bid', 2: 'ask', 4: 'last', 66: 'bid', 67: 'ask', 68: 'last' })[type]
    if (field) pending.get(id).quote[field] = value
  })
  ib.on(EventName.tickGeneric, (id, type, value) => {
    if (type === 24 && pending.has(id)) pending.get(id).quote.iv = value
  })
  ib.on(EventName.tickOptionComputation, (id, type, attributes, iv, delta, price, dividend, gamma, vega, theta, underlyingPrice) => {
    if ([13, 83].includes(type) && pending.has(id)) Object.assign(pending.get(id).quote, { delta, underlyingPrice })
  })
  const quote = (contract, generic = '') => request((id) => {
    subscriptions.add(id)
    ib.reqMktData(id, contract, generic, false, false)
  }, 'quote', config.scanQuoteWaitMs ?? 5000, true)
  const completeQuote = (contract, value) => contract.secType === 'STK'
    ? value.last > 0 || value.bid > 0 && value.ask >= value.bid
    : value.bid > 0 && value.ask >= value.bid && Number.isFinite(value.delta) && Number.isFinite(value.underlyingPrice)
  async function availableQuote(contract, generic = '') {
    let lastQuote = {}, lastError
    for (const type of [MarketDataType.DELAYED, MarketDataType.FROZEN, MarketDataType.DELAYED_FROZEN]) {
      try {
        ib.reqMarketDataType(type)
        lastQuote = await quote(contract, generic)
        // Data type is supplied by IBKR; never label an unspecified quote as live.
        lastQuote.marketDataType ??= type
        if (completeQuote(contract, lastQuote)) return lastQuote
      } catch (error) { lastError = error }
    }
    if (lastError && !Object.keys(lastQuote).length) throw lastError
    return lastQuote
  }
  const warn = (symbol, error) => state.warnings.push(`${symbol}: ${error.message}`)

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('IB Gateway is niet verbonden. Gebruik de IBKR-koppeling en probeer opnieuw.')), 10000)
      ib.once(EventName.connected, () => { clearTimeout(timer); resolve() })
      ib.connect(config.clientId + 20)
    })
    ib.reqMarketDataType(MarketDataType.DELAYED)

    async function scanSymbol(symbol, discovery = false, suppliedContract, universe) {
      state.progress = `${discovery ? 'NASDAQ / S&P 500' : 'Portfolio'} · ${symbol}`
      try {
        const details = suppliedContract ? [{ contract: suppliedContract }] : await request((id) => ib.reqContractDetails(id, { symbol, secType: 'STK', exchange: 'SMART', currency: 'USD' }), 'contractDetailsEnd')
        if (details.length !== 1) throw new Error('Geen eenduidig USD-aandelencontract gevonden.')
        const contract = { ...details[0].contract, exchange: 'SMART' }
        const stock = await availableQuote(contract, '106')
        const price = stock.last > 0 ? stock.last : stock.bid > 0 && stock.ask >= stock.bid ? (stock.bid + stock.ask) / 2 : null
        if (!price) throw new Error('Actuele aandelenkoers ontbreekt.')
        if (discovery && (price < 10 || price > 50)) return
        const bars = await request((id) => ib.reqHistoricalData(id, contract, '', '1 Y', '1 day', 'OPTION_IMPLIED_VOLATILITY', 1, 1, false), 'historicalData', 20000)
        const ivr = ivRank(stock.iv, bars, today)
        if (ivr === null) throw new Error('Actuele IV of voldoende recente jaarhistorie ontbreekt; IVR niet toetsbaar.')
        if (ivr <= 30) return
        const chains = await request((id) => ib.reqSecDefOptParams(id, symbol, '', 'STK', contract.conId), 'securityDefinitionOptionParameterEnd')
        const contracts = []
        const seen = new Set()
        for (const chain of chains.filter((chain) => chain.exchange === 'SMART' && chain.multiplier === 100)) {
          for (const expiry of chain.expirations.filter((value) => daysToExpiry(value, today) >= 35 && daysToExpiry(value, today) <= 50)) {
            for (const strike of chain.strikes.filter((value) => value > 0 && value < price)) {
              const key = `${chain.tradingClass}:${expiry}:${strike}`
              if (seen.has(key)) continue
              seen.add(key)
              contracts.push({ symbol, secType: 'OPT', exchange: 'SMART', currency: 'USD', right: 'P', multiplier: '100', tradingClass: chain.tradingClass, lastTradeDateOrContractMonth: expiry, strike })
            }
          }
        }
        if (!contracts.length) throw new Error('Geen standaardputketen met 35–50 dagen looptijd beschikbaar.')
        let missing = 0
        for (let offset = 0; offset < contracts.length; offset += 15) {
          const batch = contracts.slice(offset, offset + 15)
          const quotes = await Promise.allSettled(batch.map((contract) => availableQuote(contract)))
          for (let index = 0; index < batch.length; index++) {
            state.contractsChecked++
            const item = quotes[index]
            const opt = batch[index]
            if (item.status !== 'fulfilled' || !Number.isFinite(item.value.delta) || !(item.value.bid > 0) || !Number.isFinite(item.value.ask)) { missing++; continue }
            const row = cspCandidate({ ...item.value, symbol, right: 'P', currency: 'USD', multiplier: 100, strike: opt.strike,
              expiry: opt.lastTradeDateOrContractMonth, tradingClass: opt.tradingClass, ivr,
              marketDataType: item.value.marketDataType ?? 3, quotedAt: new Date().toISOString(), universe }, today, discovery)
            if (row) {
              const list = discovery ? state.market : state.portfolio
              list.push(row)
              list.sort((a, b) => b.annualizedYield - a.annualizedYield)
            }
          }
          await pause(100)
        }
        if (missing) state.warnings.push(`${symbol}: ${missing} contracten zonder volledige bied/laat/greeks; overgeslagen.`)
      } catch (error) { warn(symbol, error) }
      finally { state.symbolsChecked++ }
    }

    for (const symbol of [...new Set(symbols)]) await scanSymbol(symbol)
    state.progress = 'Interessante NASDAQ / S&P 500-aandelen zoeken'
    let sp500 = new Set()
    try {
      const response = await fetch(SP500_URL, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const csv = await response.text()
      sp500 = new Set(csv.split(/\r?\n/).slice(1).map((line) => line.split(',')[0].replace('.', ' ')))
      if (sp500.size < 400) throw new Error('Onvolledige S&P 500-lijst.')
      state.universeUpdatedAt = new Date().toISOString()
    } catch { sp500 = new Set(); state.warnings.push('S&P 500-ledenlijst niet beschikbaar; alleen bevestigde NASDAQ-noteringen worden gebruikt.') }
    const discovered = new Map()
    for (const locationCode of ['STK.US.NASDAQ', 'STK.US.MAJOR']) {
      try {
        const discover = (scanCode) => request((id) => ib.reqScannerSubscription(id, { instrument: 'STK', locationCode,
          scanCode, numberOfRows: 50, abovePrice: 10, belowPrice: 50, stockTypeFilter: 'CORP' }), 'scannerDataEnd')
        let rows
        try { rows = await discover('HIGH_OPT_IMP_VOLAT') }
        catch {
          state.warnings.push(`${locationCode}: IV-scanner niet beschikbaar; terugval naar MOST_ACTIVE. CSP-criteria blijven ongewijzigd.`)
          rows = await discover('MOST_ACTIVE')
        }
        for (const details of rows) {
          const contract = details.contract
          const nasdaq = locationCode === 'STK.US.NASDAQ'
          if (!contract || (!nasdaq && !sp500.has(contract.symbol)) || symbols.includes(contract.symbol)) continue
          discovered.set(contract.symbol, { contract, universe: nasdaq ? (sp500.has(contract.symbol) ? 'NASDAQ · S&P 500' : 'NASDAQ') : 'S&P 500' })
        }
      } catch (error) { warn(locationCode, error) }
    }
    state.marketSymbols = discovered.size
    for (const [symbol, entry] of discovered) await scanSymbol(symbol, true, entry.contract, entry.universe)
    state.portfolio = sortCandidates(state.portfolio)
    state.market = sortCandidates(state.market)
    state.state = state.warnings.length ? 'partial' : 'complete'
    state.progress = 'Scan afgerond'
  } catch (error) { state.state = 'error'; state.message = error.message }
  finally {
    for (const task of pending.values()) task.finish(new Error('Scanverbinding gesloten.'))
    ib.disconnect()
    state.finishedAt = new Date().toISOString()
  }
}
