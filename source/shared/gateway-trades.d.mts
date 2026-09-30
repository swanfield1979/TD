import type { PortfolioSummary, IbkrLiveSnapshot, ClosedTrade, GatewayExecution } from '../src/types'
export function gatewayClosures(summary: PortfolioSummary, snapshot: IbkrLiveSnapshot): { closures: ClosedTrade[]; pending: number }
export function mergeExecutions(previous?: GatewayExecution[], incoming?: GatewayExecution[]): GatewayExecution[]
