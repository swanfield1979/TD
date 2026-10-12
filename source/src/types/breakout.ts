export type SetupStatus =
  | 'forming'
  | 'ready'
  | 'breakout'
  | 'failed'
  | 'insufficient_data'
export type DailyBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}
export type BreakoutStock = {
  id?: string
  symbol: string
  exchange?: string
  currency?: string
  company?: string
  sector?: string
  stale?: boolean
  corporateActionReview?: boolean
  averageDollarVolume?: number | null
  lastError?: string | null
  lastUpdatedAt?: string | null
  calculatedAt?: string
  dataMode?: string
  maSupport?: string | null
  checklist?: Record<string, boolean | null>
  asOf: string
  close: number
  sessions: number
  returns: (number | null)[]
  ranks: (number | null)[]
  score: number | null
  status: SetupStatus
  reasons: string[]
  chart: DailyBar[]
  move: { pct: number; start: string; end: string; sessions: number } | null
  base: {
    start: string
    end: string
    sessions: number
    weeks: number
    high: number
    low: number
    depthPct: number
    rangeRatio: number | null
    volatilityRatio: number | null
    higherLows: boolean | null
    orderlyLows: boolean
    tighteningRange: boolean
    distanceToHighPct: number
  } | null
  indicators: Record<string, number | boolean | null> | null
}
export type BreakoutScan = {
  state: string
  rows: BreakoutStock[]
  warnings: string[]
  progress: number
  total: number
  totalUniverse?: number
  config: Record<string, unknown>
  universe: string
  symbols: string
  source?: string
  startedAt?: string
  finishedAt?: string
  asOf?: string
  currentSymbol?: string
  message?: string
  staleSymbols?: string[]
  dataLabel?: string
  lastSuccessfulSyncAt?: string | null
  lastDataUpdateAt?: string | null
  sufficientSymbols?: number
  filters?: { minimumPrice: number; minimumAverageDollarVolume: number }
}
export type BrokerConfig = {
  application: 'gateway' | 'tws'
  mode: 'paper' | 'live'
  host: string
  port: number
  client_id: number
  delayed_data: boolean
  what_to_show: 'TRADES' | 'ADJUSTED_LAST'
}
export type BrokerStatus = {
  state: string
  message: string
  connected: boolean
  mode: string
  readOnly: boolean
  retries: number
  safetyLabel: string
}
