import { setTimeout as sleep } from 'node:timers/promises'

export class ScanPacer {
  constructor({ interval = 500, historyInterval = 11000, historyLimit = 55, historyWindow = 600000,
    now = () => performance.now(), wait = (ms, signal) => sleep(ms, undefined, { signal }) } = {}) {
    Object.assign(this, { interval, historyInterval, historyLimit, historyWindow, now, wait })
    this.last = -Infinity; this.lastHistory = -Infinity; this.history = []; this.identical = new Map(); this.tail = Promise.resolve()
  }
  async acquire({ signal, historical = false, key = '', onWait = () => {} } = {}) {
    const operation = this.tail.then(async () => {
      signal?.throwIfAborted()
      let now = this.now()
      this.history = this.history.filter(time => now - time < this.historyWindow)
      let delay = Math.max(0, this.last + this.interval - now)
      if (historical) {
        delay = Math.max(delay, this.lastHistory + this.historyInterval - now, (this.identical.get(key) ?? -Infinity) + 15000 - now)
        if (this.history.length >= this.historyLimit) delay = Math.max(delay, this.history[0] + this.historyWindow - now)
      }
      if (delay > 0) { onWait(delay); await this.wait(delay, signal) }
      signal?.throwIfAborted()
      now = this.now(); this.last = now
      if (historical) { this.lastHistory = now; this.history.push(now); this.identical.set(key, now) }
    })
    this.tail = operation.catch(() => {})
    await operation
  }
}

const gateways = new Map()
export function scanGuard(config) {
  const key = `${config.gatewayHost ?? '127.0.0.1'}:${config.gatewayPort ?? 4001}`
  if (!gateways.has(key)) gateways.set(key, { pacer: new ScanPacer(), disabled: new Map(), history: new Map(), cooldownUntil: 0 })
  return gateways.get(key)
}
export function resetScanGuards() { gateways.clear() }
export const pacingError = (code, message) => code === 100 || code === 420 || /pacing violation|too many requests|max(?:imum)? rate|message rate/i.test(message)
export const disabledScanner = message => /scanner type.*disabled/i.test(message)
