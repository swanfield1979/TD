import { describe, it, expect } from 'vitest'
import {
  filterLeaders,
  defaultBrokerPort,
  type LeaderFilters,
} from '../src/utils/leader-selection'
import type { BreakoutStock } from '../src/types/breakout'
const filters: LeaderFilters = {
  period: 0,
  top: 2,
  showAll: false,
  status: 'all',
  search: '',
  minPrice: 0,
  minDollarVolume: 0,
  exchange: '',
  sector: '',
}
const rows = Array.from(
  { length: 200 },
  (_, i) =>
    ({
      id: `S${i}`,
      symbol: `S${i}`,
      returns: [i, 200 - i, i],
      status: i === 199 ? 'breakout' : 'ready',
      close: 20,
      averageDollarVolume: 2e6,
      exchange: 'NASDAQ',
      sector: 'Tech',
    }) as BreakoutStock,
)
describe('cross-sectionele leidersselectie', () => {
  it('selecteert echte top 1/2/5-percentages over het universum', () => {
    expect(filterLeaders(rows, { ...filters, top: 1 })).toHaveLength(2)
    expect(filterLeaders(rows, filters)).toHaveLength(4)
    expect(filterLeaders(rows, { ...filters, top: 5 })).toHaveLength(10)
  })
  it('past setupfilters na topselectie toe', () => {
    expect(
      filterLeaders(rows, { ...filters, top: 1, status: 'breakout' }),
    ).toHaveLength(1)
  })
  it('selecteert per momentumvenster en kan alle leiders tonen', () => {
    expect(filterLeaders(rows, { ...filters, period: 1 })[0].symbol).toBe('S0')
    expect(filterLeaders(rows, { ...filters, top: null })).toHaveLength(200)
  })
  it('sluit stale/corporate-action-koersen uit van leiders', () => {
    expect(
      filterLeaders(
        rows.map((r) => ({ ...r, stale: true })),
        filters,
      ),
    ).toHaveLength(0)
  })
  it('ondersteunt prijs/dollarvolume/beurs/sector en zoeken', () => {
    expect(filterLeaders(rows, { ...filters, minPrice: 21 })).toHaveLength(0)
    expect(
      filterLeaders(rows, { ...filters, minDollarVolume: 3e6 }),
    ).toHaveLength(0)
    expect(filterLeaders(rows, { ...filters, exchange: 'NYSE' })).toHaveLength(
      0,
    )
    expect(filterLeaders(rows, { ...filters, sector: 'Health' })).toHaveLength(
      0,
    )
    expect(filterLeaders(rows, { ...filters, search: 's199' })).toHaveLength(1)
  })
  it('verzint geen dollarvolume bij ontbrekende metadata', () => {
    expect(
      filterLeaders(
        rows.map((r) => ({ ...r, averageDollarVolume: null })),
        { ...filters, minDollarVolume: 1 },
      ),
    ).toHaveLength(0)
  })
})
it('paperpoorten zijn standaard en TWS wordt ondersteund', () => {
  expect(defaultBrokerPort('gateway', 'paper')).toBe(4002)
  expect(defaultBrokerPort('tws', 'paper')).toBe(7497)
  expect(defaultBrokerPort('tws', 'live')).toBe(7496)
})
