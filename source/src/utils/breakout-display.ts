import type { SetupStatus as Status } from '../types/breakout'
export const labels: Record<Status, string> = {
  forming: 'Basis in vorming',
  ready: 'Consolidatie gereed',
  breakout: 'Breakout actief',
  failed: 'Setup mislukt',
  insufficient_data: 'Onvoldoende data',
}
export const number = (v: number | null | undefined, digits = 2) =>
  v == null
    ? '—'
    : v.toLocaleString('nl-NL', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
export const percent = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${number(v, 1)}%`
