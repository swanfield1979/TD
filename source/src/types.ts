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
  yearProfit: PortfolioMetric
  currentMonthProfit: PortfolioMetric
  previousMonthProfit: PortfolioMetric
  averageMonthlyProfit: PortfolioMetric & {
    monthCount: number
  }
  monthlyBalanceChanges: MonthlyBalanceChange[]
  tradingActivity: TradingActivitySummary
  premiumPeriods: {
    currentMonth: PremiumPeriod
    previousMonth: PremiumPeriod
  }
}
