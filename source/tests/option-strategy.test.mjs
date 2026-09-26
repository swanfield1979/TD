import assert from 'node:assert/strict'
import test from 'node:test'
import { assignOptionStrategies } from '../shared/option-strategy.mjs'

test('herkent synthetische long- en shortstrategieën per strike en expiratie', () => {
  const positions = assignOptionStrategies([
    { conid: '1', symbol: 'TEST', expiry: '2027-01-15', strike: 25, optionRight: 'C', quantity: 1 },
    { conid: '2', symbol: 'TEST', expiry: '2027-01-15', strike: 25, optionRight: 'P', quantity: -1 },
    { conid: '3', symbol: 'OTHER', expiry: '2027-01-15', strike: 40, optionRight: 'C', quantity: -2 },
    { conid: '4', symbol: 'OTHER', expiry: '2027-01-15', strike: 40, optionRight: 'P', quantity: 2 },
    { conid: '5', symbol: 'SOLO', expiry: '2027-01-15', strike: 10, optionRight: 'P', quantity: -3 },
  ])

  assert.deepEqual(positions.map((position) => position.strategy), [
    'SYNT_LONG',
    'SYNT_LONG',
    'SYNT_SHORT',
    'SYNT_SHORT',
    'SHORT_PUT',
  ])
})
