import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownloadRegular, ArrowLeftRegular, SearchRegular, PlayRegular, StopRegular } from '@fluentui/react-icons'
import { spreadDefaults, spreadFilters } from '../../shared/put-spread.mjs'
import type { PutSpread, SpreadFilters } from '../../shared/put-spread.mjs'
import './put-spreads.css'
import StockFilterPanel from './StockFilterPanel'
import type { StockSelection } from './StockFilterPanel'
import FilteredIvPanel from './FilteredIvPanel'
import type { FilteredIvState } from './FilteredIvPanel'
import SpreadScanManagement from './SpreadScanManagement'
import SectorCell from './SectorCell'
import TradingViewSymbol from './TradingViewSymbol'

interface Scan {
  state: string; rows: PutSpread[]; warnings: string[]; symbolsChecked: number; contractsChecked: number;
  symbols?: string[]; filters?: SpreadFilters; progress?: string; message?: string; finishedAt?: string;
  retryFrom?: number; phase?: string; nextBatchAt?: string;
  universeMode?: 'us' | 'custom'; universeCount?: number; universeChecked?: number; remainingSymbols?: number; universeUpdatedAt?: string; cacheHits?: number; chainsSkipped?: number; marketOpen?: boolean;
  assessments?: { symbol: string; status: string; reason: string; source: string; asOf?: string; ivSource?: string; ivAsOf?: string; avgOptionVolume?: number; avgOptionVolumeAt?: string; dayOptionVolume?: number; dayOptionVolumeAt?: string }[];
  coverage?: string; storageError?: string; restoredFromDisk?: boolean; showingPreviousResults?: boolean;
}
const empty: Scan = { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
const number = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
const usd = (value: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'USD' }).format(value)
const date = (value: string) => value.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3-$2-$1')
const time = (value: string) => value ? new Date(value).toLocaleString('nl-NL') : 'Tijd onbekend'
const dataType = (value: number) => ({ 1: 'Live', 2: 'Bevroren', 3: 'Vertraagd', 4: 'Vertraagd / bevroren' }[value] || 'Onbekend')
const fields: { key: keyof SpreadFilters; label: string; step?: string }[] = [
  { key: 'minAvgOptionVolume', label: 'Min. gemiddeld optievolume' },
  { key: 'minPrice', label: 'Minimum koers ($)', step: 'any' }, { key: 'maxPrice', label: 'Maximum koers ($)', step: 'any' },
  { key: 'minIvr', label: 'Minimum IV-rank' }, { key: 'minDte', label: 'Minimum DTE (dagen)' },
  { key: 'maxDte', label: 'Maximum DTE (dagen)' }, { key: 'minBuffer', label: 'Minimum koersbuffer (%)', step: 'any' },
  { key: 'minProfit', label: 'Minimum max. winst ($)', step: 'any' }, { key: 'maxLoss', label: 'Maximum verlies ($)', step: 'any' },
  { key: 'minOtm', label: 'Minimum OTM-proxy (%)', step: 'any' }, { key: 'maxQuoteSpread', label: 'Max. bied-laat per put ($)', step: 'any' },
]
function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem('tm-put-spread-filters') || '{}')
    return { universeMode: saved.universeMode === 'custom' ? 'custom' as const : 'us' as const, symbols: typeof saved.symbols === 'string' ? saved.symbols : '', filters: spreadFilters(saved.filters || {}) }
  } catch { return { universeMode: 'us' as const, symbols: '', filters: { ...spreadDefaults } } }
}
async function responseData(response: Response): Promise<Scan> {
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw Error(data?.message || `Spreadscanner niet bereikbaar (HTTP ${response.status}). Werk frontend en API samen bij.`)
  if (!Array.isArray(data.rows) || !Array.isArray(data.warnings) || typeof data.state !== 'string') throw Error('Ongeldig scanresultaat; werk de API bij.')
  return data
}
function exportRows(rows: PutSpread[]) {
  const keys: (keyof PutSpread)[] = ['avgOptionVolume', 'avgOptionVolumeAt', 'dayOptionVolume', 'dayOptionVolumeAt', 'volumeSource', 'ivSource', 'ivAsOf', 'cached', 'symbol', 'sector', 'sectorSource', 'sectorAsOf', 'expiry', 'dte', 'underlyingPrice', 'ivr', 'shortStrike', 'longStrike', 'shortBid', 'shortAsk', 'longBid', 'longAsk', 'credit', 'maxProfit', 'maxLoss', 'breakEven', 'returnOnRisk', 'buffer', 'otmProxy', 'shortQuotedAt', 'longQuotedAt', 'shortDataType', 'longDataType']
  const csv = [keys.join(';'), ...rows.map(row => keys.map(key => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bull-put-spreads.csv'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function PutSpreadPage() {
  const [preferences] = useState(loadPreferences)
  const [selection, setSelection] = useState<StockSelection | null>(null)
  const [ivScan, setIvScan] = useState<FilteredIvState>({ state: 'idle', rows: [], warnings: [] })
  const [stockRunning, setStockRunning] = useState(false), [scheduleRunning, setScheduleRunning] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [filters, setFilters] = useState<Record<keyof SpreadFilters, string>>(() => Object.fromEntries(Object.entries(preferences.filters).map(([key, value]) => [key, String(value)])) as Record<keyof SpreadFilters, string>)
  const [scan, setScan] = useState<Scan>(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'returnOnRisk' | 'maxProfit' | 'maxLoss' | 'ivr'>('returnOnRisk')
  const [descending, setDescending] = useState(true)
  const [page, setPage] = useState(0)
  const [detailPage, setDetailPage] = useState(0)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const overviewButtons = useRef(new Map<string, HTMLButtonElement>())
  const returnToSymbol = useRef<string | null>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (selectedSymbol) detailHeading.current?.focus()
    else if (returnToSymbol.current) {
      const trigger = overviewButtons.current.get(returnToSymbol.current)
      if (trigger) trigger.focus()
      else detailHeading.current?.focus()
      returnToSymbol.current = null
    }
  }, [selectedSymbol])
  const running = scan.state === 'running'
  const otherRunning = stockRunning || ivScan.state === 'running' || scheduleRunning
  const blocked = running || otherRunning || busy
  const blockStock = useCallback(async (symbol: string, value: boolean) => {
    setBusy(true)
    try {
      const response = await fetch('/api/put-spreads/blocked', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ symbol, blocked: value }) }), data = await response.json()
      if (!response.ok) throw Error(data.message || 'Blokkeerlijst kon niet worden opgeslagen.')
      setRefresh(current => current + 1)
    } finally { setBusy(false) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const result = await responseData(await fetch('/api/put-spreads', { signal: controller.signal, cache: 'no-store' }))
        if (controller.signal.aborted) return
        setScan(result); setError(''); setLoading(false)
        timer = setTimeout(() => void load(), result.state === 'running' ? 3000 : 10000)
      } catch (cause) {
        if (!controller.signal.aborted) { setError((cause as Error).message); setLoading(false); timer = setTimeout(() => void load(), 8000) }
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry, refresh])

  async function start(resume = false) {
    setError('')
    let parsed: SpreadFilters
    try {
      if (Object.values(filters).some(value => !value.trim())) throw Error('Vul alle filters in.')
      if (!resume && !selection) throw Error('Rond eerst stap 1 af met de gewenste aandelencriteria.')
      if (!resume && !ivScan.ready) throw Error('Rond eerst stap 2 af op de huidige Stock Filter.')
      parsed = spreadFilters({ ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, Number(value)])), minPrice: resume ? scan.filters?.minPrice : selection!.filters!.minPrice, maxPrice: resume ? scan.filters?.maxPrice : selection!.filters!.maxPrice, minIvr: resume ? scan.filters?.minIvr : ivScan.filters!.minIvr })
    } catch (cause) { setError((cause as Error).message); return }
    setBusy(true)
    try {
      const result = await responseData(await fetch('/api/put-spreads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ universeMode: resume ? scan.universeMode : selection!.universeMode, resume, symbols: resume ? scan.symbols : selection!.symbols, selectionId: selection?.id, ivSelectionId: ivScan.id, filters: parsed }) }))
      setScan(result); setRetry(value => value + 1)
      try { localStorage.setItem('tm-put-spread-filters', JSON.stringify({ filters: parsed })) } catch { /* Scanner works without browser storage. */ }
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  async function stop() {
    setBusy(true); setError('')
    try { setScan(await responseData(await fetch('/api/put-spreads/stop', { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } }))); setRetry(value => value + 1) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  const compare = (a: PutSpread, b: PutSpread) => (descending ? b[sort] - a[sort] : a[sort] - b[sort]) || b.returnOnRisk - a.returnOnRisk || a.id.localeCompare(b.id)
  const groups = new Map<string, PutSpread[]>()
  for (const row of scan.rows) {
    if (!groups.has(row.symbol)) groups.set(row.symbol, [])
    groups.get(row.symbol)!.push(row)
  }
  // Select the strongest representative before applying the overview's display direction.
  const best = (a: PutSpread, b: PutSpread) => (sort === 'maxLoss' ? a.maxLoss - b.maxLoss : b[sort] - a[sort]) || b.returnOnRisk - a.returnOnRisk || b.maxProfit - a.maxProfit || a.maxLoss - b.maxLoss || a.id.localeCompare(b.id)
  const allRows = scan.rows.filter(row => row.symbol.includes(search.toUpperCase().trim())).sort(compare)
  const overviewRows = [...groups.values()].map(group => group.reduce((winner, row) => best(row, winner) < 0 ? row : winner)).filter(row => row.symbol.includes(search.toUpperCase().trim())).sort(compare)
  const rows = selectedSymbol
    ? [...(groups.get(selectedSymbol) ?? [])].sort(compare)
    : overviewRows
  const exportableRows = selectedSymbol ? rows : allRows
  const pageCount = Math.max(1, Math.ceil(rows.length / 50))
  const currentPage = Math.min(selectedSymbol ? detailPage : page, pageCount - 1)
  const changePage = selectedSymbol ? setDetailPage : setPage
  const pageRows = rows.slice(currentPage * 50, currentPage * 50 + 50)
  const status = loading ? 'Laden…' : running ? 'Scan bezig' : scan.state === 'idle' ? 'Klaar om te scannen' : scan.state === 'paused' ? 'Scan gepauzeerd' : scan.state === 'cancelled' ? 'Scan gestopt' : scan.state === 'interrupted' ? 'Scan onderbroken' : scan.state === 'error' ? 'Scan gestopt' : 'Scan afgerond'
  return <div className="spreads-page">
    <StockFilterPanel disabled={running || busy || ivScan.state === 'running' || scheduleRunning} onSelection={setSelection} refresh={refresh} onRunning={setStockRunning} onBlock={blockStock} />
    <FilteredIvPanel stock={selection} disabled={running || busy || stockRunning || scheduleRunning} refresh={refresh} onChange={setIvScan} onBlock={blockStock} />
    <div className="spreads-layout">
      <form className="monitor-panel spreads-filters" onSubmit={event => { event.preventDefault(); void start() }}>
        <h2>3. Option Scan</h2>
        <p>{ivScan.ready ? `${number(ivScan.rows.length)} aandelen uit de opgeslagen IV Scan.` : 'Rond eerst de Stock Filter en de IV Scan af. Daarna kun je de optiescan starten.'}</p>
        <fieldset disabled={blocked}><legend>Optiecriteria</legend>{fields.filter(field => !['minPrice', 'maxPrice', 'minIvr'].includes(field.key)).map(field => <label key={field.key} htmlFor={`spread-${field.key}`}>{field.label}<input id={`spread-${field.key}`} type="number" step={field.step || '1'} required value={filters[field.key]} onChange={event => setFilters(value => ({ ...value, [field.key]: event.target.value }))} /></label>)}</fieldset>
        <button className="scan-button spreads-primary" type="submit" disabled={blocked || loading || !selection || !ivScan.ready}><PlayRegular aria-hidden="true" />{running ? 'Scan bezig…' : busy ? 'Even wachten…' : 'Optiescan starten'}</button>
        {!running && (!!scan.remainingSymbols || scan.retryFrom !== undefined) && <button type="button" disabled={busy || loading || otherRunning} onClick={() => void start(true)}>Scan hervatten</button>}
        {running && <button type="button" disabled={busy} onClick={() => void stop()}><StopRegular aria-hidden="true" />Scan stoppen</button>}
        <button type="button" disabled={blocked} onClick={() => { setFilters(Object.fromEntries(Object.entries(spreadDefaults).map(([key, value]) => [key, String(value)])) as Record<keyof SpreadFilters, string>) }}>Criteria herstellen</button>
      </form>
      <div className="spreads-results">
        <section className="monitor-panel spreads-status" aria-live="polite"><strong>{number(scan.universeChecked ?? scan.symbolsChecked)}{scan.universeCount !== undefined ? ` / ${number(scan.universeCount)}` : ''} aandelen gescand</strong><span>{status}</span></section>
        {error && <section className="state-panel state-panel--error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Opnieuw laden</button></section>}
        <section className="monitor-panel">
          <div className="monitor-panel__header"><div>{selectedSymbol ? <><button type="button" onClick={() => { setPage(Math.floor(Math.max(0, overviewRows.findIndex(row => row.symbol === selectedSymbol)) / 50)); setSelectedSymbol(null) }}><ArrowLeftRegular aria-hidden="true" />Terug naar aandelen</button><h2 ref={detailHeading} tabIndex={-1}>Alle spreads voor {selectedSymbol}</h2></> : <h2 ref={detailHeading} tabIndex={-1}>Gevonden spreads</h2>}</div><button type="button" disabled={!exportableRows.length} onClick={() => { exportRows(exportableRows) }}><ArrowDownloadRegular aria-hidden="true" />CSV exporteren</button></div>
          <p className="monitor-note">{selectedSymbol ? `${rows.length} gevonden spreads voor ${selectedSymbol}. Alle getoonde spreads voldoen aan de scancriteria.` : `${rows.length} aandelen · ${allRows.length} gevonden spreads. Eén spread per aandeel; open het vergrootglas voor alle gevonden alternatieven.`} Selectie per aandeel: {sort === 'maxLoss' ? 'laagste maximale verlies' : sort === 'maxProfit' ? 'hoogste maximale winst' : sort === 'ivr' ? 'hoogste IV-rank, daarna rendement/risico' : 'hoogste rendement/risico'}. Rendement/risico = maximale winst ÷ maximaal verlies, vóór kosten, over de looptijd van de trade.</p>
          <div className="spreads-toolbar">{!selectedSymbol && <label htmlFor="spread-search">Ticker zoeken<input id="spread-search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder="Zoeken in resultaten" /></label>}<div className="spreads-sort"><label htmlFor="spread-sort">Sorteren op</label><select id="spread-sort" value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(0); setDetailPage(0) }}><option value="returnOnRisk">Rendement op risico</option><option value="maxProfit">Maximale winst</option><option value="maxLoss">Maximaal verlies</option><option value="ivr">IV-rank</option></select></div><button type="button" onClick={() => { setDescending(value => !value); setPage(0); setDetailPage(0) }}>{descending ? 'Hoog → laag' : 'Laag → hoog'}</button>{search && !selectedSymbol && <button type="button" onClick={() => { setSearch(''); setPage(0) }}>Zoekfilter wissen</button>}</div>
          {!rows.length ? <div className="spreads-empty"><h3>{selectedSymbol ? 'Geen spreads meer beschikbaar voor dit aandeel' : search && scan.rows.length ? 'Geen spreads voor deze ticker' : 'Nog geen passende spreads'}</h3></div> : <div className="scan-table-scroll" role="region" aria-label="Bull-put-spreadresultaten" tabIndex={0}><table className="scan-table spreads-table"><thead><tr>
            {!selectedSymbol && <th scope="col">Alle spreads</th>}<th scope="col">Aandeel / details</th><th scope="col">Sector</th><th scope="col">Gem. optievolume</th><th scope="col">Laatste dagvolume</th><th scope="col">Koers</th><th scope="col" aria-sort={sort === 'ivr' ? descending ? 'descending' : 'ascending' : undefined}>IV-rank</th><th scope="col">Put-strikes</th><th scope="col">Expiratie</th><th scope="col">Netto credit</th><th scope="col" title="Delta-indicatie, geen exacte winstkans">OTM-proxy</th><th scope="col" aria-sort={sort === 'returnOnRisk' ? descending ? 'descending' : 'ascending' : undefined}>Rendement / risico</th><th scope="col" aria-sort={sort === 'maxProfit' ? descending ? 'descending' : 'ascending' : undefined}>Max. winst</th><th scope="col" aria-sort={sort === 'maxLoss' ? descending ? 'descending' : 'ascending' : undefined}>Max. verlies</th><th scope="col">Break-even</th>
          </tr></thead><tbody>{pageRows.map(row => <tr key={row.id}>{!selectedSymbol && <td><button type="button" className="spreads-inspect" ref={element => { if (element) overviewButtons.current.set(row.symbol, element); else overviewButtons.current.delete(row.symbol) }} aria-label={`Alle ${groups.get(row.symbol)!.length} spreads voor ${row.symbol} bekijken`} title={`Alle gevonden spreads voor ${row.symbol}`} onClick={() => { returnToSymbol.current = row.symbol; setDetailPage(0); setSelectedSymbol(row.symbol) }}><SearchRegular aria-hidden="true" /><span>{groups.get(row.symbol)!.length}</span></button></td>}<th scope="row"><details><summary><TradingViewSymbol symbol={row.symbol} />{row.cached && <small>Opgeslagen chain</small>}</summary><div className="spreads-quote-detail"><p>Verkoop put {usd(row.shortStrike)}<br />Bied {usd(row.shortBid)} · laat {usd(row.shortAsk)}<br />{dataType(row.shortDataType)} · {time(row.shortQuotedAt)}</p><p>Koop put {usd(row.longStrike)}<br />Bied {usd(row.longBid)} · laat {usd(row.longAsk)}<br />{dataType(row.longDataType)} · {time(row.longQuotedAt)}</p><p>Handelsklasse: {row.tradingClass}<br />Koersbuffer: {number(row.buffer)}%</p></div></details><button disabled={blocked} title="Verwijder uit de scan en voeg toe aan Geblokkeerde Stocks" onClick={() => void blockStock(row.symbol, true).catch(cause => setError(cause.message))}>Verwijder {row.symbol}</button></th><SectorCell value={row} /><td>{row.avgOptionVolume === undefined ? 'Onbekend' : number(row.avgOptionVolume)}<small>{row.avgOptionVolumeAt ? time(row.avgOptionVolumeAt) : '—'}</small></td><td>{row.dayOptionVolume === undefined ? 'Onbekend' : number(row.dayOptionVolume)}<small>{row.dayOptionVolumeAt ? time(row.dayOptionVolumeAt) : '—'}</small></td><td>{usd(row.underlyingPrice)}</td><td>{number(row.ivr)}{row.ivSource === 'historical-close' && <small>Dag-IV {row.ivAsOf}</small>}</td><td><span className="spreads-leg">Verkoop {number(row.shortStrike)}</span><small>Koop {number(row.longStrike)}</small></td><td>{date(row.expiry)}<small>{row.dte} dagen</small></td><td>{usd(row.credit)}<small>per aandeel</small></td><td>{number(row.otmProxy)}%</td><td>{number(row.returnOnRisk)}%</td><td className="spreads-profit">{usd(row.maxProfit)}</td><td>{usd(row.maxLoss)}</td><td>{usd(row.breakEven)}</td></tr>)}</tbody></table></div>}
          {rows.length > 50 && <div className="spreads-toolbar" aria-label="Resultaatpagina’s"><button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Vorige</button><span>Pagina {currentPage + 1} / {pageCount} · {rows.length} resultaten</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => changePage(currentPage + 1)}>Volgende</button></div>}
        </section>
      </div>
    </div>
    <SpreadScanManagement disabled={blocked} refresh={refresh} onRunning={setScheduleRunning} onBlock={blockStock} />
  </div>
}
