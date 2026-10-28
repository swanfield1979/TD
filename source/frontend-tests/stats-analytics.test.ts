import { describe, expect, it } from 'vitest'
import { realizedPerformance, symbolPerformance } from '../src/stats-analytics'
import type { ClosedTrade } from '../src/types'

const trade = (overrides: Partial<ClosedTrade>): ClosedTrade => ({
  id: 't', conid: '1', symbol: 'ABC', name: 'ABC', optionRight: 'P', strike: 50,
  expiry: '2026-06-30', direction: 'short', quantity: 1, openedAt: '2026-01-01',
  closedAt: '2026-02-01', daysHeld: 31, openingValue: 200, profit: 100,
  profitPercentage: 50, annualizedPercentage: null, ...overrides,
})

describe('gerealiseerde statistieken', () => {
  it('sorteert dagen, neemt sluitingen op dezelfde datum samen en meet terugval vanaf nul', () => {
    const result = realizedPerformance([
      trade({ closedAt: '2026-02-03', profit: -60 }),
      trade({ closedAt: '2026-02-02', profit: -100 }),
      trade({ closedAt: '2026-02-02', profit: 180 }),
      trade({ closedAt: '2026-02-01', profit: -20 }),
    ])
    expect(result.points.map(point => point.cumulative)).toEqual([-20, 60, 0])
    expect(result.maxDrawdown).toBe(-60)
    expect(result.total).toBe(0)
    expect(result.categories.reduce((sum, row) => sum + row.profit, 0)).toBe(0)
  })
  it('verwart ontbrekende openingswaarden en duur niet met nul en telt geen CSP/CC-dekking', () => {
    const [row] = symbolPerformance([
      trade({ daysHeld: null, profitPercentage: null, profit: -50 }),
      trade({ optionRight: 'C', daysHeld: 0, profitPercentage: 0, profit: 0 }),
      trade({ direction: 'long', daysHeld: 10, profitPercentage: 20, profit: 100, quantity: 5 }),
    ])
    expect(row).toMatchObject({ count: 3, profit: 50, measuredDays: 2, averageDays: 5, measuredReturns: 2, averageReturn: 10, shortPuts: 1, shortCalls: 1, longOptions: 1 })
    expect(row.averageProfit).toBeCloseTo(50 / 3)
    expect(row.winRate).toBeCloseTo(100 / 3)
  })
  it('bewaart verliezen, alle symbolen en onbekende optietypes in totalen', () => {
    const trades = [trade({ symbol: 'LOSS', profit: -400 }), trade({ symbol: 'WIN', profit: 150 }), trade({ symbol: 'OTHER', optionRight: null, profit: 20 })]
    expect(symbolPerformance(trades).map(row => row.symbol)).toEqual(['WIN', 'OTHER', 'LOSS'])
    const result = realizedPerformance(trades)
    expect(result.total).toBe(-230)
    expect(result.categories.reduce((sum, row) => sum + row.profit, 0)).toBe(-230)
    expect(result.maxDrawdown).toBe(-230)
  })
  it('geeft geen fictieve waarden bij ontbrekende historie of een ontbrekende verliesgroep', () => {
    expect(symbolPerformance([])).toEqual([])
    expect(realizedPerformance([])).toMatchObject({ points: [], best: null, worst: null, payoff: null, averageWin: null, averageLoss: null })
    expect(realizedPerformance([trade({})]).payoff).toBeNull()
    expect(symbolPerformance([trade({ profitPercentage: null, daysHeld: null })])[0]).toMatchObject({ averageReturn: null, averageDays: null })
  })
})
