import type { OptionHolding, OptionStrategy } from './types'

export type OptionGroupStrategy = 'PUT_SPREAD' | 'SYNT_LONG' | 'SYNT_SHORT'
export type OptionDisplayRow = { id: string; kind: 'single'; holding: OptionHolding } | {
  id: string; kind: 'group'; strategy: OptionGroupStrategy; symbol: string; expiry: string;
  quantity: number; legs: [OptionHolding, OptionHolding];
  averageOpenPrice: number | null; currentPrice: number | null; currentValue: number | null; difference: number | null;
}
const right = (holding: OptionHolding) => ({ CALL: 'C', PUT: 'P' }[holding.optionRight ?? ''] ?? holding.optionRight)
const standaloneStrategy = (holding: OptionHolding): OptionStrategy => right(holding) === 'P'
  ? holding.quantity < 0 ? 'SHORT_PUT' : 'LONG_PUT'
  : right(holding) === 'C' ? holding.quantity < 0 ? 'SHORT_CALL' : 'LONG_CALL' : 'OTHER'

/** ISO-8601 week, calculated in UTC so local timezone/DST cannot shift the date. */
export function openingWeek(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function part(holding: OptionHolding, quantity: number): OptionHolding {
  const ratio = quantity / Math.abs(holding.quantity)
  return {
    ...holding, quantity: Math.sign(holding.quantity) * quantity, strategy: standaloneStrategy(holding),
    currentValue: holding.currentValue === null ? null : holding.currentValue * ratio,
    difference: holding.difference === null ? null : holding.difference * ratio,
  }
}

export function groupOptionHoldings(holdings: OptionHolding[]): OptionDisplayRow[] {
  // Work on a copy; quantities and valuations in the source data remain unchanged.
  const available = holdings.map(holding => ({ holding, remaining: Math.abs(holding.quantity) }))
    .sort((a, b) => a.holding.conid.localeCompare(b.holding.conid))
  const rows: OptionDisplayRow[] = []
  const comparable = (a: OptionHolding, b: OptionHolding) => a.symbol.toUpperCase() === b.symbol.toUpperCase()
    && !!a.expiry && a.expiry === b.expiry && a.strike !== null && b.strike !== null
    && Number.isFinite(a.strike) && Number.isFinite(b.strike)
  const combine = (strategy: OptionGroupStrategy, accepts: (a: OptionHolding, b: OptionHolding) => boolean) => {
    for (const a of available) {
      while (a.remaining > 0) {
        const candidates = available.filter(b => b !== a && b.remaining > 0 && comparable(a.holding, b.holding) && accepts(a.holding, b.holding))
          .sort((b, c) => {
            const sameDateB = !!a.holding.openedAt && a.holding.openedAt === b.holding.openedAt
            const sameDateC = !!a.holding.openedAt && a.holding.openedAt === c.holding.openedAt
            return Number(sameDateC) - Number(sameDateB)
              || Math.abs(a.holding.strike! - b.holding.strike!) - Math.abs(a.holding.strike! - c.holding.strike!)
              || b.holding.conid.localeCompare(c.holding.conid)
          })
        const b = candidates[0]
        if (!b) break
        const quantity = Math.min(a.remaining, b.remaining)
        const legs: [OptionHolding, OptionHolding] = [part(a.holding, quantity), part(b.holding, quantity)]
        const netPrice = (field: 'averageOpenPrice' | 'currentPrice') => legs.some(leg => leg[field] === null)
          ? null : legs.reduce((sum, leg) => sum - Math.sign(leg.quantity) * leg[field]!, 0)
        const total = (field: 'currentValue' | 'difference') => legs.some(leg => leg[field] === null)
          ? null : legs.reduce((sum, leg) => sum + leg[field]!, 0)
        rows.push({ id: `${strategy}-${a.holding.conid}-${b.holding.conid}`, kind: 'group', strategy,
          symbol: a.holding.symbol, expiry: a.holding.expiry!, quantity, legs,
          averageOpenPrice: netPrice('averageOpenPrice'), currentPrice: netPrice('currentPrice'),
          currentValue: total('currentValue'), difference: total('difference') })
        a.remaining -= quantity; b.remaining -= quantity
      }
    }
  }
  // Synthetic exposure takes precedence over vertical puts; never reuse matched contracts.
  combine('SYNT_LONG', (a, b) => right(a) === 'C' && a.quantity > 0 && right(b) === 'P' && b.quantity < 0 && a.strike === b.strike)
  combine('SYNT_SHORT', (a, b) => right(a) === 'C' && a.quantity < 0 && right(b) === 'P' && b.quantity > 0 && a.strike === b.strike)
  combine('PUT_SPREAD', (a, b) => right(a) === 'P' && a.quantity < 0 && right(b) === 'P' && b.quantity > 0 && a.strike !== b.strike)
  for (const entry of available) if (entry.remaining > 0) rows.push({ id: `single-${entry.holding.conid}`, kind: 'single', holding: part(entry.holding, entry.remaining) })
  const sortKey = (row: OptionDisplayRow) => row.kind === 'group'
    ? `${row.expiry}-${row.symbol}-${Math.min(...row.legs.map(leg => leg.strike!))}`
    : `${row.holding.expiry || '9999'}-${row.holding.symbol}-${row.holding.strike ?? ''}`
  return rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.id.localeCompare(b.id))
}
