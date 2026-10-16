// Transcript-based research filters. Thresholds not specified by Martin are configurable.
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length
const pct = (a, b) => (a / b - 1) * 100
export const defaults = Object.freeze({ adrMin: 5, premierVolume: 100e6, minDollarVolume: 10e6, top: 20, tightRatio: 0.65, gapMin: 3, premarketVolumeMin: 100000 })
export function nyTime(time) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(time).map(p => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}
export function completedBars(bars, now) {
  const today = nyTime(now)
  return bars.filter(b => b.date < today.date || (b.date === today.date && today.minutes >= 16 * 60 + 15))
}
export function analyzeMartin(input, options = {}) {
  const c = { ...defaults, ...options }, bars = [...input].sort((a, b) => a.date.localeCompare(b.date))
  if (bars.length < 60) throw new Error('Minimaal 60 afgesloten dagcandles nodig')
  const dates = new Set()
  for (const b of bars) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !Number.isFinite(Date.parse(b.date)) || dates.has(b.date) || ![b.open, b.high, b.low, b.close, b.volume].every(Number.isFinite) || b.low <= 0 || b.volume < 0 || b.high < Math.max(b.open, b.close, b.low) || b.low > Math.min(b.open, b.close)) throw new Error('Ongeldige of dubbele OHLCV-candle')
    dates.add(b.date)
  }
  const last = bars.at(-1), prior = bars.at(-2), closes = bars.map(b => b.close)
  const ema = n => closes.reduce((v, x) => v + 2 / (n + 1) * (x - v), closes[0])
  const adr = mean(bars.slice(-20).map(b => pct(b.high, b.low)))
  const dollarVolume = mean(bars.slice(-20).map(b => b.close * b.volume))
  const averages = [9, 21, 50].map(ema)
  const trend = averages[0] > averages[1] && averages[1] > averages[2] && last.close > averages[0]
  const width = xs => Math.max(...xs.map(b => b.high)) - Math.min(...xs.map(b => b.low))
  const baseWidth = width(bars.slice(-10))
  const contraction = baseWidth > 0 ? width(bars.slice(-3)) / baseWidth : null
  const insideDay = last.high <= prior.high && last.low >= prior.low
  const tight = contraction !== null && contraction <= c.tightRatio
  // A next-session reference, never an already-known intraday execution price.
  const trigger = Math.round((last.high + 0.01) * 100) / 100
  const stopReference = Math.round((last.low - 0.01) * 100) / 100
  const stopPct = (trigger - stopReference) / trigger * 100
  const maxStopPct = Math.min(5, adr / 2)
  const riskFits = stopReference > 0 && stopPct < maxStopPct
  const eligible = adr > c.adrMin && dollarVolume >= c.minDollarVolume
  const reasons = []
  if (adr <= c.adrMin) reasons.push('ADR niet boven ondergrens')
  if (dollarVolume < c.minDollarVolume) reasons.push('Dollaromzet onder ondergrens')
  if (!trend) reasons.push('Sterke EMA-trend ontbreekt')
  if (!tight && !insideDay) reasons.push('Nog geen compacte range/inside day')
  if (!riskFits) reasons.push('Stopreferentie te breed; intraday opnieuw beoordelen')
  return { date: last.date, close: last.close, dayReturn: pct(last.close, prior.close), monthReturn: pct(last.close, bars.at(-22).close), adr, dollarVolume, premier: dollarVolume > c.premierVolume, averages, trend, contraction, insideDay, tight, trigger, stopReference, stopPct, maxStopPct, riskFits, eligible, status: !eligible ? 'AFGEWEZEN' : trend && (tight || insideDay) && riskFits ? 'KLAARZETTEN' : 'VOLGEN', reasons }
}
export function premarketSignal(snapshot, row, now, options = {}) {
  const c = { ...defaults, ...options }, today = nyTime(now)
  if (!snapshot) return { status: 'ONTBREEKT' }
  const time = Date.parse(snapshot.asOf)
  if (!Number.isFinite(time) || time > now || now - time > 15 * 60000 || nyTime(time).date !== today.date || today.minutes < 240 || today.minutes >= 570 || nyTime(time).minutes < 240 || ![snapshot.price, snapshot.volume].every(Number.isFinite) || snapshot.price <= 0 || snapshot.volume < 0 || row.date >= today.date) return { status: 'ONGELDIG_OF_OUD' }
  const gap = pct(snapshot.price, row.close)
  return { status: gap >= c.gapMin && snapshot.volume >= c.premarketVolumeMin ? 'GAPPER' : 'GEEN_MATCH', gap, volume: snapshot.volume, asOf: snapshot.asOf }
}
export function makeLists(rows, options = {}) {
  const c = { ...defaults, ...options }, eligible = rows.filter(r => r.eligible)
  const strongest = key => eligible.filter(r => r[key] > 0).sort((a, b) => b[key] - a[key] || a.symbol.localeCompare(b.symbol)).slice(0, c.top)
  const potent = strongest('dayReturn'), leaders = strongest('monthReturn'), premarket = eligible.filter(r => r.premarket.status === 'GAPPER').sort((a, b) => b.premarket.gap - a.premarket.gap).slice(0, c.top)
  const candidates = new Set([...potent, ...leaders, ...premarket].map(r => r.symbol))
  const focus = eligible.filter(r => candidates.has(r.symbol) && r.status === 'KLAARZETTEN').sort((a, b) => Number(b.premier) - Number(a.premier) || b.monthReturn - a.monthReturn)
  // Count only candidates, and only explicitly supplied sector/theme metadata.
  const groups = new Map()
  for (const r of eligible.filter(r => candidates.has(r.symbol))) if (r.theme) groups.set(r.theme, [...(groups.get(r.theme) ?? []), r.symbol])
  return { potent, leaders, premarket, focus, themes: [...groups].filter(([, names]) => names.length >= 2).map(([theme, symbols]) => ({ theme, symbols })) }
}
