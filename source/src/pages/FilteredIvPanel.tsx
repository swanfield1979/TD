import { useEffect, useRef, useState } from 'react'
import type { StockSelection } from './StockFilterPanel'

export interface FilteredIvState {
  id?: string; stockSelectionId?: string; state: string; filters?: { minIvr: number }; ready?: boolean;
  universeCount?: number; universeChecked?: number; remainingSymbols?: number; retryFrom?: number;
  rows: { symbol: string; underlyingPrice: number; ivr: number; iv: number; ivPercentile: number; quotedAt: string; ivSource?: string; ivAsOf?: string }[];
  failures?: { symbol: string; message: string }[]; warnings: string[]; finishedAt?: string; message?: string; storageError?: string;
}
const empty: FilteredIvState = { state: 'idle', rows: [], warnings: [] }
const number = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
async function read(response: Response): Promise<FilteredIvState> {
  const data = await response.json()
  if (!response.ok || !Array.isArray(data.rows)) throw Error(data.message || 'IV Scan niet bereikbaar.')
  return data
}
export default function FilteredIvPanel({ stock, disabled, refresh, onChange, onBlock }: { stock: StockSelection | null; disabled: boolean; refresh: number; onChange: (value: FilteredIvState) => void; onBlock: (symbol: string, blocked: boolean) => Promise<void> }) {
  const [scan, setScan] = useState<FilteredIvState>(empty), [minimum, setMinimum] = useState('40')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const [page, setPage] = useState(0), [search, setSearch] = useState('')
  const hydrated = useRef(false), running = scan.state === 'running'
  const ready = !loading && !error && !busy && !scan.storageError && !!scan.id && scan.stockSelectionId === stock?.id && scan.filters?.minIvr === Number(minimum) && minimum.trim() !== '' && ['complete', 'partial'].includes(scan.state) && scan.rows.length > 0
  useEffect(() => { onChange({ ...scan, ready }) }, [scan, ready, onChange])
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const result = await read(await fetch('/api/put-spreads/iv', { cache: 'no-store', signal: controller.signal }))
        if (controller.signal.aborted) return
        setScan(result); setLoading(false); setError('')
        if (!hydrated.current && result.filters) setMinimum(String(result.filters.minIvr))
        hydrated.current = true
        timer = setTimeout(() => void load(), result.state === 'running' ? 2000 : 10000)
      } catch (cause) { if (!controller.signal.aborted) { setError((cause as Error).message); setLoading(false); timer = setTimeout(() => void load(), 10000) } }
    }
    void load(); return () => { controller.abort(); clearTimeout(timer) }
  }, [retry, refresh])
  async function start(resume = false) {
    if (!stock || !minimum.trim() || !Number.isFinite(Number(minimum)) || Number(minimum) < 0 || Number(minimum) > 100) { setError('Rond eerst de Stock Filter af en vul een IV-rank van 0–100 in.'); return }
    setBusy(true); setError('')
    try {
      setScan(await read(await fetch('/api/put-spreads/iv', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ selectionId: stock.id, filters: { minIvr: Number(minimum) }, resume }) })))
      setRetry(value => value + 1)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  async function stop() {
    setBusy(true)
    try { setScan(await read(await fetch('/api/put-spreads/iv/stop', { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } }))); setRetry(value => value + 1) }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const rows = scan.rows.filter(row => row.symbol.includes(search.toUpperCase().trim()))
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1))
  return <section className="monitor-panel stock-filter-panel" aria-labelledby="filtered-iv-title">
    <h2 id="filtered-iv-title">2. IV Scan</h2>
    <p>Alleen aandelen uit de opgeslagen Stock Filter. IV en IV-jaarhistorie via IBKR; optiechains volgen pas in stap 3.</p>
    <form onSubmit={event => { event.preventDefault(); void start() }}><div className="spreads-toolbar">
      <label htmlFor="filtered-iv-min">Minimum IV-rank<input id="filtered-iv-min" type="number" min="0" max="100" required value={minimum} disabled={disabled || busy || running} onChange={event => setMinimum(event.target.value)} /></label>
      <button className="spreads-primary" type="submit" disabled={disabled || busy || running || loading || !stock}>{running ? 'IV Scan bezig…' : 'IV Scan starten'}</button>
      {!running && (!!scan.remainingSymbols || scan.retryFrom !== undefined) && <button type="button" disabled={disabled || busy || !stock || scan.stockSelectionId !== stock.id} onClick={() => void start(true)}>IV Scan hervatten</button>}
      {running && <button type="button" disabled={busy} onClick={() => void stop()}>IV Scan stoppen</button>}
    </div></form>
    {!stock && <p>Rond eerst stap 1 af met de gewenste criteria.</p>}
    <div className="spreads-status" aria-live="polite"><strong>{number(scan.universeChecked || 0)} / {number(scan.universeCount || 0)} op IV gecontroleerd · {number(scan.rows.length)} geselecteerd</strong><span>{loading ? 'Laden…' : running ? 'IV Scan bezig' : ({ idle: 'Nog geen IV Scan', complete: 'IV Scan afgerond', partial: 'IV Scan afgerond met ontbrekende data', paused: 'IV Scan gepauzeerd', cancelled: 'IV Scan gestopt', interrupted: 'IV Scan onderbroken', error: 'IV Scan mislukt' }[scan.state] || scan.state)}</span></div>
    {scan.finishedAt && <p>Opgeslagen: {new Date(scan.finishedAt).toLocaleString('nl-NL')}. Minimum IV-rank: {scan.filters?.minIvr}.</p>}
    {scan.id && stock?.id !== scan.stockSelectionId && <p>Deze IV-resultaten horen bij een eerdere Stock Filter. Start de IV Scan op de huidige selectie.</p>}
    {scan.filters && scan.filters.minIvr !== Number(minimum) && <p>IV-criterium gewijzigd. Start de IV Scan opnieuw om stap 3 te gebruiken.</p>}
    {(error || scan.storageError) && <div role="alert"><p>{error || scan.storageError}</p><button onClick={() => setRetry(value => value + 1)}>IV Scan opnieuw laden</button></div>}
    {scan.message && <p role="status">{scan.message}</p>}
    {!!scan.failures?.length && <details><summary>{scan.failures.length} aandelen zonder bruikbare IV-data</summary><ul>{scan.failures.slice(0, 50).map(row => <li key={row.symbol}>{row.symbol}: {row.message}</li>)}</ul></details>}
    {!!scan.rows.length && <><div className="spreads-toolbar"><label htmlFor="filtered-iv-search">Zoeken in IV-resultaten<input id="filtered-iv-search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label></div>
      <div className="scan-table-scroll" role="region" aria-label="IV-resultaten" tabIndex={0}><table className="scan-table"><thead><tr><th>Aandeel</th><th>Koers ($)</th><th>IV-rank</th><th>IV (%)</th><th>IV-percentile</th><th>IV-bron / datum</th><th>Actie</th></tr></thead><tbody>{rows.slice(current * 50, current * 50 + 50).map(row => <tr key={row.symbol}><th scope="row">{row.symbol}</th><td>{number(row.underlyingPrice)}</td><td>{number(row.ivr)}</td><td>{number(row.iv)}</td><td>{number(row.ivPercentile)}</td><td>{row.ivSource === 'historical-close' ? 'Dag-IV' : 'IBKR-quote'} · {row.ivAsOf || new Date(row.quotedAt).toLocaleDateString('nl-NL')}</td><td><button disabled={disabled || busy || running} onClick={() => void onBlock(row.symbol, true).catch(cause => setError(cause.message))}>Verwijder {row.symbol}</button></td></tr>)}</tbody></table></div>
      {!rows.length && <p>Geen IV-resultaten voor deze zoekterm.</p>}
      {rows.length > 50 && <div className="spreads-toolbar"><button disabled={!current} onClick={() => setPage(current - 1)}>Vorige IV-resultaten</button><span>Pagina {current + 1} / {Math.ceil(rows.length / 50)}</span><button disabled={(current + 1) * 50 >= rows.length} onClick={() => setPage(current + 1)}>Volgende IV-resultaten</button></div>}</>}
    {['complete', 'partial'].includes(scan.state) && !scan.rows.length && <p>Geen aandelen voldoen aan de IV-filter. Pas de IV-rank aan of controleer ontbrekende data.</p>}
  </section>
}
