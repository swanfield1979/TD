import type { PortfolioSummary, IbkrLiveSnapshot, ClosedTrade, GatewayExecution } from '../src/types'
export function gatewayClosures(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): { closures: ClosedTrade[]; pending: number }
export function gatewayOpenings(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): Map<string, {
  openedAt: string | null
  chosenDte: number | null
  averageOpenPrice: number | null
}>
export function mergeExecutions(previous?: GatewayExecution[], incoming?: GatewayExecution[]): GatewayExecution[]
