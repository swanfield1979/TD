import type { CspCandidate } from './csp-scan.mjs'
export interface LeapCandidate extends CspCandidate {
  ivPercentile: number; buffer: number; exitPrice: number;
  decreaseToBreakEven: number; returnIfExpired: number; returnAnnualized: number;
  reference: LeapCandidate | null; qualifies: boolean; yieldAdvantage: number | null;
  vega?: number; theta?: number;
}
export function normalizeShortlist(values: unknown): string[]
export function compareLeaps(rows: LeapCandidate[], tolerance?: number): LeapCandidate[]

export function putReturnMetrics(quote: { strike: number; bid: number; underlyingPrice: number; dte: number }): { decreaseToBreakEven: number; returnIfExpired: number; returnAnnualized: number } | null
