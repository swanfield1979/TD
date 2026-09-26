export type MetricDirection = 'positive' | 'negative' | 'neutral'

export interface PortfolioMetric {
  value: number
  fromDate?: string
  toDate: string
  direction: MetricDirection
}

export interface MonthlyBalanceChange {
  month: string
  label: string
  value: number | null
  balance: number | null
  fromDate?: string
  toDate?: string
  direction: MetricDirection | null
}

export interface PremiumPeriod {
  month: string
  received: number
  buyback: number
  commission: number
  net: number
}

export interface TradingActivitySummary {
  totalTrades: number
  closedTrades: number
  openTrades: number
  premiumCapturePercentage: number
  grossPremium: number
  netPremium: number
  averageDaysHeld: number
  minimumDaysHeld: number
  maximumDaysHeld: number
  measuredClosedTrades: number
}

export interface PortfolioAllocationCategory {
  key: 'stocks' | 'options' | 'cash'
  label: string
  value: number
  percentage: number
}

export interface PortfolioAllocation {
  isEstimated: boolean
  categories: PortfolioAllocationCategory[]
}

export interface StockHolding {
  conid: string
  symbol: string
  name: string
  quantity: number
  averagePurchasePrice: number
  purchaseValue: number
  currentPrice: number | null
  currentValue: number | null
  difference: number | null
  differencePercentage: number | null
  dailyChangePercentage: number | null
  coveredCallCoverage?: CoveredCallCoverage | null
}

export type OptionStrategy = 'SYNT_LONG' | 'SYNT_SHORT' | 'SHORT_CALL' | 'SHORT_PUT' | 'LONG_CALL' | 'LONG_PUT' | 'OTHER'

export interface OptionHolding {
  conid: string
  symbol: string
  name: string
  quantity: number
  optionRight: string | null
  strike: number | null
  expiry: string | null
  openedAt: string | null
  chosenDte: number | null
  averageOpenPrice: number | null
  currentPrice: number | null
  currentValue: number | null
  difference: number | null
  differencePercentage: number | null
  strategy: OptionStrategy
}

export interface GoalYear {
  year: number
  startValue: number
  growthValue: number
  contribution: number
  targetValue: number
}

export interface GoalPlan {
  baseYear: number
  baseYearEndDate: string
  baseYearEndValue: number
  annualGrowthPercentage: number
  annualContribution: number
  years: GoalYear[]
}

export interface ClosedTrade {
  id: string
  conid: string
  symbol: string
  name: string
  optionRight: string | null
  strike: number | null
  expiry: string | null
  direction: 'long' | 'short'
  quantity: number
  openedAt: string | null
  closedAt: string
  daysHeld: number | null
  openingValue: number | null
  profit: number
  profitPercentage: number | null
  annualizedPercentage: number | null
}

export type CoveredCallCoverageStatus = 'complete' | 'partial' | 'none' | 'over' | 'not_applicable'

export interface CoveredCallCoverage {
  openContracts: number
  availableContracts: number
  status: CoveredCallCoverageStatus
}

export type IbkrConnectionState = 'offline' | 'refreshing' | 'awaiting_mfa' | 'connected' | 'error'

export interface IbkrConnectionStatus {
  state: IbkrConnectionState
  message: string
  lastUpdatedAt: string | null
  isBusy: boolean
}

export interface IbkrLivePosition extends StockHolding {
  assetCategory: string
  optionRight: string | null
  optionStrike: number | null
  optionExpiry: string | null
  multiplier: number | null
  currency: string
  currentPrice: number
  currentValue: number
  difference: number
  differencePercentage: number
  previousClose: number | null
  realizedPnl: number
}

export interface IbkrLiveSnapshot {
  generatedAt: string
  asOfDate: string
  currency: string
  netLiquidation: number
  totalCashValue: number | null
  grossPositionValue: number | null
  positions: IbkrLivePosition[]
}

export interface PortfolioSummary {
  generatedAt: string
  sourceUpdatedAt: string
  currency: string
  premiumCurrency: string
  sourceCounts: {
    equityDays: number
    trades: number
    optionEvents: number
  }
  balance: PortfolioMetric
  dailyProfit: PortfolioMetric
  yearProfit: PortfolioMetric
  currentMonthProfit: PortfolioMetric
  previousMonthProfit: PortfolioMetric
  averageMonthlyProfit: PortfolioMetric & {
    monthCount: number
  }
  monthlyBalanceChanges: MonthlyBalanceChange[]
  previousYearMonthlyBalanceChanges: MonthlyBalanceChange[]
  tradingActivity: TradingActivitySummary
  portfolioAllocation: PortfolioAllocation
  stockHoldings: StockHolding[]
  optionHoldings: OptionHolding[]
  goalPlan: GoalPlan | null
  closedTrades: ClosedTrade[]
  premiumPeriods: {
    currentMonth: PremiumPeriod
    previousMonth: PremiumPeriod
  }
}
