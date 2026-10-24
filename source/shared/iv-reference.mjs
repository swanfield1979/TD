import { daysToExpiry, ivRank } from './csp-scan.mjs'

export function latestIvBar(bars, today) {
  return bars.filter(bar => Number.isFinite(bar.close) && bar.close > 0 && bar.close < 10
    && daysToExpiry(bar.date, today) <= 0 && daysToExpiry(bar.date, today) >= -7)
    .sort((a, b) => b.date.replaceAll('-', '').localeCompare(a.date.replaceAll('-', '')))[0] ?? null
}
export function ivReference(current, bars, today, { completedOnly = false } = {}) {
  if (Number.isFinite(current) && current > 0 && current < 10 && ivRank(current, bars, today) !== null)
    return { value: current, source: 'quote', asOf: today }
  const last = latestIvBar(completedOnly ? bars.filter(bar => daysToExpiry(bar.date, today) < 0) : bars, today)
  if (!last || ivRank(last.close, bars, today) === null) return null
  return { value: last.close, source: 'historical-close', asOf: last.date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') }
}
