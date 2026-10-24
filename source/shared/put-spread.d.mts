export interface SpreadFilters { minPrice: number; maxPrice: number; minDte: number; maxDte: number; minIvr: number; minBuffer: number; minProfit: number; maxLoss: number; minOtm: number; maxQuoteSpread: number }
export interface PutSpread { cached?: boolean; id: string; symbol: string; expiry: string; tradingClass: string; dte: number; underlyingPrice: number; ivr: number; shortStrike: number; longStrike: number; shortBid: number; shortAsk: number; longBid: number; longAsk: number; credit: number; maxProfit: number; maxLoss: number; breakEven: number; returnOnRisk: number; buffer: number; otmProxy: number; shortQuotedAt: string; longQuotedAt: string; shortDataType: number; longDataType: number }
export const spreadDefaults: Readonly<SpreadFilters>
export function spreadFilters(input?: Partial<SpreadFilters>): SpreadFilters
export function selectSpreads(puts: unknown[], today: string, input?: Partial<SpreadFilters>): PutSpread[]
