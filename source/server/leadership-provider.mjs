import { IBApi, EventName } from '@stoqey/ib'

export function completedBars(rows, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  // Conservatively exclude today's daily bar, also after close: published on next calendar day.
  return rows.filter((b) => b.date < today)
}

export async function connectHistory(config, Api = IBApi) {
  const ib = new Api({ host: config.gatewayHost, port: config.gatewayPort }),
    pending = new Map()
  let nextId = 30000,
    connectionReject
  const finish = (id, error) => {
    const task = pending.get(id)
    if (!task) return
    pending.delete(id)
    clearTimeout(task.timer)
    try {
      ib.cancelHistoricalData(id)
    } catch {
      /* already cancelled */
    }
    error ? task.reject(error) : task.resolve(completedBars(task.rows))
  }
  ib.on(
    EventName.historicalData,
    (id, date, open, high, low, close, volume) => {
      if (String(date).startsWith('finished')) return finish(id)
      const raw = String(date)
      pending
        .get(id)
        ?.rows.push({
          date: /^\d{8}$/.test(raw)
            ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
            : raw,
          open,
          high,
          low,
          close,
          volume,
        })
    },
  )
  ib.on(EventName.error, (error, code, id) => {
    if ([2104, 2106, 2107, 2108, 2158, 2176].includes(code)) return
    const failure = new Error(`IBKR ${code}: ${error?.message ?? error}`)
    if (pending.has(id)) finish(id, failure)
    else if ([502, 504, 1100, 1300].includes(code)) {
      connectionReject?.(failure)
      for (const id of [...pending.keys()]) finish(id, failure)
    }
  })
  ib.on(EventName.disconnected, () => {
    for (const id of [...pending.keys()])
      finish(id, new Error('IB Gateway-verbinding gesloten.'))
  })
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              'IB Gateway niet bereikbaar. Verbind eerst de IBKR-koppeling.',
            ),
          ),
        10000,
      )
      connectionReject = (error) => {
        clearTimeout(timer)
        reject(error)
      }
      ib.once(EventName.connected, () => {
        clearTimeout(timer)
        connectionReject = null
        resolve()
      })
      try {
        ib.connect(config.clientId + 30)
      } catch (error) {
        clearTimeout(timer)
        reject(error)
      }
    })
  } catch (error) {
    ib.disconnect()
    throw error
  }
  return {
    history: (symbol) =>
      new Promise((resolve, reject) => {
        const id = nextId++,
          task = {
            rows: [],
            resolve,
            reject,
            timer: setTimeout(
              () => finish(id, new Error('Historie-aanvraag verlopen.')),
              30000,
            ),
          }
        pending.set(id, task)
        try {
          ib.reqHistoricalData(
            id,
            {
              symbol: symbol.replace('.', ' '),
              secType: 'STK',
              exchange: 'SMART',
              currency: 'USD',
            },
            '',
            '3 Y',
            '1 day',
            'ADJUSTED_LAST',
            1,
            1,
            false,
          )
        } catch (error) {
          finish(id, error)
        }
      }),
    close() {
      for (const id of [...pending.keys()])
        finish(id, new Error('Scan gestopt.'))
      ib.disconnect()
    },
  }
}
