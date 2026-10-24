import { useEffect, useState } from 'react'
import { ArrowDownloadRegular, PlayRegular, StopRegular } from '@fluentui/react-icons'
import { spreadDefaults, spreadFilters } from '../../shared/put-spread.mjs'
import type { PutSpread, SpreadFilters } from '../../shared/put-spread.mjs'
import './put-spreads.css'

interface Scan {
  state: string; rows: PutSpread[]; warnings: string[]; symbolsChecked: number; contractsChecked: number;
  symbols?: string[]; filters?: SpreadFilters; progress?: string; message?: string; finishedAt?: string;
  universeMode?: 'us' | 'custom'; universeCount?: number; universeChecked?: number; remainingSymbols?: number; universeUpdatedAt?: string; cacheHits?: number; chainsSkipped?: number; marketOpen?: boolean;
  assessments?: { symbol: string; status: string; reason: string; source: string; asOf?: string }[];
  coverage?: string; storageError?: string; restoredFromDisk?: boolean; showingPreviousResults?: boolean;
}
const empty: Scan = { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
const number = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
const usd = (value: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'USD' }).format(value)
const date = (value: string) => value.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3-$2-$1')
const time = (value: string) => value ? new Date(value).toLocaleString('nl-NL') : 'Tijd onbekend'
const dataType = (value: number) => ({ 1: 'Live', 2: 'Bevroren', 3: 'Vertraagd', 4: 'Vertraagd / bevroren' }[value] || 'Onbekend')
const fields: { key: keyof SpreadFilters; label: string; step?: string }[] = [
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
  const keys: (keyof PutSpread)[] = ['cached', 'symbol', 'expiry', 'dte', 'underlyingPrice', 'ivr', 'shortStrike', 'longStrike', 'shortBid', 'shortAsk', 'longBid', 'longAsk', 'credit', 'maxProfit', 'maxLoss', 'breakEven', 'returnOnRisk', 'buffer', 'otmProxy', 'shortQuotedAt', 'longQuotedAt', 'shortDataType', 'longDataType']
  const csv = [keys.join(';'), ...rows.map(row => keys.map(key => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bull-put-spreads.csv'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function PutSpreadPage() {
  const [preferences] = useState(loadPreferences)
  const [universeMode, setUniverseMode] = useState<'us' | 'custom'>(preferences.universeMode)
  const [symbols, setSymbols] = useState(preferences.symbols)
  const [filters, setFilters] = useState<Record<keyof SpreadFilters, string>>(() => Object.fromEntries(Object.entries(preferences.filters).map(([key, value]) => [key, String(value)])) as Record<keyof SpreadFilters, string>)
  const [scan, setScan] = useState<Scan>(empty)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'returnOnRisk' | 'maxProfit' | 'maxLoss' | 'ivr'>('returnOnRisk')
  const [descending, setDescending] = useState(true)
  const [page, setPage] = useState(0)
  const running = scan.state === 'running'
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const result = await responseData(await fetch('/api/put-spreads', { signal: controller.signal, cache: 'no-store' }))
        if (controller.signal.aborted) return
        setScan(result); setError(''); setLoading(false)
        if (result.state === 'running') timer = setTimeout(() => void load(), 3000)
      } catch (cause) {
        if (!controller.signal.aborted) { setError((cause as Error).message); setLoading(false); timer = setTimeout(() => void load(), 8000) }
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry])

  async function start(resume = false) {
    setError(''); setNotice('')
    let parsed: SpreadFilters
    try {
      if (Object.values(filters).some(value => !value.trim())) throw Error('Vul alle filters in.')
      parsed = spreadFilters(Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, Number(value)])))
      if (universeMode === 'custom' && !symbols.trim()) throw Error('Vul minstens één ticker in of neem de IV-resultaten over.')
    } catch (cause) { setError((cause as Error).message); return }
    setBusy(true)
    try {
      const result = await responseData(await fetch('/api/put-spreads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ universeMode, resume, symbols: symbols.split(/[\s,;]+/).filter(Boolean), filters: parsed }) }))
      setScan(result); setRetry(value => value + 1)
      try { localStorage.setItem('tm-put-spread-filters', JSON.stringify({ universeMode, symbols, filters: parsed })) } catch { /* Scanner works without browser storage. */ }
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  async function stop() {
    setBusy(true); setError('')
    try { setScan(await responseData(await fetch('/api/put-spreads/stop', { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } }))); setRetry(value => value + 1) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  async function useIvResults() {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await responseData(await fetch('/api/iv-scan', { cache: 'no-store' }))
      const values = [...new Set(result.rows.map(row => row.symbol))].slice(0, 50)
      if (!values.length) throw Error('Geen IV-resultaten beschikbaar. Voer tickers in of start eerst een IV Scan.')
      setUniverseMode('custom'); setSymbols(values.join(', ')); setNotice(`${values.length} tickers overgenomen uit IV Scan (maximaal 50). Start de scan om nieuwe optiequotes op te halen.`)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  const rows = scan.rows.filter(row => row.symbol.includes(search.toUpperCase().trim())).sort((a, b) => (descending ? b[sort] - a[sort] : a[sort] - b[sort]) || a.id.localeCompare(b.id))
  const pageCount = Math.max(1, Math.ceil(rows.length / 50))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(currentPage * 50, currentPage * 50 + 50)
  const status = loading ? 'Resultaten laden…' : running ? scan.progress || 'Scan loopt…' : scan.state === 'idle' ? 'Klaar om te scannen' : scan.state === 'error' ? scan.message || 'Scan mislukt; probeer opnieuw.' : scan.state === 'cancelled' ? 'Scan gestopt' : scan.state === 'interrupted' ? 'Scan onderbroken door serverherstart' : scan.state === 'partial' ? 'Scan afgerond met ontbrekende data' : 'Scan afgerond'
  return <div className="spreads-page">
    <section className="monitor-panel spreads-intro">
      <div><h2>Bull put spread</h2><p className="monitor-note">Verkoop een put en koop een lagere put met dezelfde expiratie. Vergelijk de premie met je begrensde expiratierisico.</p></div>
      <span className="spreads-method">Conservatief · short-bied − long-laat</span>
    </section>
    <div className="spreads-layout">
      <form className="monitor-panel spreads-filters" onSubmit={event => { event.preventDefault(); void start() }}>
        <h2>Scan instellen</h2>
        <label htmlFor="spread-universe">Aandelenuniversum</label><select id="spread-universe" disabled={running || busy} value={universeMode} onChange={event => setUniverseMode(event.target.value as typeof universeMode)}><option value="us">Alle Amerikaanse aandelen</option><option value="custom">Eigen tickers</option></select>
        <p className="monitor-note">Alle gewone aandelen en ADR’s uit Nasdaq en overige Amerikaanse beurslijsten. Optiegeschiktheid via IBKR; eerst koers en IV-rank, daarna alleen passende chains.</p>
        {universeMode === 'custom' && <><label htmlFor="spread-symbols">Tickers (maximaal 50)</label>
        <textarea id="spread-symbols" rows={3} value={symbols} disabled={running || busy} placeholder="Bijvoorbeeld TSLA, AMD, PLTR" onChange={event => setSymbols(event.target.value)} /></>}
        <button type="button" disabled={running || busy} onClick={() => void useIvResults()}>IV-resultaten overnemen</button>
        <fieldset disabled={running || busy}><legend>Criteria</legend>{fields.map(field => <label key={field.key} htmlFor={`spread-${field.key}`}>{field.label}<input id={`spread-${field.key}`} type="number" step={field.step || '1'} required value={filters[field.key]} onChange={event => setFilters(value => ({ ...value, [field.key]: event.target.value }))} /></label>)}</fieldset>
        <p className="monitor-note">Koersbuffer = afstand van de aandelenkoers tot de short-strike. OTM-proxy = 1 − |short-delta|; geen exacte winstkans.</p>
        <button className="scan-button spreads-primary" type="submit" disabled={running || busy || loading}><PlayRegular aria-hidden="true" />{running ? 'Scan bezig…' : busy ? 'Even wachten…' : 'Scan starten'}</button>
        {!running && !!scan.remainingSymbols && <button type="button" disabled={busy || loading} onClick={() => void start(true)}>Scan hervatten</button>}
        {running && <button type="button" disabled={busy} onClick={() => void stop()}><StopRegular aria-hidden="true" />Scan stoppen</button>}
        <button type="button" disabled={running || busy} onClick={() => { setFilters(Object.fromEntries(Object.entries(spreadDefaults).map(([key, value]) => [key, String(value)])) as Record<keyof SpreadFilters, string>); setNotice('Standaardcriteria teruggezet. Start een scan om ze toe te passen.') }}>Criteria herstellen</button>
      </form>
      <div className="spreads-results">
        <section className="monitor-panel spreads-status" aria-live="polite"><strong>{status}</strong><span>{scan.universeChecked ?? scan.symbolsChecked} / {scan.universeCount ?? scan.symbolsChecked} aandelen · {scan.contractsChecked} contracten · {scan.rows.length} spreads</span><span>{scan.chainsSkipped ?? 0} chains overgeslagen door aandelenfilter · {scan.cacheHits ?? 0} chains uit cache</span>{scan.marketOpen !== undefined && <span>{scan.marketOpen ? 'Optiemarkt open' : 'Optiemarkt gesloten · oude chains waar beschikbaar'}</span>}{scan.finishedAt && <span>Afgerond: {time(scan.finishedAt)}</span>}</section>
        {error && <section className="state-panel state-panel--error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Opnieuw laden</button></section>}
        {notice && <p role="status">{notice}</p>}
        {(scan.restoredFromDisk || scan.showingPreviousResults) && <p className="monitor-note">Opgeslagen eerdere resultaten. De tijden per optie tonen wanneer deze quotes zijn opgehaald.</p>}
        {scan.storageError && <p role="alert">{scan.storageError}</p>}
        <section className="monitor-panel">
          <div className="monitor-panel__header"><div><h2>Gevonden spreads</h2><p className="monitor-note">Bedragen per spread van 100 aandelen, exclusief kosten.</p></div><button type="button" disabled={!rows.length} onClick={() => { exportRows(rows); setNotice(`${rows.length} zichtbare spreads geëxporteerd als CSV.`) }}><ArrowDownloadRegular aria-hidden="true" />CSV exporteren</button></div>
          <div className="spreads-toolbar"><label htmlFor="spread-search">Ticker zoeken<input id="spread-search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder="Zoeken in resultaten" /></label><div className="spreads-sort"><label htmlFor="spread-sort">Sorteren op</label><select id="spread-sort" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="returnOnRisk">Rendement op risico</option><option value="maxProfit">Maximale winst</option><option value="maxLoss">Maximaal verlies</option><option value="ivr">IV-rank</option></select></div><button type="button" onClick={() => setDescending(value => !value)}>{descending ? 'Hoog → laag' : 'Laag → hoog'}</button>{search && <button type="button" onClick={() => setSearch('')}>Zoekfilter wissen</button>}</div>
          {scan.filters && <p className="monitor-note">Getoonde scan: koers {usd(scan.filters.minPrice ?? spreadDefaults.minPrice)}–{usd(scan.filters.maxPrice ?? spreadDefaults.maxPrice)} · {scan.filters.minDte}–{scan.filters.maxDte} DTE · IVR ≥ {scan.filters.minIvr} · buffer ≥ {scan.filters.minBuffer}% · winst ≥ {usd(scan.filters.minProfit)} · verlies ≤ {usd(scan.filters.maxLoss)} · OTM-proxy ≥ {scan.filters.minOtm}% · bied-laat ≤ {usd(scan.filters.maxQuoteSpread)}. Wijzigingen links gelden bij de volgende scan.</p>}
          {!rows.length ? <div className="spreads-empty"><ArrowDownloadRegular aria-hidden="true" /><h3>{search && scan.rows.length ? 'Geen spreads voor deze ticker' : running ? 'Optiecontracten worden gecontroleerd' : 'Nog geen passende spreads'}</h3><p>{search && scan.rows.length ? 'Wis het zoekfilter om alle resultaten te bekijken.' : running ? 'Nieuwe resultaten verschijnen hier tijdens de scan.' : 'Voer tickers in en start een scan. Geen resultaten? Bekijk de meldingen of verruim je criteria.'}</p></div> : <div className="scan-table-scroll" role="region" aria-label="Bull-put-spreadresultaten" tabIndex={0}><table className="scan-table spreads-table"><thead><tr>
            <th scope="col">Aandeel / details</th><th scope="col">Koers</th><th scope="col" aria-sort={sort === 'ivr' ? descending ? 'descending' : 'ascending' : undefined}>IV-rank</th><th scope="col">Put-strikes</th><th scope="col">Expiratie</th><th scope="col">Netto credit</th><th scope="col" title="Delta-indicatie, geen exacte winstkans">OTM-proxy</th><th scope="col" aria-sort={sort === 'returnOnRisk' ? descending ? 'descending' : 'ascending' : undefined}>Rendement / risico</th><th scope="col" aria-sort={sort === 'maxProfit' ? descending ? 'descending' : 'ascending' : undefined}>Max. winst</th><th scope="col" aria-sort={sort === 'maxLoss' ? descending ? 'descending' : 'ascending' : undefined}>Max. verlies</th><th scope="col">Break-even</th>
          </tr></thead><tbody>{pageRows.map(row => <tr key={row.id}><th scope="row"><details><summary>{row.symbol}{row.cached && <small>Opgeslagen chain</small>}</summary><div className="spreads-quote-detail"><p>Verkoop put {usd(row.shortStrike)}<br />Bied {usd(row.shortBid)} · laat {usd(row.shortAsk)}<br />{dataType(row.shortDataType)} · {time(row.shortQuotedAt)}</p><p>Koop put {usd(row.longStrike)}<br />Bied {usd(row.longBid)} · laat {usd(row.longAsk)}<br />{dataType(row.longDataType)} · {time(row.longQuotedAt)}</p><p>Handelsklasse: {row.tradingClass}<br />Koersbuffer: {number(row.buffer)}%</p></div></details></th><td>{usd(row.underlyingPrice)}</td><td>{number(row.ivr)}</td><td><span className="spreads-leg">Verkoop {number(row.shortStrike)}</span><small>Koop {number(row.longStrike)}</small></td><td>{date(row.expiry)}<small>{row.dte} dagen</small></td><td>{usd(row.credit)}<small>per aandeel</small></td><td>{number(row.otmProxy)}%</td><td>{number(row.returnOnRisk)}%</td><td className="spreads-profit">{usd(row.maxProfit)}</td><td>{usd(row.maxLoss)}</td><td>{usd(row.breakEven)}</td></tr>)}</tbody></table></div>}
          {rows.length > 50 && <div className="spreads-toolbar" aria-label="Resultaatpagina’s"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Vorige</button><span>Pagina {currentPage + 1} / {pageCount} · {rows.length} resultaten</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Volgende</button></div>}
        </section>
        {!!scan.assessments?.length && <details className="monitor-panel" open><summary>Aandelenbeoordeling · laatste 50 (van {scan.assessments.length})</summary><p className="monitor-note">Koers en IV-rank vóór de optiechain; looptijd, buffer, premie, risico en delta vereisen optiegegevens. Cache gebruikt de opgeslagen koers en IV-rank op de getoonde datum.</p><div className="scan-table-scroll" tabIndex={0} role="region" aria-label="Aandelenbeoordelingen"><table className="scan-table"><thead><tr><th scope="col">Aandeel</th><th scope="col">Beoordeling</th><th scope="col">Bron / tijd</th><th scope="col">Reden</th></tr></thead><tbody>{scan.assessments.filter(item => item.symbol.includes(search.toUpperCase().trim())).slice(-50).map((item, i) => <tr key={`${item.symbol}:${i}`}><th scope="row">{item.symbol}</th><td>{{ filtered: 'Overgeslagen', missing: 'Data ontbreekt', partial: 'Onvolledige data', match: 'Passende spread', 'no-match': 'Geen match' }[item.status] || item.status}</td><td>{item.source === 'cache' ? 'Oude chain' : item.source === 'none' ? 'Geen data' : 'IBKR'}<small>{item.asOf ? time(item.asOf) : '—'}</small></td><td className="spreads-assessment-reason">{item.reason}</td></tr>)}</tbody></table></div></details>}
        <details className="monitor-panel"><summary>Datadekking en berekeningen</summary><p>{scan.coverage || 'Breed aandelenuniversum; per ticker en expiratie worden maximaal 32 strikes onder de ingestelde buffergrens opgevraagd. Alleen standaard USD-puts met multiplier 100 en dezelfde handelsklasse worden gecombineerd.'}</p><p>Credit = short-bied − long-laat. Max. winst = credit × 100. Max. verlies = (strikeverschil − credit) × 100. Break-even = short-strike − credit. Rendement = max. winst / max. verlies. Winst en verlies gelden bij expiratie, exclusief kosten; vroegtijdige toewijzing kan aanvullende verplichtingen geven.</p><p>Quotes worden na elkaar opgehaald en zijn geen uitvoerbare combinatiequote. Bronstatus en tijd staan onder de ticker. OTM-proxy is een delta-indicatie; er wordt geen exacte kans op winst of maximaal verlies berekend. Bij gesloten markt wordt de opgeslagen chain opnieuw gefilterd, inclusief oude koers en IV-rank; ontbrekende cache wordt via bevroren IBKR-data geprobeerd. Zonder brondata blijft het aandeel onbeoordeeld. Verlopen puts vervallen bij herfilteren. Optievolume en Samurai-scores zijn niet beschikbaar in deze databron.</p><p>Deze scanner gebruikt je bestaande lokale IBKR-koppeling en plaatst geen orders.</p></details>
        {!!scan.warnings.length && <details className="monitor-panel" open><summary>Meldingen ({scan.warnings.length})</summary><ul>{scan.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      </div>
    </div>
  </div>
}
