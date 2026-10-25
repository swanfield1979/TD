import { IBApi, EventName, MarketDataType } from '@stoqey/ib'
import { cspCandidate, daysToExpiry, ivRank, scanDate, sortCandidates } from '../shared/csp-scan.mjs'

import { selectSpreads, spreadFilters } from '../shared/put-spread.mjs'
import { ivMetrics, leapPut, compareLeaps } from '../shared/leaps-scan.mjs'
import { scanGuard, pacingError, disabledScanner } from './scan-guard.mjs'
import { loadIvUniverse, SP500_URL } from './iv-universe.mjs'
import { ivReference } from '../shared/iv-reference.mjs'
import { volumeSnapshot, volumeGate } from '../shared/option-volume.mjs'
export { SP500_URL } from './iv-universe.mjs'


// Separate read-only connection; requests are bounded and all subscriptions are cancelled.
export async function runCspScan(config, symbols, state, Api = IBApi, mode = 'csp') {
  const ib = new Api({ host: config.gatewayHost, port: config.gatewayPort })
  const today = scanDate()
  const stockIv = mode === 'stock-iv'
  const research = mode === 'spreads' || stockIv
  const filters = research ? spreadFilters(state.filters) : null
  const guard = scanGuard(config)
  const pacer = config.scanPacer ?? guard.pacer
  let fatalError = null
  const signal = config.scanSignal
  const ensureActive = () => {
    if (signal?.aborted) throw new Error('Scan gestopt door gebruiker.')
    if (fatalError) throw fatalError
    if (guard.cooldownUntil > Date.now()) throw new Error('IBKR-pauze actief na een snelheidslimiet; wacht een minuut en probeer opnieuw.')
  }
  let nextId = 10000
  const pending = new Map()
  const subscriptions = new Set()
  const request = async (start, endEvent, timeout = 12000, quote = false, key = '') => {
    ensureActive()
    await pacer.acquire({ signal, historical: endEvent === 'historicalData', key, onWait: ms => {
      state.progress = `Rustig scannen · ${Math.ceil(ms / 1000)} s wachten voor volgende IBKR-aanvraag`
    } })
    ensureActive()
    return new Promise((resolve, reject) => {
    const id = config.nextScanRequestId ? config.nextScanRequestId() : nextId++
    const task = { rows: [], quote: {}, endEvent, finish(error) {
      if (!pending.has(id)) return
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
  }
  const abort = () => { for (const task of [...pending.values()]) task.finish(new Error('Scan gestopt door gebruiker.')) }
  signal?.addEventListener('abort', abort)
  const maybeCompleteQuote = (id) => queueMicrotask(() => {
    const task = pending.get(id)
    if (!task?.contract) return
    const hasIv = !task.generic.split(',').includes('106') || Number.isFinite(task.quote.iv) && task.quote.iv > 0 && task.quote.iv < 10
    const hasVolume = !task.generic.split(',').includes('105') || Number.isFinite(task.quote.avgOptionVolume)
    const hasDaily = !task.generic.split(',').includes('100') || Number.isFinite(task.quote.callOptionVolume) && Number.isFinite(task.quote.putOptionVolume)
    if (completeQuote(task.contract, task.quote) && hasIv && hasVolume && hasDaily) task.finish()
  })
  ib.on(EventName.error, (error, code, id) => {
    if ([2104, 2106, 2107, 2108, 2158, 2176, 10167, 10090].includes(code)) return
    if (pacingError(code, error.message)) {
      guard.cooldownUntil = Date.now() + 60000
      fatalError = new Error(`Scan gestopt: IBKR meldt een snelheidslimiet of ongeldige realtime-aanvraag (${code}). Wacht minstens een minuut en probeer opnieuw.`)
      for (const task of [...pending.values()]) task.finish(fatalError)
      return
    }
    // Errors such as missing market-data permissions must never become valid candidates.
    if (pending.has(id)) pending.get(id).finish(Object.assign(new Error(`IBKR ${code}: ${error.message}`), { ibCode: code }))
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
    const field = ({ 1: 'bid', 2: 'ask', 4: 'last', 9: 'close', 66: 'bid', 67: 'ask', 68: 'last', 75: 'close' })[type]
    if (field) pending.get(id).quote[field] = value
    maybeCompleteQuote(id)
  })
  ib.on(EventName.tickGeneric, (id, type, value) => {
    if (type === 24 && pending.has(id)) pending.get(id).quote.iv = value
    maybeCompleteQuote(id)
  })
  ib.on(EventName.tickSize, (id, type, value) => {
    if (!pending.has(id) || !Number.isFinite(value) || value < 0) return
    const field = ({ 29: 'callOptionVolume', 30: 'putOptionVolume', 87: 'avgOptionVolume' })[type]
    if (field) { pending.get(id).quote[field] = value; maybeCompleteQuote(id) }
  })
  ib.on(EventName.tickOptionComputation, (id, type, attributes, iv, delta, price, dividend, gamma, vega, theta, underlyingPrice) => {
    if ([13, 83].includes(type) && pending.has(id)) Object.assign(pending.get(id).quote, { delta, underlyingPrice, vega, theta })
    maybeCompleteQuote(id)
  })
  const quote = (contract, generic = '') => request((id) => {
    subscriptions.add(id)
    Object.assign(pending.get(id), { contract, generic })
    ib.reqMktData(id, contract, generic, false, false)
  }, 'quote', config.scanQuoteWaitMs ?? 5000, true)
  const completeQuote = (contract, value) => contract.secType === 'STK'
    ? value.last > 0 || value.bid > 0 && value.ask >= value.bid || research && value.close > 0
    : value.bid > 0 && value.ask >= value.bid && Number.isFinite(value.delta) && Number.isFinite(value.underlyingPrice)
  async function availableQuote(contract, generic = '') {
    let lastQuote = {}, lastError
    const types = research && contract.secType === 'STK'
      ? [generic.split(',').includes('105') ? MarketDataType.REALTIME : config.marketClosed ? MarketDataType.DELAYED_FROZEN : MarketDataType.DELAYED]
      : [MarketDataType.DELAYED, MarketDataType.FROZEN, MarketDataType.DELAYED_FROZEN]
    for (const type of types) {
      try {
        ib.reqMarketDataType(type)
        lastQuote = await quote(contract, generic)
        // Data type is supplied by IBKR; never label an unspecified quote as live.
        lastQuote.marketDataType ??= type
        if (completeQuote(contract, lastQuote) && (research && contract.secType === 'STK' || !generic.split(',').includes('106') || Number.isFinite(lastQuote.iv) && lastQuote.iv > 0 && lastQuote.iv < 10)) return lastQuote
      } catch (error) { ensureActive(); lastError = error }
    }
    if (lastError && !Object.keys(lastQuote).length) throw lastError
    return lastQuote
  }
  const warn = (symbol, error) => state.warnings.push(`${symbol}: ${error.message}`)

  try {
    ensureActive()
    await new Promise((resolve, reject) => {
      const cancelConnect = () => { clearTimeout(timer); reject(new Error('Scan gestopt door gebruiker.')) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancelConnect); reject(new Error('IB Gateway is niet verbonden. Gebruik de IBKR-koppeling en probeer opnieuw.')) }, 10000)
      signal?.addEventListener('abort', cancelConnect, { once: true })
      ib.once(EventName.connected, () => { clearTimeout(timer); signal?.removeEventListener('abort', cancelConnect); resolve() })
      ib.connect(config.clientId + (mode === 'csp' ? 20 : 21))
    })
    ib.reqMarketDataType(MarketDataType.DELAYED)

    async function scanSymbol(symbol, discovery = false, suppliedContract, universe) {
      let spreadAssessment
      const assess = (status, reason) => { spreadAssessment = { symbol, status, reason, source: 'broker', asOf: new Date().toISOString() } }
      state.progress = `${mode === 'leaps' ? 'Leaps' : discovery ? 'NASDAQ / S&P 500' : 'Portfolio'} · ${symbol}`
      try {
        const details = suppliedContract ? [{ contract: suppliedContract }] : await request((id) => ib.reqContractDetails(id, { symbol, secType: 'STK', exchange: 'SMART', currency: 'USD' }), 'contractDetailsEnd')
        if (details.length !== 1) throw new Error('Geen eenduidig USD-aandelencontract gevonden.')
        const sector = await config.onStockDetails?.(symbol, details[0]) || {}
        const contract = { ...details[0].contract, exchange: 'SMART' }
        const cachedVolume = mode === 'spreads' ? await config.getSpreadLiquidity?.(symbol) : null
        const hasCachedVolume = volumeGate(volumeSnapshot({}, cachedVolume), filters?.minAvgOptionVolume ?? 0) !== 'unknown'
          && (config.marketClosed || cachedVolume?.avgOptionVolumeAt && scanDate(new Date(cachedVolume.avgOptionVolumeAt)) === today || filters?.minAvgOptionVolume === 0)
        const generic = mode === 'spreads' && filters.minAvgOptionVolume > 0 && !hasCachedVolume ? '100,105,106' : '106'
        const stock = await availableQuote(contract, generic).catch(error => { if (generic.includes('105')) error.code = 'VOLUME_UNAVAILABLE'; throw error })
        const stockQuotedAt = new Date().toISOString()
        const liquidity = mode === 'spreads' ? volumeSnapshot(stock, cachedVolume) : {}
        const price = stock.last > 0 ? stock.last : stock.bid > 0 && stock.ask >= stock.bid ? (stock.bid + stock.ask) / 2 : research && stock.close > 0 ? stock.close : null
        if (mode === 'spreads') {
          state.liquidity = { symbol, ...liquidity }
          if (liquidity.avgOptionVolume !== undefined || liquidity.dayOptionVolume !== undefined) await config.saveSpreadLiquidity?.(symbol, liquidity)
          if (price && (price < filters.minPrice || price > filters.maxPrice)) { assess('filtered', `Koers $${price.toFixed(2)} buiten ${filters.minPrice}–${filters.maxPrice}; IV-historie en optiechain overgeslagen.`); return }
          const gate = volumeGate(liquidity, filters.minAvgOptionVolume)
          if (gate === 'unknown') throw Object.assign(new Error('Gemiddeld optievolume onbekend; IV-historie en optiechain overgeslagen. Vereist beschikbare live generieke marktdata of recente volumecache. Zet het volumeminimum op 0 om dit filter bewust uit te schakelen.'), { code: 'VOLUME_UNAVAILABLE' })
          if (gate === 'below') { assess('filtered', `Gemiddeld optievolume ${liquidity.avgOptionVolume} lager dan ${filters.minAvgOptionVolume}; IV-historie en optiechain overgeslagen.`); return }
        }
        if (!price) throw new Error('Actuele aandelenkoers ontbreekt.')
        if (!research && (!Number.isFinite(stock.iv) || stock.iv <= 0 || stock.iv >= 10)) throw new Error('Actuele IV ontbreekt; historiedownload overgeslagen. Controleer optiedatarechten.')
        if (mode === 'csp' && discovery && (price < 10 || price > 50)) return
        const historyKey = `${contract.conId}:${symbol}:${today}`
        const cached = guard.history.get(historyKey) ?? (research ? await config.getSpreadIv?.(symbol) : null)
        let bars
        if (cached && (!research || ivReference(undefined, cached.bars, today)) && (cached.day === today || typeof cached.savedAt === 'number' && Date.now() - cached.savedAt < 86400000 || research && config.marketClosed && ivReference(undefined, cached.bars, today))) {
          bars = cached.bars; state.historyCacheHits = (state.historyCacheHits ?? 0) + 1
        } else {
          let fresh
          const incremental = research && cached?.bars?.length && ivReference(undefined, cached.bars, today)
          try {
            fresh = await request((id) => ib.reqHistoricalData(id, contract, '', incremental ? '10 D' : '1 Y', '1 day', 'OPTION_IMPLIED_VOLATILITY', 1, 1, false), 'historicalData', 20000, false, historyKey)
          } catch (error) {
            ensureActive()
            if (research) error.code = 'IV_UNAVAILABLE'
            throw error
          }
          bars = incremental ? [...new Map([...cached.bars, ...fresh].map(bar => [bar.date.replaceAll('-', ''), bar])).values()].filter(bar => daysToExpiry(bar.date, today) >= -366) : fresh
          if (ivRank(stock.iv, bars, today) !== null || research && ivReference(undefined, bars, today)) {
            if (guard.history.size >= 500) guard.history.delete(guard.history.keys().next().value)
            guard.history.set(historyKey, { bars, day: today, savedAt: Date.now() })
            if (research) await config.saveSpreadIv?.(symbol, { bars, day: today })
          }
        }
        const reference = research ? ivReference(stock.iv, bars, today, { completedOnly: !config.marketClosed }) : null
        const currentIv = reference?.value ?? stock.iv
        const ivr = ivRank(currentIv, bars, today)
        if (ivr === null) throw Object.assign(new Error('Geen bruikbare IV of recente volledige IV-jaarhistorie. Controleer beschikbaarheid in TWS en datarechten; er wordt geen IV verzonnen.'), { code: 'IV_UNAVAILABLE' })
        const metrics = ivMetrics(currentIv, bars, today)
        const ivMetadata = reference ? { ivSource: reference.source, ivAsOf: reference.asOf } : {}
        if (stockIv) {
          state.rows.push({ symbol, underlyingPrice: price, iv: currentIv * 100, ...metrics, ...ivMetadata, ...sector, marketDataType: stock.marketDataType, quotedAt: stockQuotedAt })
          return
        }
        if (mode === 'spreads') state.ivReference = { symbol, ...ivMetadata }
        if (mode === 'spreads' ? ivr < filters.minIvr : ivr <= (mode === 'csp' ? 30 : 40)) {
          if (mode === 'spreads') assess('filtered', `IV-rank ${ivr.toFixed(2)} lager dan ${filters.minIvr}; optiechain overgeslagen.`)
          return
        }
        if (mode === 'iv') {
          state.rows.push({ symbol, underlyingPrice: price, iv: stock.iv * 100, ...metrics,
            marketDataType: stock.marketDataType, quotedAt: new Date().toISOString(), universe })
          state.rows.sort((a, b) => b.ivr - a.ivr)
          return
        }
        if (mode === 'leaps' && metrics.ivPercentile <= 50) return
        const chains = await request((id) => ib.reqSecDefOptParams(id, symbol, '', 'STK', contract.conId), 'securityDefinitionOptionParameterEnd')
        const contracts = []
        const seen = new Set()
        for (const chain of chains.filter((chain) => chain.exchange === 'SMART' && chain.multiplier === 100)) {
          for (const expiry of chain.expirations.filter((value) => mode === 'spreads' ? daysToExpiry(value, today) >= filters.minDte && daysToExpiry(value, today) <= filters.maxDte : mode === 'leaps' ? ((daysToExpiry(value, today) >= 30 && daysToExpiry(value, today) <= 50) || (daysToExpiry(value, today) >= 300 && daysToExpiry(value, today) <= 700)) : daysToExpiry(value, today) >= 35 && daysToExpiry(value, today) <= 50)) {
            // Bounded coverage: 32 strikes nearest the requested short-strike ceiling.
            const strikes = chain.strikes.filter(value => value > 0 && value < price)
            const selected = mode === 'spreads' ? strikes.filter(value => value <= price * (1 - filters.minBuffer / 100)).sort((a,b) => b-a).slice(0,32) : strikes
            for (const strike of selected) {
              const key = `${chain.tradingClass}:${expiry}:${strike}`
              if (seen.has(key)) continue
              seen.add(key)
              contracts.push({ symbol, secType: 'OPT', exchange: 'SMART', currency: 'USD', right: 'P', multiplier: '100', tradingClass: chain.tradingClass, lastTradeDateOrContractMonth: expiry, strike })
            }
          }
        }
        if (mode === 'spreads') state.coverage = 'Maximaal 32 strikes per expiratie en handelsklasse, onder de gekozen buffergrens; geen volledige marktdekking.'
        if (!contracts.length) throw new Error(mode === 'spreads' ? 'Geen standaardputs binnen de gekozen looptijd en buffer beschikbaar.' : mode === 'leaps' ? 'Geen standaardputs binnen 30–50 of 300–700 DTE beschikbaar.' : 'Geen standaardputketen met 35–50 dagen looptijd beschikbaar.')
        const symbolPuts = []
        let missing = 0
        for (let offset = 0; offset < contracts.length; offset += 1) {
          const batch = contracts.slice(offset, offset + 1)
          const quotes = await Promise.allSettled(batch.map((contract) => availableQuote(contract)))
          for (let index = 0; index < batch.length; index++) {
            state.contractsChecked++
            const item = quotes[index]
            const opt = batch[index]
            if (item.status !== 'fulfilled' || !Number.isFinite(item.value.delta) || !(item.value.bid > 0) || !Number.isFinite(item.value.ask)) { missing++; continue }
            if (mode === 'spreads') {
              state.puts.push({ ...item.value, ...sector, symbol, right: 'P', currency: 'USD', multiplier: 100, strike: opt.strike,
                underlyingPrice: price, expiry: opt.lastTradeDateOrContractMonth, tradingClass: opt.tradingClass, ivr, ...ivMetadata, ...liquidity,
                quotedAt: new Date().toISOString(), marketDataType: item.value.marketDataType })
              symbolPuts.push(state.puts.at(-1))
              state.rows = selectSpreads(state.puts, today, filters)
              continue
            }
            const row = (mode === 'leaps' ? leapPut : cspCandidate)({ ...item.value, symbol, right: 'P', currency: 'USD', multiplier: 100, strike: opt.strike,
              expiry: opt.lastTradeDateOrContractMonth, tradingClass: opt.tradingClass, ivr, ...metrics,
              marketDataType: item.value.marketDataType ?? 3, quotedAt: new Date().toISOString(), universe }, today, discovery)
            if (row) {
              const list = mode === 'leaps' ? state.puts : discovery ? state.market : state.portfolio
              list.push(row)
              list.sort((a, b) => b.annualizedYield - a.annualizedYield)
            }
          }
          if (mode === 'spreads') {
            state.progress = `Put spreads · ${symbol} · ${offset + 1} / ${contracts.length} contracten`
            await config.onScanCheckpoint?.()
          }
          if (mode === 'leaps') {
            state.rows = compareLeaps(state.puts)
            state.progress = `Leaps · ${symbol} · ${Math.min(offset + batch.length, contracts.length)} / ${contracts.length} contracten`
            await config.onScanCheckpoint?.()
          }
          ensureActive()
        }
        if (mode === 'spreads') {
          if (symbolPuts.length) await config.onSpreadSnapshot?.({ symbol, underlyingPrice: price, ivr, ...ivMetadata, ...liquidity, quotedAt: stockQuotedAt, puts: symbolPuts, chains, filters, coverage: state.coverage })
          const count = state.rows.filter(row => row.symbol === symbol).length
          assess(missing ? 'partial' : count ? 'match' : 'no-match', `${count} passende spreads; ${symbolPuts.length} putquotes; ${missing} contracten zonder volledige data.`)
        }
        if (missing) state.warnings.push(`${symbol}: ${missing} contracten zonder volledige bied/laat/greeks; overgeslagen.`)
      } catch (error) { ensureActive(); warn(symbol, error); if (mode === 'spreads') { assess('missing', error.message); spreadAssessment.code = error.code; spreadAssessment.ibCode = error.ibCode } }
      finally { state.symbolsChecked++; if (mode === 'spreads' && spreadAssessment) { Object.assign(spreadAssessment, state.ivReference?.symbol === symbol ? state.ivReference : {}, state.liquidity?.symbol === symbol ? state.liquidity : {}); state.assessments ??= []; state.assessments.push(spreadAssessment) } }
    }

    if (mode === 'iv' && !config.ivUseBrokerScanner) {
      state.progress = 'Aandelenlijst laden · zonder IBKR-marktscanner'
      if (!guard.ivRound || (guard.ivRound.date !== today && !config.ivContinueRound) || guard.ivRound.cursor >= guard.ivRound.entries.length) {
        const universe = await (config.ivUniverseLoader ?? loadIvUniverse)(signal)
        guard.ivRound = { ...universe, date: today, cursor: 0, matches: new Map() }
      }
      const round = guard.ivRound
      state.rows = [...round.matches.values()].sort((a,b) => b.ivr - a.ivr)
      state.roundDate = round.date
      state.universeCount = round.entries.length
      state.universeChecked = round.cursor
      state.universeUpdatedAt = round.updatedAt
      state.discoverySource = 'Aandelenlijsten · geen IBKR-scannertype'
      state.batchSize = 25
      state.warnings.push(...round.warnings)
      const end = Math.min(round.cursor + state.batchSize, round.entries.length)
      while (round.cursor < end) {
        ensureActive()
        const entry = round.entries[round.cursor]
        state.progress = `IV Scan · ${entry.symbol} · ${round.cursor + 1} / ${round.entries.length}`
        await scanSymbol(entry.symbol, true, undefined, entry.universe)
        for (const row of state.rows) round.matches.set(row.symbol, row)
        round.cursor++
        state.universeChecked = round.cursor
        state.remainingSymbols = round.entries.length - round.cursor
        await config.onScanCheckpoint?.()
      }
      state.remainingSymbols = round.entries.length - round.cursor
      state.state = state.warnings.length ? 'partial' : 'complete'
      state.message = `${round.cursor} / ${round.entries.length} aandelen gecontroleerd. ${state.remainingSymbols ? 'Klik Volgende 25 scannen om verder te gaan.' : 'Deze scanronde is afgerond.'}`
      state.progress = state.message
      return
    }
    for (const symbol of [...new Set(symbols)]) await scanSymbol(symbol)
    if (stockIv) {
      state.state = state.warnings.length ? 'partial' : 'complete'
      return
    }
    if (mode === 'spreads') {
      state.rows = selectSpreads(state.puts, today, filters)
      state.state = state.warnings.length ? 'partial' : 'complete'
      state.progress = 'Scan afgerond'
      delete state.puts
      return
    }
    if (mode === 'leaps') {
      state.rows = compareLeaps(state.puts)
      for (const symbol of symbols) {
        const rows = state.rows.filter(row => row.symbol === symbol)
        state.assessments.push({ symbol, matches: rows.filter(row => row.qualifies).length,
          message: rows.some(row => row.qualifies) ? 'Passende Leaps gevonden' : rows.length ? 'Langlopende puts gevonden, maar geen aantoonbaar beter rendement bij vergelijkbare delta' : 'Geen passende puts of onvoldoende data; zie eventuele meldingen' })
      }
      state.state = state.warnings.length ? 'partial' : 'complete'
      state.progress = 'Scan afgerond'
      delete state.puts
      return
    }
    state.progress = 'Interessante NASDAQ / S&P 500-aandelen zoeken'
    let sp500 = new Set()
    try {
      const response = await fetch(SP500_URL, { signal: config.scanSignal ? AbortSignal.any([config.scanSignal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const csv = await response.text()
      sp500 = new Set(csv.split(/\r?\n/).slice(1).map((line) => line.split(',')[0].replace('.', ' ')))
      if (sp500.size < 400) throw new Error('Onvolledige S&P 500-lijst.')
      state.universeUpdatedAt = new Date().toISOString()
    } catch { sp500 = new Set(); state.warnings.push('S&P 500-ledenlijst niet beschikbaar; alleen bevestigde NASDAQ-noteringen worden gebruikt.') }
    const discovered = new Map()
    for (const locationCode of ['STK.US.NASDAQ', 'STK.US.MAJOR']) {
      try {
        const discover = async (scanCode) => {
          ensureActive()
          if ((guard.disabled.get(scanCode) ?? 0) > Date.now()) throw new Error(`${scanCode}: scannertype door IBKR uitgeschakeld; gedurende één uur niet opnieuw aangevraagd.`)
          try {
            return await request((id) => ib.reqScannerSubscription(id, { instrument: 'STK', locationCode,
              scanCode, numberOfRows: 50, ...(mode === 'csp' ? { abovePrice: 10, belowPrice: 50 } : {}), stockTypeFilter: 'CORP' }), 'scannerDataEnd')
          } catch (error) {
            ensureActive()
            if (disabledScanner(error.message)) {
              guard.disabled.set(scanCode, Date.now() + 3600000)
              throw new Error(`${scanCode}: IBKR heeft dit scannertype uitgeschakeld. Eén uur overgeslagen; controleer dezelfde scanner in TWS. (${error.message})`)
            }
            throw error
          }
        }
        let rows
        try { rows = await discover('HIGH_OPT_IMP_VOLAT') }
        catch (error) {
          ensureActive()
          state.warnings.push(`${locationCode}: IV-scanner niet beschikbaar (${error.message}); terugval naar MOST_ACTIVE. Scancriteria blijven ongewijzigd.`)
          rows = await discover('MOST_ACTIVE')
        }
        for (const details of rows) {
          const contract = details.contract
          const nasdaq = locationCode === 'STK.US.NASDAQ'
          if (!contract || (!nasdaq && !sp500.has(contract.symbol)) || symbols.includes(contract.symbol)) continue
          discovered.set(contract.symbol, { contract, universe: nasdaq ? (sp500.has(contract.symbol) ? 'NASDAQ · S&P 500' : 'NASDAQ') : 'S&P 500' })
        }
      } catch (error) { ensureActive(); warn(locationCode, error) }
    }
    state.marketSymbols = discovered.size
    if (!discovered.size && state.warnings.some(warning => /scannertype.*uitgeschakeld|scanner type.*disabled/.test(warning))) {
      state.message = 'Marktscan niet beschikbaar: IBKR heeft de scannertypen uitgeschakeld. Controleer de Advanced Market Scanner in TWS; Leaps op je handmatige shortlist blijft afzonderlijk beschikbaar.'
      state.state = 'partial'
      state.progress = state.message
      return
    }
    for (const [symbol, entry] of discovered) await scanSymbol(symbol, true, entry.contract, entry.universe)
    state.portfolio = sortCandidates(state.portfolio)
    state.market = sortCandidates(state.market)
    state.state = state.warnings.length ? 'partial' : 'complete'
    state.progress = 'Scan afgerond'
  } catch (error) { state.state = signal?.aborted ? 'cancelled' : 'error'; state.message = error.message }
  finally {
    if (mode === 'iv' && !config.ivUseBrokerScanner && guard.ivRound) {
      state.universeChecked = guard.ivRound.cursor
      state.remainingSymbols = guard.ivRound.entries.length - guard.ivRound.cursor
    }
    signal?.removeEventListener('abort', abort)
    for (const task of pending.values()) task.finish(new Error('Scanverbinding gesloten.'))
    ib.disconnect()
    state.finishedAt = new Date().toISOString()
  }
}
