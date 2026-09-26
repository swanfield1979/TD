import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCoveredCallCoverage } from '../shared/covered-call.mjs'

test('berekent covered-call-dekking uit uitsluitend open short calls op hetzelfde aandeel', () => {
  const stock = { symbol: 'TEST', assetCategory: 'STK', quantity: 300 }
  const complete = calculateCoveredCallCoverage(stock, [
    stock,
    { symbol: 'TEST', assetCategory: 'OPT', optionRight: 'C', quantity: -3 },
    { symbol: 'TEST', assetCategory: 'OPT', optionRight: 'P', quantity: -5 },
    { symbol: 'TEST', assetCategory: 'OPT', optionRight: 'C', quantity: 2 },
    { symbol: 'OTHER', assetCategory: 'OPT', optionRight: 'C', quantity: -4 },
  ])

  assert.deepEqual(complete, { openContracts: 3, availableContracts: 3, status: 'complete' })
  assert.equal(calculateCoveredCallCoverage(stock, [
    { symbol: 'TEST', assetCategory: 'OPT', optionRight: 'CALL', quantity: -2 },
  ]).status, 'partial')
  assert.equal(calculateCoveredCallCoverage(stock, [
    { symbol: 'TEST', assetCategory: 'OPT', optionRight: 'C', quantity: -4 },
  ]).status, 'over')
})
