import { expect, it } from 'vitest'
import { labels, number, percent } from '../src/utils/breakout-display'

it.each([
  ['forming', 'Basis in vorming'],
  ['ready', 'Consolidatie gereed'],
  ['breakout', 'Breakout actief'],
  ['failed', 'Setup mislukt'],
  ['insufficient_data', 'Onvoldoende data'],
] as const)('toont status %s als %s', (status, expected) => {
  expect(labels[status]).toBe(expected)
})

it('toont ontbrekende koersen niet als nul of gefingeerd rendement', () => {
  expect(number(null)).toBe('—')
  expect(percent(undefined)).toBe('—')
  expect(percent(12.5)).toBe('+12,5%')
  expect(percent(-2)).toBe('-2,0%')
})
