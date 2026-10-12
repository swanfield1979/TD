import type { BreakoutStock } from '../types/breakout'
export type LeaderFilters = {
  period: number
  top: number | null
  showAll: boolean
  status: string
  search: string
  minPrice: number
  minDollarVolume: number
  exchange: string
  sector: string
}

export function filterLeaders(rows: BreakoutStock[], f: LeaderFilters) {
  const eligible = rows
    .filter(
      (r) =>
        r.returns[f.period] !== null && !r.stale && !r.corporateActionReview,
    )
    .sort(
      (a, b) =>
        b.returns[f.period]! - a.returns[f.period]! ||
        (a.id ?? a.symbol).localeCompare(b.id ?? b.symbol),
    )
  const leaders = f.showAll
    ? rows
    : f.top === null
      ? eligible
      : eligible.slice(0, Math.ceil((eligible.length * f.top) / 100))
  return leaders.filter(
    (r) =>
      (f.status === 'all' || r.status === f.status) &&
      `${r.symbol} ${r.company ?? ''}`
        .toUpperCase()
        .includes(f.search.toUpperCase()) &&
      (r.close ?? 0) >= f.minPrice &&
      (f.minDollarVolume === 0 ||
        (r.averageDollarVolume != null &&
          r.averageDollarVolume >= f.minDollarVolume)) &&
      (!f.exchange || r.exchange === f.exchange) &&
      (!f.sector || r.sector === f.sector),
  )
}

export function defaultBrokerPort(
  application: 'gateway' | 'tws',
  mode: 'paper' | 'live',
) {
  return application === 'gateway'
    ? mode === 'paper'
      ? 4002
      : 4001
    : mode === 'paper'
      ? 7497
      : 7496
}
