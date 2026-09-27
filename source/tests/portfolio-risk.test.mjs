import test from 'node:test'
import assert from 'node:assert/strict'
import { cashSecuredPutReserve, optionStrike, portfolioAllocation } from '../shared/portfolio-risk.mjs'

test('leest een ontbrekende strike uit de compacte IBKR-contractnaam', () => {
  assert.equal(optionStrike({ strike: null, name: 'SOFI 261023P00016000' }), 16)
  assert.equal(optionStrike({ strike: 18, name: 'SOFI 261002P00018000' }), 18)
})

test('reserveert alle short puts inclusief de put-leg van een synthetische positie', () => {
  const holdings = [
    { name: 'SOFI put', optionRight: 'P', strike: 18, quantity: -2 },
    { name: 'TSLL put', optionRight: 'PUT', strike: 8.5, quantity: -5 },
    { name: 'OUST synt put', optionRight: 'P', strike: 35, quantity: -1 },
    { name: 'SOFI 261023P00016000', optionRight: 'P', strike: null, quantity: -2 },
    { name: 'OUST synt call', optionRight: 'C', strike: 35, quantity: 1 },
    { name: 'TSLL covered call', optionRight: 'C', strike: 16, quantity: -10 },
  ]

  assert.deepEqual(cashSecuredPutReserve(holdings), {
    reservedCash: 14_550,
    unpricedContractCount: 0,
  })
})

test('verplaatst CSP-reservering van cash naar opties en berekent vrij te besteden', () => {
  const allocation = portfolioAllocation({
    balance: 86_233.49,
    stockValue: 48_590.06,
    optionValue: 1_861.78,
    cashValue: 39_505.21,
    optionHoldings: [
      { name: 'SOFI', optionRight: 'P', strike: 18, quantity: -2 },
      { name: 'TSLL', optionRight: 'P', strike: 8.5, quantity: -5 },
      { name: 'TSLL', optionRight: 'P', strike: 9, quantity: -5 },
      { name: 'OUST', optionRight: 'P', strike: 35, quantity: -1 },
      { name: 'SOFI 261023P00016000', optionRight: 'P', strike: null, quantity: -2 },
    ],
    isEstimated: false,
  })

  assert.equal(allocation.reservedCash, 19_050)
  assert.equal(allocation.freeToSpend, 18_593.43)
  assert.deepEqual(allocation.categories.map(({ key, value }) => ({ key, value })), [
    { key: 'stocks', value: 48_590.06 },
    { key: 'options', value: 20_911.78 },
    { key: 'cash', value: 16_731.65 },
  ])
})

test('nettoverdeling sluit aan op NAV met short-verplichtingen, overige waarden en negatieve cash', () => {
  for (const input of [
    { balance: 86097.12, stockValue: 36203.06, optionValue: -91.42, cashValue: 49857.64 },
    { balance: 1000, stockValue: 2000, optionValue: -100, cashValue: -900 },
  ]) {
    const allocation = portfolioAllocation({ ...input, optionHoldings: [], isEstimated: false })
    assert.equal(Number(allocation.categories.reduce((sum, row) => sum + row.value, 0).toFixed(2)), input.balance)
    assert.equal(allocation.categories[1].value, input.optionValue)
  }
})
