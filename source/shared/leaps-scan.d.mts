import type { CspCandidate } from './csp-scan.mjs'
export interface LeapCandidate extends CspCandidate {
  ivPercentile: number; buffer: number; exitPrice: number;
  reference: LeapCandidate | null; qualifies: boolean; yieldAdvantage: number | null;
  vega?: number; theta?: number;
}
export function normalizeShortlist(values: unknown): string[]
export function compareLeaps(rows: LeapCandidate[], tolerance?: number): LeapCandidate[]
