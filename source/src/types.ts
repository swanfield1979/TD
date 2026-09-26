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

export interface PortfolioSummary {
  generatedAt: string
  sourceUpdatedAt: string
  currency: string
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
}
