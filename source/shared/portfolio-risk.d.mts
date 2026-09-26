import type { OptionHolding, PortfolioAllocation } from '../src/types'

export function optionStrike(position: Pick<OptionHolding, 'strike' | 'name'>): number | null

export function cashSecuredPutReserve(optionHoldings: OptionHolding[]): {
  reservedCash: number
  unpricedContractCount: number
}

export function portfolioAllocation(input: {
  balance: number
  stockValue: number
  optionValue: number
  cashValue: number
  optionHoldings: OptionHolding[]
  isEstimated: boolean
}): PortfolioAllocation
