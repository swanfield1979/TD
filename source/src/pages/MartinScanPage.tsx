import { useEffect, useRef, useState } from 'react'
import './martin-scan.css'

interface MartinRow {
  symbol: string; date: string; close: number; status: string; adr: number; dollarVolume: number;
  dayReturn: number; monthReturn: number; premier: boolean; insideDay: boolean; tight: boolean;
  trigger: number; stopReference: number; stopPct: number; maxStopPct: number; reasons: string[];
  premarket: { status: string; gap?: number; volume?: number; asOf?: string }; premarketError?: string | null;
}
type List = 'focus' | 'potent' | 'leaders' | 'premarket' | 'all'
interface Report {
  generatedAt: string; analyzed: number; requested: number; rows: MartinRow[];
  lists: Record<Exclude<List, 'all'>, MartinRow[]> & { themes: { theme: string; symbols: string[] }[] };
  failures: { symbol: string; error: string }[];
}
interface Scan {
  state: string; symbols: string[]; checked: number; total: number; report: Report | null;
  message?: string; storageError?: string; showingPrevious?: boolean; restored?: boolean;
  failures?: { symbol: string; error: string }[];
}
const labels: Record<List, string> = { focus: 'Focus', potent: 'Potent · sterkste dag', leaders: 'Leaders · sterkste maand', premarket: 'Premarket', all: 'Alle aandelen' }
const number = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
const dateTime = (value: string) => new Date(value).toLocaleString('nl-NL')
const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function readResponse(response: Response): Promise<Scan> {
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw Error(data?.message || 'Martin-scan niet bereikbaar. Werk de API bij en probeer opnieuw.')
  if (typeof data.state !== 'string' || !Array.isArray(data.symbols) || !('report' in data)) throw Error('Ongeldige scannerdata. Werk de API bij en probeer opnieuw.')
  return data
}
export default function MartinScanPage() {
  const [scan, setScan] = useState<Scan | null>(null)
  const [symbols, setSymbols] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [retry, setRetry] = useState(0)
  const [list, setList] = useState<List>('focus')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: 'adr' | 'dayReturn' | 'monthReturn'; descending: boolean } | null>(null)
  const initialized = useRef(false)
  const running = scan?.state === 'running'
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const result = await readResponse(await fetch('/api/martin-scan', { cache: 'no-store', signal: controller.signal }))
        if (controller.signal.aborted) return
        setScan(result); setError('')
        if (!initialized.current) { setSymbols(result.symbols.join(', ')); initialized.current = true }
        if (result.state === 'running') timer = setTimeout(() => void load(), 1500)
      } catch (cause) {
        if (!controller.signal.aborted) { setError((cause as Error).message); timer = setTimeout(() => void load(), 5000) }
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry])
  async function start() {
    setStarting(true); setError('')
    try {
      const result = await readResponse(await fetch('/api/martin-scan', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ symbols }) }))
      setScan(result); setRetry(value => value + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { setStarting(false) }
  }
  const tickerCount = new Set(symbols.trim().toUpperCase().split(/[\s,;]+/).filter(Boolean)).size
  const invalid = !tickerCount || tickerCount > 200 || symbols.trim().split(/[\s,;]+/).some(s => !/^[A-Z0-9][A-Z0-9.^=-]{0,19}$/i.test(s))
  const report = scan?.report
  const rows = (report ? list === 'all' ? report.rows : report.lists[list] : []).filter(r => r.symbol.includes(search.trim().toUpperCase()))
  if (sort) rows.sort((a, b) => (sort.descending ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]) || a.symbol.localeCompare(b.symbol))
  const premarketCoverage = report?.rows.filter(r => ['GAPPER', 'GEEN_MATCH'].includes(r.premarket.status)).length ?? 0
  const stale = !!report && Date.now() - Date.parse(report.generatedAt) > 24 * 3600000
  function exportCsv() {
    const keys = ['symbol', 'date', 'status', 'close', 'adr', 'dollarVolume', 'dayReturn', 'monthReturn', 'trigger', 'stopReference'] as const
    download(`martin-${list}.csv`, [keys.join(','), ...rows.map(row => keys.map(key => `"${String(row[key]).replaceAll('"', '""')}"`).join(','))].join('\n'), 'text/csv;charset=utf-8')
  }
  function sortColumn(key: 'adr' | 'dayReturn' | 'monthReturn', label: string) {
    return <th scope="col" aria-sort={sort?.key === key ? sort.descending ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => setSort({ key, descending: sort?.key === key ? !sort.descending : true })}>{label}{sort?.key === key ? sort.descending ? ' ↓' : ' ↑' : ' ↕'}</button></th>
  }
  return <div className="scans-page option-research martin-scan">
    <section className="monitor-panel" aria-labelledby="martin-selection-title">
      <div className="monitor-panel__header"><div><h2 id="martin-selection-title">Aandelen selecteren volgens Martin</h2><p className="monitor-note">Sterke dag- en maandprestaties, compacte koersranges en beheersbaar stoprisico.</p></div>
        <button className="scan-button" type="button" disabled={!scan || running || starting || invalid || !!scan.storageError} onClick={() => void start()}>{running || starting ? 'Scan bezig…' : 'Scan starten'}</button></div>
      <label htmlFor="martin-symbols">Aandelen om te scannen</label>
      <textarea id="martin-symbols" value={symbols} onChange={event => setSymbols(event.target.value)} disabled={running || starting} rows={3} aria-describedby="martin-universe-help" />
      <p className="monitor-note" id="martin-universe-help">{tickerCount} aandelen · maximaal 200. Gebruik komma’s, spaties of nieuwe regels. De startlijst bevat 29 aandelen; dit is geen volledige marktscan.</p>
      {initialized.current && invalid && <p role="alert">Vul 1–200 geldige tickers in, bijvoorbeeld NVDA, AMD, IONQ.</p>}
      <ul className="scan-criteria"><li>ADR &gt; 5%</li><li>Dollaromzet ≥ $10 mln/dag</li><li>Premier &gt; $100 mln/dag</li><li>EMA9 &gt; EMA21 &gt; EMA50</li><li>Stop &lt; min(5%, ADR/2)</li></ul>
      <p className="monitor-note">Yahoo Finance-dagdata, onafhankelijk van IBKR. Premarket wordt alleen tussen 04:00 en 09:30 New York opgehaald: gap ≥ 3% en volume ≥ 100.000 aandelen. Deze drempels zijn deels ontwerpkeuzes.</p>
      <p role="status" aria-live="polite">{!scan ? 'Scanner laden…' : running ? `Scan loopt · ${scan.checked} / ${scan.total} aandelen opgehaald. Je kunt deze pagina verlaten; de scan loopt door.` : scan.state === 'idle' ? 'Klaar om te scannen.' : scan.message || 'Laatste scan geladen.'}</p>
      {running && <progress value={scan.checked} max={scan.total || 1} aria-label="Voortgang Martin-scan" />}
    </section>
    {error && <section className="state-panel state-panel--error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Opnieuw proberen</button></section>}
    {scan?.storageError && <p role="alert">{scan.storageError}</p>}
    {scan?.showingPrevious && <p role="status">Vorige resultaten blijven zichtbaar tot er nieuwe bruikbare resultaten zijn.</p>}
    {report && <section className="monitor-panel" aria-labelledby="martin-watchlist-title">
      <div className="monitor-panel__header"><h2 id="martin-watchlist-title">Watchlist</h2><div className="martin-exports"><button type="button" disabled={!rows.length} onClick={exportCsv}>CSV downloaden</button><button type="button" disabled={!rows.length} onClick={() => download(`martin-${list}-tradingview.txt`, rows.map(r => r.symbol).join(','), 'text/plain')}>TradingView downloaden</button></div></div>
      <p className="monitor-note">Scan van {dateTime(report.generatedAt)} · dekking {report.analyzed} / {report.requested} aandelen · {premarketCoverage} / {report.analyzed} bruikbare premarketquotes op het scanmoment.{scan?.restored && ' Resultaten uit serveropslag.'}{stale && ' Deze scan is ouder dan 24 uur; start opnieuw voor actuele selectie.'}</p>
      <div className="martin-filters"><label>Watchlist<select value={list} onChange={event => { setList(event.target.value as List); setSort(null) }}>{(Object.keys(labels) as List[]).map(key => <option key={key} value={key}>{labels[key]} ({key === 'all' ? report.rows.length : report.lists[key].length})</option>)}</select></label><label>Ticker zoeken<input value={search} onChange={event => setSearch(event.target.value)} /></label>{search && <button type="button" onClick={() => setSearch('')}>Zoekfilter wissen</button>}</div>
      <p className="monitor-note">{list === 'focus' ? 'Focus vereist een plaats in een kandidatenlijst én trend, compactheid en passende referentiestop.' : list === 'premarket' ? 'Dit zijn snapshots van het scanmoment. Buiten premarket of bij oude quotes ontstaat geen actueel signaal.' : list === 'all' ? 'Alle beoordeelde aandelen, inclusief afgewezen namen en ontbrekende criteria.' : 'Positieve prestaties binnen het gescande universum, gerangschikt van hoog naar laag.'} KLAARZETTEN is een kandidaat voor beoordeling; geen koopsignaal.</p>
      {!rows.length ? <p className="martin-empty" role="status">{search ? 'Geen resultaten voor deze ticker. Wis het zoekfilter.' : list === 'focus' ? 'Geen aandelen voldoen aan alle focuscriteria. Bekijk Potent, Leaders of Alle aandelen.' : 'Geen resultaten in deze watchlist. Bekijk Alle aandelen of start een nieuwe scan.'}</p> : <div className="scan-table-scroll" tabIndex={0} role="region" aria-label="Martin-watchlist"><table className="scan-table"><thead><tr><th scope="col">Aandeel</th><th scope="col">Status</th><th scope="col">Slot $</th>{sortColumn('adr', 'ADR %')}<th scope="col">$ mln/dag</th>{sortColumn('dayReturn', 'Dag %')}{sortColumn('monthReturn', 'Maand %')}<th scope="col">Gap %</th><th scope="col">Trigger $</th><th scope="col">Stop $</th><th scope="col">Beoordeling</th></tr></thead><tbody>{rows.map(row => <tr key={row.symbol}><th scope="row"><a href={`https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}/`} target="_blank" rel="noreferrer">{row.symbol}</a><small>{row.date}{row.premier ? ' · Premier' : ''}</small></th><td>{row.status}</td><td>{number(row.close)}</td><td>{number(row.adr)}</td><td>{number(row.dollarVolume / 1e6)}</td><td>{number(row.dayReturn)}</td><td>{number(row.monthReturn)}</td><td>{row.premarket.gap === undefined ? '—' : number(row.premarket.gap)}{row.premarket.asOf && <small>{dateTime(row.premarket.asOf)}</small>}</td><td>{number(row.trigger)}</td><td>{number(row.stopReference)}</td><td className="martin-reasons">{row.reasons.join('; ') || 'Dagfilters voldoen; beoordeel de grafiek.'}{row.premarketError && <small>Premarket: {row.premarketError}</small>}</td></tr>)}</tbody></table></div>}
      <p className="monitor-note">Trigger en stop zijn referenties voor de volgende sessie op basis van de laatste afgesloten dag. Controleer zelf earnings, weekbasis, marktcontext en de werkelijke intradaystop.</p>
      {!!report.lists.themes.length && <div><h3>Themaclusters</h3><ul>{report.lists.themes.map(group => <li key={group.theme}>{group.theme}: {group.symbols.join(', ')}</li>)}</ul></div>}
    </section>}
    {!!(scan?.failures?.length || report?.failures.length) && <section className="monitor-panel"><h2>Ontbrekende koersdata</h2><ul>{(scan?.failures || report?.failures || []).map(failure => <li key={failure.symbol}>{failure.symbol}: {failure.error}</li>)}</ul></section>}
  </div>
}
