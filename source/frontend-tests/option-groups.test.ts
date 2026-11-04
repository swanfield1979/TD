import { describe, expect, it } from 'vitest'
import { groupOptionHoldings, openingWeek } from '../src/option-groups'
import type { OptionHolding } from '../src/types'

const leg = (conid: string, overrides: Partial<OptionHolding> = {}): OptionHolding => ({
  conid, symbol: 'SMCI', name: conid, quantity: -1, optionRight: 'P', strike: 25,
  expiry: '2027-01-15', openedAt: '2026-10-26', chosenDte: 81,
  averageOpenPrice: 1.21, currentPrice: .92, currentValue: -92,
  difference: 28.98, differencePercentage: 24, strategy: 'SHORT_PUT', ...overrides,
})

describe('optiecombinaties en openingsweek', () => {
  it('groepeert de SMCI-putspread met netto premie en gecombineerde waarden', () => {
    const holdings = [leg('short'), leg('long', { quantity: 1, strike: 20, averageOpenPrice: .43, currentPrice: .31, currentValue: 31.32, difference: -11.73, strategy: 'LONG_PUT' })]
    const copy = structuredClone(holdings)
    const rows = groupOptionHoldings(holdings)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'group', strategy: 'PUT_SPREAD', quantity: 1 })
    if (rows[0].kind !== 'group') throw Error('Expected group')
    expect(rows[0].averageOpenPrice).toBeCloseTo(.78)
    expect(rows[0].currentPrice).toBeCloseTo(.61)
    expect(rows[0].difference).toBeCloseTo(17.25)
    expect(rows[0].currentValue).toBeCloseTo(-60.68)
    expect(holdings).toEqual(copy)
  })
  it('splitst ongelijke aantallen zonder contracten, resultaat of marktwaarde te verliezen', () => {
    const holdings = [leg('short', { quantity: -3, currentValue: -300, difference: 90 }), leg('long', { quantity: 1, strike: 20, currentValue: 40, difference: -5 })]
    const rows = groupOptionHoldings(holdings)
    const parts = rows.flatMap(row => row.kind === 'single' ? [row.holding] : row.legs)
    expect(parts.reduce((sum, row) => sum + Math.abs(row.quantity), 0)).toBe(4)
    expect(parts.reduce((sum, row) => sum + row.currentValue!, 0)).toBeCloseTo(-260)
    expect(parts.reduce((sum, row) => sum + row.difference!, 0)).toBeCloseTo(85)
    expect(rows.find(row => row.kind === 'single')).toMatchObject({ holding: { quantity: -2, strategy: 'SHORT_PUT', currentValue: -200, difference: 60 } })
  })
  it('geeft SYNT voorrang op putspreads en hergebruikt geen benen', () => {
    const rows = groupOptionHoldings([
      leg('call', { quantity: 2, optionRight: 'CALL', strategy: 'SYNT_LONG' }),
      leg('put', { quantity: -2, strategy: 'SYNT_LONG' }),
      leg('hedge', { quantity: 1, strike: 20, strategy: 'LONG_PUT' }),
    ])
    expect(rows.filter(row => row.kind === 'group')).toHaveLength(1)
    expect(rows.find(row => row.kind === 'group')).toMatchObject({ strategy: 'SYNT_LONG', quantity: 2 })
    expect(rows.find(row => row.kind === 'single')).toMatchObject({ holding: { conid: 'hedge', quantity: 1 } })
  })
  it('herkent SYNT short en debet-putspreads zonder koersdata te verzinnen', () => {
    const synthetic = groupOptionHoldings([leg('sc', { optionRight: 'C' }), leg('lp', { quantity: 1 })])
    expect(synthetic[0]).toMatchObject({ kind: 'group', strategy: 'SYNT_SHORT' })
    const spread = groupOptionHoldings([leg('sp', { strike: 20, averageOpenPrice: 1 }), leg('lp', { strike: 25, quantity: 1, averageOpenPrice: 3, currentPrice: null, difference: null })])
    expect(spread[0]).toMatchObject({ kind: 'group', strategy: 'PUT_SPREAD', averageOpenPrice: -2, currentPrice: null, difference: null })
  })
  it('combineert geen verschillende expiraties, symbolen, gelijke putstrikes of onbekende strikes', () => {
    for (const overrides of [{ expiry: '2027-02-19' }, { symbol: 'OTHER' }, { strike: 25 }, { strike: null }]) {
      expect(groupOptionHoldings([leg('short'), leg('long', { quantity: 1, strike: 20, ...overrides })]).every(row => row.kind === 'single')).toBe(true)
    }
  })
  it('matcht dezelfde openingsdatum eerst en blijft deterministisch bij andere invoervolgorde', () => {
    const holdings = [leg('short'), leg('old-long', { quantity: 1, strike: 24, openedAt: '2026-10-20' }), leg('new-long', { quantity: 1, strike: 20 })]
    const rows = groupOptionHoldings(holdings)
    const group = rows.find(row => row.kind === 'group')
    expect(group?.kind === 'group' && group.legs.map(row => row.conid)).toEqual(['short', 'new-long'])
    expect(groupOptionHoldings([...holdings].reverse())).toEqual(rows)
  })
  it('gebruikt ISO-weken op maandag en rond de jaarwisseling', () => {
    expect(openingWeek('2026-10-26')).toBe(44)
    expect(openingWeek('2026-10-25')).toBe(43)
    expect(openingWeek('2021-01-01')).toBe(53)
    expect(openingWeek('2024-12-30')).toBe(1)
    expect(openingWeek('invalid')).toBeNull()
  })
  const spcx = (sets = 1, calls = 1) => [
    leg('spcx-long', { symbol: 'SPCX', quantity: sets, optionRight: 'C', strike: 140, expiry: '2027-03-19', openedAt: '2026-10-09', chosenDte: 161, averageOpenPrice: 30, currentPrice: 8, currentValue: 800 * sets, difference: -2200 * sets }),
    leg('spcx-put', { symbol: 'SPCX', quantity: -sets, strike: 140, expiry: '2027-03-19', openedAt: '2026-10-09', chosenDte: 161, averageOpenPrice: 3.01, currentPrice: 11.65, currentValue: -1164.77 * sets, difference: -863.87 * sets }),
    leg('spcx-cover', { symbol: 'SPCX', quantity: -calls, optionRight: 'CALL', strike: 180, expiry: '2027-03-19', openedAt: '2026-11-04', chosenDte: 135, averageOpenPrice: 5.27, currentPrice: 5.27, currentValue: -527.19 * calls, difference: -.23 * calls }),
  ]
  it('groepeert de SPCX-call 180 met de SYNT long 140, inclusief alle netto waarden', () => {
    const holdings = spcx(), copy = structuredClone(holdings)
    const rows = groupOptionHoldings(holdings)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ strategy: 'SYNT_LONG', quantity: 1 })
    if (rows[0].kind !== 'group') throw Error('Expected group')
    expect(rows[0].legs.map(leg => leg.conid)).toEqual(['spcx-long', 'spcx-put', 'spcx-cover'])
    expect(rows[0].averageOpenPrice).toBeCloseTo(-21.72)
    expect(rows[0].currentPrice).toBeCloseTo(8.92)
    expect(rows[0].currentValue).toBeCloseTo(-891.96)
    expect(rows[0].difference).toBeCloseTo(-3064.10)
    expect(holdings).toEqual(copy)
    expect(groupOptionHoldings([...holdings].reverse())).toEqual(rows)
  })
  it('behoudt resterende synthetische sets en overtollige short calls met hun waarden', () => {
    for (const holdings of [spcx(3, 1), spcx(1, 3)]) {
      const rows = groupOptionHoldings(holdings)
      expect(rows).toHaveLength(2)
      const parts = rows.flatMap(row => row.kind === 'group' ? row.legs : [row.holding])
      for (const holding of holdings) {
        const assigned = parts.filter(part => part.conid === holding.conid)
        expect(assigned.reduce((sum, part) => sum + part.quantity, 0)).toBe(holding.quantity)
        for (const field of ['currentValue', 'difference'] as const)
          expect(assigned.reduce((sum, part) => sum + part[field]!, 0)).toBeCloseTo(holding[field]!)
      }
    }
  })
  it('koppelt geen ongeschikte calls en behoudt ontbrekende koersen', () => {
    for (const overrides of [{ expiry: '2027-04-16' }, { symbol: 'OTHER' }, { strike: 130 }, { strike: null }, { quantity: 1 }]) {
      const holdings = spcx()
      Object.assign(holdings[2], overrides)
      expect(groupOptionHoldings(holdings)).toHaveLength(2)
    }
    const holdings = spcx()
    Object.assign(holdings[2], { currentPrice: null, currentValue: null, difference: null })
    expect(groupOptionHoldings(holdings)[0]).toMatchObject({ currentPrice: null, currentValue: null, difference: null })
  })
})
