import { useEffect, useRef, useState } from 'react'
import SectorCell from './SectorCell'
import TradingViewSymbol from './TradingViewSymbol'

export interface StockSelection {
  id?: string; state: string; filters?: { minPrice: number; maxPrice: number; minVolume: number };
  universeMode?: string; symbols?: string[]; checked: number; total: number; cacheHits: number;
  rows: { symbol: string; companyName?: string; sector?: string; sectorSource?: string; sectorAsOf?: string; price: number; volume: number; asOf: string; source: string; cached?: boolean; fetchedAt: string }[];
  failures: { symbol: string; message: string; automaticallyBlocked?: boolean }[]; warnings: string[]; canResume?: boolean; finishedAt?: string; message?: string; storageError?: string;
}
const empty: StockSelection = { state: 'idle', checked: 0, total: 0, cacheHits: 0, rows: [], failures: [], warnings: [] }
const format = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
function preferences() {
  try { return JSON.parse(localStorage.getItem('tm-stock-filter') || '{}') } catch { return {} }
}
async function read(response: Response): Promise<StockSelection> {
  const data = await response.json()
  if (!response.ok) throw Error(data.message || 'Aandelenfilter niet bereikbaar.')
  if (!Array.isArray(data.rows) || !Array.isArray(data.failures)) throw Error('Ongeldige aandelenfilter; werk frontend en API samen bij.')
  return data
}
export default function StockFilterPanel({ disabled, onSelection, refresh, onRunning, onBlock }: { disabled: boolean; onSelection: (selection: StockSelection | null) => void; refresh: number; onRunning: (running: boolean) => void; onBlock: (symbol: string, blocked: boolean) => Promise<void> }) {
  const [saved] = useState(preferences)
  const hydrated = useRef(false)
  const [mode, setMode] = useState(saved.mode === 'custom' ? 'custom' : 'us')
  const [symbols, setSymbols] = useState<string>(saved.symbols || '')
  const [minPrice, setMinPrice] = useState<string>(String(saved.minPrice ?? 5))
  const [maxPrice, setMaxPrice] = useState<string>(String(saved.maxPrice ?? 150))
  const [minVolume, setMinVolume] = useState<string>(String(saved.minVolume ?? 5000000))
  const [scan, setScan] = useState<StockSelection>(empty)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const [page, setPage] = useState(0), [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('tm-stock-list-expanded') !== 'false' } catch { return true }
  })
  const running = scan.state === 'running'
  useEffect(() => { onRunning(running) }, [running, onRunning])
  const tickers = [...new Set(symbols.toUpperCase().split(/[\s,;]+/).filter(Boolean))]
  const unchanged = minPrice.trim() !== '' && maxPrice.trim() !== '' && minVolume.trim() !== '' && scan.filters?.minPrice === Number(minPrice) && scan.filters.maxPrice === Number(maxPrice) && scan.filters.minVolume === Number(minVolume) && scan.universeMode === mode && (mode !== 'custom' || JSON.stringify(scan.symbols) === JSON.stringify(tickers))
  const ready = unchanged && ['complete', 'partial'].includes(scan.state) && scan.checked === scan.total && scan.rows.length > 0 && !scan.storageError && !loading && !error
  useEffect(() => { onSelection(ready ? scan : null) }, [ready, scan, onSelection])
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const result = await read(await fetch('/api/stock-filter', { cache: 'no-store', signal: controller.signal }))
        if (controller.signal.aborted) return
        setScan(result); setLoading(false); setError('')
        if (!hydrated.current && !Object.keys(saved).length && result.filters && result.id) {
          setMinPrice(String(result.filters.minPrice)); setMaxPrice(String(result.filters.maxPrice)); setMinVolume(String(result.filters.minVolume))
          setMode(result.universeMode || 'us'); setSymbols((result.symbols || []).join(', '))
        }
        hydrated.current = true
        timer = setTimeout(() => void load(), result.state === 'running' ? 1500 : 10000)
      } catch (cause) { if (!controller.signal.aborted) { setError((cause as Error).message); setLoading(false) } }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry, refresh])
  async function start(resume = false) {
    if (![minPrice, maxPrice, minVolume].every(value => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0) || Number(maxPrice) <= 0 || Number(minPrice) > Number(maxPrice)) { setError('Vul geldige koersgrenzen en een dagvolume in.'); return }
    setBusy(true); setError('')
    try {
      const result = await read(await fetch('/api/stock-filter', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ resume, universeMode: mode, symbols: tickers, filters: { minPrice: Number(minPrice), maxPrice: Number(maxPrice), minVolume: Number(minVolume) } }) }))
      setScan(result); setPage(0); setRetry(value => value + 1)
      try { localStorage.setItem('tm-stock-filter', JSON.stringify({ mode, symbols, minPrice, maxPrice, minVolume })) } catch { /* Server selection persists independently. */ }
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  async function stop() {
    setBusy(true)
    try { setScan(await read(await fetch('/api/stock-filter/stop', { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } }))); setRetry(value => value + 1) }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const rows = scan.rows.filter(row => row.symbol.includes(search.toUpperCase().trim()))
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1))
  const status = loading ? 'Laden…' : ({ idle: 'Klaar om te filteren', running: 'Aandelenfilter bezig', complete: 'Aandelenfilter afgerond', partial: 'Afgerond met ontbrekende data', cancelled: 'Aandelenfilter gestopt', interrupted: 'Aandelenfilter onderbroken', paused: 'Aandelenfilter gepauzeerd', error: 'Aandelenfilter mislukt' }[scan.state] || scan.state)
  return <section className="monitor-panel stock-filter-panel" aria-labelledby="stock-filter-title">
    <h2 id="stock-filter-title">1. Stock Filter</h2>
    <p>Slotkoers en aandelenvolume van de laatste afgesloten handelsdag. Yahoo Finance eerst, IBKR als terugval. Geen optiedata in deze stap.</p>
    <form onSubmit={event => { event.preventDefault(); void start() }}>
      <fieldset disabled={disabled || running || busy || loading} className="stock-filter-fields"><legend>Aandelencriteria</legend>
        <label htmlFor="stock-universe">Aandelenuniversum<select id="stock-universe" aria-label="Aandelenuniversum" value={mode} onChange={event => setMode(event.target.value)}><option value="us">Alle Amerikaanse aandelen</option><option value="custom">Eigen tickers</option></select></label>
        {mode === 'custom' && <label htmlFor="stock-symbols">Tickers (maximaal 50)<textarea id="stock-symbols" value={symbols} onChange={event => setSymbols(event.target.value)} /></label>}
        <label htmlFor="stock-min-price">Minimum koers ($)<input id="stock-min-price" type="number" min="0" step="any" required value={minPrice} onChange={event => setMinPrice(event.target.value)} /></label>
        <label htmlFor="stock-max-price">Maximum koers ($)<input id="stock-max-price" type="number" min="0" step="any" required value={maxPrice} onChange={event => setMaxPrice(event.target.value)} /></label>
        <label htmlFor="stock-min-volume">Minimum dagvolume (aandelen)<input id="stock-min-volume" type="number" min="0" step="1" required value={minVolume} onChange={event => setMinVolume(event.target.value)} /></label>
      </fieldset>
      <div className="spreads-toolbar"><button className="spreads-primary" disabled={disabled || running || busy || loading} type="submit">{running ? 'Aandelenfilter bezig…' : busy ? 'Even wachten…' : 'Aandelenfilter starten'}</button>
        {!running && scan.canResume && <button type="button" disabled={disabled || busy || !unchanged} onClick={() => void start(true)}>Aandelenfilter hervatten</button>}
        {running && <button type="button" disabled={busy} onClick={() => void stop()}>Aandelenfilter stoppen</button>}
      </div>
    </form>
    <div className="spreads-status" aria-live="polite"><strong>{format(scan.checked)} / {format(scan.total)} gecontroleerd · {format(scan.rows.length)} geselecteerd</strong><span>{status}</span><span>{format(scan.cacheHits)} uit cache</span></div>
    {scan.finishedAt && <p>Opgeslagen: {new Date(scan.finishedAt).toLocaleString('nl-NL')}. {scan.filters && `Gebruikte filters: $${format(scan.filters.minPrice)}–$${format(scan.filters.maxPrice)} · dagvolume ≥ ${format(scan.filters.minVolume)} aandelen.`}</p>}
    {!running && !unchanged && scan.id && <p>Criteria gewijzigd. Start de aandelenfilter opnieuw om deze selectie bij te werken.</p>}
    {(error || scan.storageError) && <div role="alert"><p>{error || scan.storageError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Aandelenfilter opnieuw laden</button></div>}
    {scan.message && <p role="status">{scan.message}</p>}
    {!!scan.failures.length && <details><summary>{format(scan.failures.length)} aandelen zonder bruikbare data, uitgesloten</summary><ul>{scan.failures.slice(0, 50).map(item => <li key={item.symbol}>{item.symbol}: {item.message}{item.automaticallyBlocked && ' · Automatisch geblokkeerd'}</li>)}</ul></details>}
    {scan.warnings.map(warning => <p key={warning}>{warning}</p>)}
    {!!scan.rows.length && <details className="stock-results-disclosure" open={expanded} onToggle={event => {
      const open = event.currentTarget.open
      setExpanded(open)
      try { localStorage.setItem('tm-stock-list-expanded', String(open)) } catch { /* Collapse works without browser storage. */ }
    }}><summary>Geselecteerde aandelen ({format(scan.rows.length)})</summary><div className="spreads-toolbar"><label htmlFor="stock-search">Zoeken in aandelen<input id="stock-search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label></div>
      <div className="scan-table-scroll" role="region" aria-label="Geselecteerde aandelen" tabIndex={0}><table className="scan-table"><thead><tr><th>Aandeel</th><th>Sector</th><th>Slotkoers ($)</th><th>Dagvolume (aandelen)</th><th>Handelsdag</th><th>Bron</th><th>Opgehaald</th><th>Actie</th></tr></thead><tbody>{rows.slice(current * 50, current * 50 + 50).map(row => <tr key={row.symbol}><th scope="row"><TradingViewSymbol symbol={row.symbol} /></th><SectorCell value={row} /><td>{format(row.price)}</td><td>{format(row.volume)}</td><td>{row.asOf}</td><td>{row.source}{row.cached ? ' · cache' : ''}</td><td>{new Date(row.fetchedAt).toLocaleString('nl-NL')}</td><td><button disabled={disabled || running || busy} onClick={() => void onBlock(row.symbol, true).catch(cause => setError(cause.message))}>Verwijder {row.symbol}</button></td></tr>)}</tbody></table></div>
      {!rows.length && <p>Geen aandelen voor deze zoekterm.</p>}
      {rows.length > 50 && <div className="spreads-toolbar"><button disabled={!current} onClick={() => setPage(current - 1)}>Vorige aandelen</button><span>Pagina {current + 1} / {Math.ceil(rows.length / 50)}</span><button disabled={(current + 1) * 50 >= rows.length} onClick={() => setPage(current + 1)}>Volgende aandelen</button></div>}</details>}
    {scan.state === 'idle' && <p>Start de aandelenfilter om een selectie te bewaren.</p>}
    {['complete', 'partial'].includes(scan.state) && !scan.rows.length && <p>Geen passende aandelen. Pas de criteria aan en start opnieuw.</p>}
  </section>
}
