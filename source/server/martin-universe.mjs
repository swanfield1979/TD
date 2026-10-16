export const US_SOURCES = [
  { name: 'Nasdaq', url: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', symbolField: 'Symbol' },
  { name: 'Overige Amerikaanse beurzen', url: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', symbolField: 'ACT Symbol' },
]
export function parseUsListings(text, source) {
  const lines = text.trim().split(/\r?\n/), fields = lines.shift().split('|')
  for (const key of [source.symbolField, 'Security Name', 'Test Issue', 'ETF']) if (!fields.includes(key)) throw Error(`Ongeldige kopregel: ${source.name}`)
  if (!lines.at(-1)?.startsWith('File Creation Time:')) throw Error(`Onvolledige beurslijst: ${source.name}`)
  const entries = []
  for (const line of lines.slice(0, -1)) {
    const parts = line.split('|'), value = key => (parts[fields.indexOf(key)] ?? '').trim()
    const original = value(source.symbolField), name = value('Security Name')
    if (value('Test Issue') !== 'N' || value('ETF') !== 'N' || value('NextShares') === 'Y') continue
    if (!/common (stock|shares)|ordinary (stock|shares)|american deposit[ao]ry|\bADS\b/i.test(name)) continue
    if (/\bwarrants?\b|\brights\b|\bunits\b|preferred (stock|shares)|preference (stock|shares)|\bnotes due\b|\bdebentures\b/i.test(name)) continue
    // Standard class shares: BRK.B / BRK B -> Yahoo BRK-B. No guessed preferred/warrant suffixes.
    if (!/^[A-Z][A-Z0-9]*(?:[. -][A-Z])?$/.test(original)) continue
    const symbol = original.replace(/[. ]/g, '-')
    entries.push({ symbol, originalSymbol: original, companyName: name, exchange: value('Exchange') || 'NASDAQ', listingSource: source.name })
  }
  if (!entries.length) throw Error(`Geen aandelen in beurslijst: ${source.name}`)
  return { entries, fileCreationTime: lines.at(-1).split('|')[0].replace('File Creation Time:', '').trim() }
}
export async function loadUsUniverse(signal, fetcher = fetch) {
  const sources = await Promise.all(US_SOURCES.map(async source => {
    const response = await fetcher(source.url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
    if (!response.ok) throw Error(`${source.name}: HTTP ${response.status}`)
    return { ...source, ...parseUsListings(await response.text(), source) }
  }))
  const entries = [...new Map(sources.flatMap(s => s.entries).map(e => [e.symbol, e])).values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
  return { kind: 'us', name: 'Amerikaanse beursnoteringen', updatedAt: new Date().toISOString(), sources: sources.map(({ entries, ...meta }) => ({ ...meta, count: entries.length })), entries }
}
