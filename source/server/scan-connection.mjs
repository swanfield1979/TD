import { EventEmitter } from 'node:events'
import { IBApi, EventName } from '@stoqey/ib'

// One physical read-only connection per job, with isolated listeners per stock.
export function createScanConnection(Api = IBApi) {
  let broker, connected = false, requestId = 10000
  const events = [...new Set(Object.values(EventName).filter(value => typeof value === 'string'))]
  class Connection extends EventEmitter {
    constructor(options) {
      super()
      if (!broker) {
        broker = new Api(options)
        broker.on(EventName.connected, () => { connected = true })
        broker.on(EventName.disconnected, () => { connected = false })
        // A socket error between stocks must not become an unhandled EventEmitter error.
        broker.on(EventName.error, () => {})
      }
      this.forwarders = events.map(event => {
        const forward = (...args) => this.emit(event, ...args)
        broker.on(event, forward)
        return [event, forward]
      })
    }
    connect(id) { if (connected) queueMicrotask(() => this.emit(EventName.connected)); else broker.connect(id) }
    disconnect() { for (const [event, forward] of this.forwarders) broker.removeListener(event, forward); this.forwarders = [] }
  }
  for (const method of ['reqMarketDataType', 'reqMktData', 'cancelMktData', 'reqContractDetails', 'reqSecDefOptParams', 'reqHistoricalData', 'cancelHistoricalData', 'reqScannerSubscription', 'cancelScannerSubscription'])
    Connection.prototype[method] = function (...args) { return broker[method](...args) }
  return { Api: Connection, nextRequestId: () => requestId++, close() { broker?.disconnect(); connected = false } }
}
