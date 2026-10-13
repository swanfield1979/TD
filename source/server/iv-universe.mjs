export const SP500_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'
export const NASDAQ_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt'
const ticker = value => /^[A-Z][A-Z0-9. -]{0,19}$/.test(value)
export function parseSp500(text) {
  const lines = text.trim().split(/\r?\n/)
  if (!/^Symbol,/.test(lines[0])) throw new Error('Ongeldige S&P 500-kopregel.')
  return [...new Set(lines.slice(1).map(line => line.split(',')[0].trim().replaceAll('.', ' ')).filter(ticker))]
}
export function parseNasdaq(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const fields = header.split('|')
  for (const key of ['Symbol','Security Name','Test Issue','ETF']) if (!fields.includes(key)) throw new Error('Ongeldige Nasdaq-kopregel.')
  const value = (parts,key) => parts[fields.indexOf(key)] ?? ''
  return [...new Set(lines.flatMap(line => {
    const parts = line.split('|'), symbol = value(parts,'Symbol'), name = value(parts,'Security Name')
    if (!ticker(symbol) || value(parts,'Test Issue') !== 'N' || value(parts,'ETF') !== 'N'
      || !/common|ordinary|american depositary|american depository|\bADS\b/i.test(name)
      || /\bwarrants?\b|\bunits?\b|\brights?\b|\bpreferred\b|\bnotes\b/i.test(name)) return []
    return [symbol]
  }))]
}
export function combineUniverse(sp500, nasdaq) {
  const members = new Set(sp500), listings = new Set(nasdaq)
  // Index constituents first; the other Nasdaq stocks follow alphabetically.
  return [...sp500].sort().concat(nasdaq.filter(symbol => !members.has(symbol)).sort()).map(symbol => ({
    symbol, universe: members.has(symbol) ? (listings.has(symbol) ? 'NASDAQ · S&P 500' : 'S&P 500') : 'NASDAQ',
  }))
}
export async function loadIvUniverse(signal) {
  const sources = await Promise.allSettled([SP500_URL,NASDAQ_URL].map(async url => {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const values = url === SP500_URL ? parseSp500(await response.text()) : parseNasdaq(await response.text())
    if (values.length < (url === SP500_URL ? 400 : 500)) throw new Error('Onvolledige aandelenlijst.')
    return values
  }))
  signal?.throwIfAborted()
  const warnings = sources.flatMap((result,index) => result.status === 'rejected' ? [`${index === 0 ? 'S&P 500' : 'Nasdaq'}-aandelenlijst niet beschikbaar: ${result.reason.message}`] : [])
  const lists = sources.map(result => result.status === 'fulfilled' ? result.value : [])
  if (!lists.some(list => list.length)) throw new Error('Geen aandelenlijst beschikbaar; controleer internettoegang op de server en probeer opnieuw.')
  return { entries: combineUniverse(...lists), warnings, updatedAt: new Date().toISOString() }
}
