import { IBApi, EventName } from '@stoqey/ib'
import { scanGuard, pacingError } from './scan-guard.mjs'

// Lazy fallback: one connection, one bounded historical request at a time.
export function createIbkrStockHistory(config, signal, Api = IBApi) {
  let ib, connected, pending, nextId = 70000
  const guard = scanGuard(config)
  const abort = () => pending?.finish(Error('Aandelenfilter gestopt.'))
  signal.addEventListener('abort', abort)
  async function connect() {
    if (connected) return connected
    ib = new Api({ host: config.gatewayHost, port: config.gatewayPort })
    connected = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(Error('Gateway niet bereikbaar.')) }, 3000)
      const cancel = () => { cleanup(); reject(Error('Aandelenfilter gestopt.')) }
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel) }
      signal.addEventListener('abort', cancel, { once: true })
      ib.once(EventName.connected, () => { cleanup(); resolve() })
    })
    ib.on(EventName.error, (error, code, id) => {
      if (pacingError(code, error.message)) {
        guard.cooldownUntil = Date.now() + 60000
        pending?.finish(Object.assign(Error('IBKR-snelheidslimiet; wacht een minuut en hervat.'), { fatal: true }))
      } else if (pending?.id === id) pending.finish(Error(`IBKR ${code}: ${error.message}`))
    })
    ib.on(EventName.historicalData, (id, date, open, high, low, close, volume) => {
      if (pending?.id !== id) return
      if (date.startsWith('finished')) pending.finish()
      else pending.bars.push({ date: date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), close, volume: volume * (config.stockVolumeMultiplier ?? 1) })
    })
    ib.connect(config.clientId + 24)
    return connected
  }
  return {
    async history(symbol) {
      signal.throwIfAborted()
      if (guard.cooldownUntil > Date.now()) throw Object.assign(Error('IBKR-pauze actief; wacht een minuut en hervat.'), { fatal: true })
      await connect()
      await guard.pacer.acquire({ signal, historical: true, key: `stock-filter:${symbol}` })
      signal.throwIfAborted()
      return new Promise((resolve, reject) => {
        const id = nextId++
        const task = { id, bars: [], finish(error) {
          clearTimeout(timer); pending = null; ib.cancelHistoricalData(id)
          if (error) reject(error); else resolve(task.bars)
        } }
        const timer = setTimeout(() => task.finish(Error('Dagdata niet beschikbaar.')), 8000)
        pending = task
        try { ib.reqHistoricalData(id, { symbol, secType: 'STK', exchange: 'SMART', currency: 'USD' }, '', '5 D', '1 day', 'TRADES', 1, 1, false) } catch (error) { task.finish(error) }
      })
    },
    close() { signal.removeEventListener('abort', abort); ib?.disconnect() },
  }
}
