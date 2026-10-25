import { stockKey } from './blocked-stocks.mjs'

// Only instrument-specific missing data is a reason to block a stock. A broker
// outage, permissions failure or pacing limit must not block the whole universe.
export function shouldAutoBlock(failure) {
  const message = String(failure.message || failure.reason || '')
  if ([354, 10089, 10090, 10167, 10168, 1100, 1101, 1102].includes(failure.ibCode)) return false
  if (/niet bereikbaar|niet verbonden|connection|disconnect|verbindings|socket|ECONN|ENOTFOUND|EAI_AGAIN|time.?out|verlopen|pacing|snelheidslimiet|IBKR-pauze|permissions?|not subscribed|subscription|geen (?:markt)?datarechten|HTTP (?:401|403|429|5\d\d)|fetch failed|network|gestopt|aborted/i.test(message)) return false
  if (failure.code === 'VOLUME_UNAVAILABLE') return false
  return failure.code === 'IV_UNAVAILABLE'
    || /HMDS query returned no data|geen bruikbare IV|geen volledige IV-jaarhistorie|geen recente volledige slotkoers en dagvolume|geen ondersteund USD-aandeel|Yahoo HTTP 404|no security definition|geen eenduidig USD-aandelencontract/i.test(message)
}
export async function autoBlockStock(store, failure) {
  if (!shouldAutoBlock(failure)) return false
  await store.update(failure.symbol, true, { automatic: true, stage: failure.stage, reason: String(failure.message || failure.reason || 'Geen bruikbare data.').slice(0, 1500), observedAt: failure.observedAt || new Date().toISOString() })
  return store.has(failure.symbol)
}
export async function reconcileMissingStocks(store, scans) {
  for (const [stage, scan] of Object.entries(scans)) {
    for (const failure of [...(scan.failures || []), ...(scan.assessments || []).filter(row => row.status === 'missing')]) {
      if (scan.rows?.some(row => stockKey(row.symbol) === stockKey(failure.symbol))) continue
      const message = stage === 'stock' ? String(failure.message || '').split(' · IBKR:')[0] : failure.message || failure.reason
      if (await autoBlockStock(store, { ...failure, message, stage, observedAt: failure.observedAt || scan.finishedAt || scan.startedAt || '1970-01-01T00:00:00Z' })) failure.automaticallyBlocked = true
    }
  }
}
