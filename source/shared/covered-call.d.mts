export type CoveredCallCoverageStatus = 'complete' | 'partial' | 'none' | 'over' | 'not_applicable'

export interface CoveredCallCoverage {
  openContracts: number
  availableContracts: number
  status: CoveredCallCoverageStatus
}

interface CoveragePosition {
  symbol: string
  quantity: number
  assetCategory?: string
  optionRight?: string | null
}

export function calculateCoveredCallCoverage(
  stockPosition: CoveragePosition,
  positions: CoveragePosition[],
): CoveredCallCoverage
