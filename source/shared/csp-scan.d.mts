export interface CspCandidate {
  id: string; symbol: string; expiry: string; strike: number; underlyingPrice: number;
  delta: number; absoluteDelta: number; ivr: number; bid: number; ask: number; multiplier: number;
  right: string; currency: string; dte: number; pop: number; premium: number; collateral: number;
  yieldPercentage: number; annualizedYield: number; breakEven: number; marketDataType: number;
  quotedAt: string; universe?: string;
}
export function sortCandidates(rows: CspCandidate[], sort?: 'annualizedYield' | 'premium' | 'yieldPercentage'): CspCandidate[]
export function matchingCandidates(rows: CspCandidate[], today?: string, discovery?: boolean): CspCandidate[]
