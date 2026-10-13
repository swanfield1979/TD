import { useEffect, useState } from 'react'
import type { LeapCandidate } from '../../shared/leaps-scan.mjs'
import { normalizeShortlist } from '../../shared/leaps-scan.mjs'
async function researchResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.message || `Scanner-API niet bereikbaar (HTTP ${response.status}). Controleer de API en probeer opnieuw.`)
  if (!(Array.isArray(data.symbols) || Array.isArray(data.rows) && Array.isArray(data.warnings) && typeof data.state === 'string')) throw new Error('De scanner retourneert ongeldige data; werk de API bij en probeer opnieuw.')
  return data as T
}

interface IvRow {
  symbol: string; underlyingPrice: number; iv: number; ivr: number; ivPercentile: number;
  quotedAt: string; marketDataType: number; universe?: string;
}
interface Result {
  state: string; rows: (IvRow & Partial<LeapCandidate>)[]; warnings: string[]; progress?: string;
  symbolsChecked: number; contractsChecked: number; startedAt?: string; finishedAt?: string;
  restoredFromDisk?: boolean; savedAt?: string; storageError?: string; showingPreviousResults?: boolean; previousFinishedAt?: string; roundDate?: string; universeCount?: number; universeChecked?: number; remainingSymbols?: number; discoverySource?: string; historyCacheHits?: number; message?: string; symbols?: string[]; assessments?: { symbol: string; matches: number; message: string }[];
}
const empty: Result = { state: 'idle', rows: [], warnings: [], symbolsChecked: 0, contractsChecked: 0 }
const num = (value: number | undefined | null) => value == null ? '—' : value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
const usd = (value: number | undefined) => value === undefined ? '—' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'USD' }).format(value)
const expiryLabel = (value: string | undefined) => value?.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3-$2-$1') ?? '—'
const dataType = (type: number) => ({ 1: 'Live', 2: 'Bevroren', 3: 'Vertraagd', 4: 'Vertraagd / bevroren' }[type] ?? 'Onbekend')

const priceRanges = [
  { value: 'all', label: 'Alle koersen', min: '', max: '' },
  { value: '0-10', label: '$0–$10', min: '0', max: '10' },
  { value: '10-25', label: '$10–$25', min: '10', max: '25' },
  { value: '25-50', label: '$25–$50', min: '25', max: '50' },
  { value: '50-100', label: '$50–$100', min: '50', max: '100' },
  { value: '100+', label: '$100 en hoger', min: '100', max: '' },
]
function loadIvFilters() {
  try {
    const data = JSON.parse(localStorage.getItem('tm-iv-filters') || '{}')
    const validPrice = (value: unknown) => typeof value === 'string' && (value === '' || Number.isFinite(Number(value)) && Number(value) >= 0)
    return { descending: data.descending !== false, min: validPrice(data.min) ? data.min as string : '', max: validPrice(data.max) ? data.max as string : '' }
  } catch { return { descending: true, min: '', max: '' } }
}

export default function OptionResearchPage({ mode }: { mode: 'iv' | 'leaps' }) {
  const [result, setResult] = useState<Result>(empty)
  const [symbols, setSymbols] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [shortlistLoaded, setShortlistLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [matchesOnly, setMatchesOnly] = useState(true)
  const [ivFilters, setIvFilters] = useState(loadIvFilters)
  useEffect(() => {
    if (mode === 'iv') {
      try { localStorage.setItem('tm-iv-filters', JSON.stringify(ivFilters)) } catch { /* Filters also work without browser storage. */ }
    }
  }, [mode, ivFilters])
  const endpoint = mode === 'iv' ? '/api/iv-scan' : '/api/leaps'
  const running = result.state === 'running'
  const currentRound = !result.roundDate || result.roundDate === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/leaps/shortlist', { signal: controller.signal, cache: 'no-store' })
      .then(response => researchResponse<{ symbols: string[] }>(response)).then(data => { setSymbols(data.symbols); setShortlistLoaded(true) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [retry])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal })
        const data = await researchResponse<Result>(response)
        if (controller.signal.aborted) return
        setResult(data)
        if (data.state === 'running') timer = setTimeout(() => void load(), 3000)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError((cause as Error).message)
          timer = setTimeout(() => void load(), 5000)
        }
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [endpoint, retry])

  async function save(values: string[]) {
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/leaps/shortlist', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ symbols: values }) })
      const data = await researchResponse<{ symbols: string[] }>(response)
      setSymbols(data.symbols); setNotice('Shortlist opgeslagen. Start een nieuwe scan om deze lijst te beoordelen.')
      return true
    } catch (cause) { setError((cause as Error).message); return false }
    finally { setSaving(false) }
  }
  async function add(values: string[]) {
    try {
      const next = normalizeShortlist([...symbols, ...values])
      if (await save(next)) setInput('')
    } catch (cause) { setError((cause as Error).message) }
  }
  async function start() {
    setStarting(true); setError(''); setNotice('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } })
      setResult(await researchResponse<Result>(response)); setRetry(value => value + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { setStarting(false) }
  }
  async function stop() {
    setStarting(true); setError('')
    try {
      const response = await fetch(`${endpoint}/stop`, { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } })
      setResult(await researchResponse<Result>(response)); setRetry(value => value + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { setStarting(false) }
  }
  const minPrice = ivFilters.min === '' ? 0 : Number(ivFilters.min)
  const maxPrice = ivFilters.max === '' ? Infinity : Number(ivFilters.max)
  const priceError = mode !== 'iv' ? '' : !Number.isFinite(minPrice) || minPrice < 0 || (ivFilters.max !== '' && (!Number.isFinite(maxPrice) || maxPrice < 0))
    ? 'Gebruik een geldige koers van nul of hoger.' : minPrice > maxPrice ? 'De minimumkoers mag niet hoger zijn dan de maximumkoers.' : ''
  const selectedRange = priceRanges.find(range => range.min === ivFilters.min && range.max === ivFilters.max)?.value ?? 'custom'
  const hasPriceFilter = mode === 'iv' && (ivFilters.min !== '' || ivFilters.max !== '')
  const rows = result.rows.filter(row => row.symbol.includes(search.toUpperCase().trim()) && (mode === 'iv'
    ? !priceError && row.underlyingPrice >= minPrice && row.underlyingPrice <= maxPrice : !matchesOnly || row.qualifies))
  if (mode === 'iv') rows.sort((a, b) => (ivFilters.descending ? b.ivr - a.ivr : a.ivr - b.ivr) || a.symbol.localeCompare(b.symbol))
  return <div className="scans-page option-research">
    <section className="monitor-panel">
      <div className="monitor-panel__header"><div><h2>{mode === 'iv' ? 'Aandelen met IV-rank boven 40' : 'Langlopende puts op jouw shortlist'}</h2>
        <p className="monitor-note">{mode === 'iv' ? 'Verken NASDAQ en S&P 500 en voeg gewenste aandelen handmatig toe aan Leaps.' : 'Alleen aandelen die jij wilt bezitten. Vergelijk korte en lange puts op dezelfde kapitaalbasis.'}</p></div>
        <button className="scan-button" type="button" disabled={running || starting || saving || (mode === 'leaps' && (!shortlistLoaded || !symbols.length))} onClick={() => void start()}>{running || starting ? 'Scan bezig…' : mode === 'iv' && currentRound && (result.remainingSymbols ?? 0) > 0 ? 'Volgende 25 scannen' : 'Scan starten'}</button>
        {running && <button type="button" disabled={starting} onClick={() => void stop()}>Scan stoppen</button>}
      </div>
      <ul className="scan-criteria"><li>IV-rank &gt; 40</li>{mode === 'leaps' && <><li>IV-percentile &gt; 50 · liefst 60+</li><li>|Delta| 0,10–0,15</li><li>30–50 versus 300–700 DTE</li><li>Hoger jaarrendement</li></>}</ul>
      <p className="monitor-note">{mode === 'iv' ? 'De S&P 500-ledenlijst en Nasdaq-aandelenlijst leveren de tickers, zonder IBKR-marktscanner. Eerst S&P 500, daarna overige Nasdaq-aandelen; telkens alfabetisch. Per klik worden 25 aandelen gecontroleerd, zonder koersgrens.' : 'Vergelijking met de beste kortlopende put binnen maximaal 0,02 verschil in absolute delta. Beide puts moeten aan de IV- en deltacriteria voldoen. Zonder vergelijkbare korte put wordt geen match toegekend.'}</p>
      <p className="monitor-note">Rustige scan: één quote tegelijk, minimaal 0,5 seconde tussen aanvragen en minimaal 11 seconden tussen historische downloads. Geldige IV-historie wordt voor deze beursdatum hergebruikt; optiequotes blijven nieuw opgevraagd.{!!result.historyCacheHits && <> {result.historyCacheHits} historiedownloads uit de cache.</>}</p>
      <p className="monitor-note">IV-rank = positie tussen de laagste en hoogste IV in de afgelopen 12 maanden. IV-percentile = percentage historische dagen met lagere IV. Minimaal 200 waarnemingen met voldoende jaar- en recente dekking vereist.</p>
      <p role="status" aria-live="polite">{running ? result.progress || 'Scan loopt…' : result.state === 'idle' ? 'Klaar om te scannen' : result.state === 'interrupted' ? result.message || 'Scan onderbroken; opgeslagen resultaten blijven zichtbaar.' : result.state === 'cancelled' ? 'Scan gestopt; reeds gevonden resultaten blijven zichtbaar.' : result.state === 'error' ? result.message : result.state === 'partial' ? result.message || 'Scan afgerond met ontbrekende data; zie meldingen.' : result.message || 'Scan afgerond'}{result.finishedAt && <> · {new Date(result.finishedAt).toLocaleString('nl-NL')}</>}</p>
      {mode === 'iv' && result.universeCount !== undefined && <p className="monitor-note">Dekking deze scanronde: {result.universeChecked ?? 0} / {result.universeCount} aandelen. Resultaten uit eerdere blokken blijven zichtbaar met hun ophaaltijd. Voortgang blijft na een API-herstart bewaard. Een nieuwe beursdatum begint een nieuwe ronde.</p>}
      {result.startedAt && <p className="monitor-note">{result.symbolsChecked} aandelen en {result.contractsChecked} optiecontracten gecontroleerd.{mode === 'leaps' && result.symbols && <> Gescand: {result.symbols.join(', ')}.</>}</p>}
    </section>
    {result.restoredFromDisk && <p className="monitor-note" role="status">Laatste scan teruggezet uit serveropslag{result.savedAt && <> · opgeslagen {new Date(result.savedAt).toLocaleString('nl-NL')}</>}. Quote-ophaaltijden blijven zichtbaar; dit zijn geen opnieuw opgehaalde koersen.</p>}
    {result.showingPreviousResults && <p className="monitor-note" role="status">De nieuwe scan leverde geen resultaten op. De vorige resultaten blijven zichtbaar{result.previousFinishedAt && <> van {new Date(result.previousFinishedAt).toLocaleString('nl-NL')}</>}.</p>}
    {result.storageError && <section className="state-panel state-panel--error" role="alert"><p>{result.storageError}</p></section>}
    {error && <section className="state-panel state-panel--error" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setRetry(value => value + 1) }}>Opnieuw laden</button></section>}
    {notice && <p role="status">{notice}</p>}
    {mode === 'leaps' && <section className="monitor-panel">
      <div className="monitor-panel__header"><h2>Mijn shortlist</h2><span>{symbols.length} / 50 aandelen</span></div>
      <form className="scan-command" onSubmit={event => { event.preventDefault(); void add(input.split(/[\s,;]+/).filter(Boolean)) }}>
        <label htmlFor="leaps-symbols">Tickers toevoegen</label><input id="leaps-symbols" value={input} onChange={event => setInput(event.target.value)} placeholder="Bijvoorbeeld HOOD, NVDA, COIN" autoComplete="off" />
        <button type="submit" disabled={!shortlistLoaded || saving || running || !input.trim()}>{saving ? 'Opslaan…' : 'Toevoegen'}</button>
      </form>
      <div className="leaps-shortlist">{symbols.map(symbol => <span key={symbol}>{symbol}<button type="button" aria-label={`${symbol} verwijderen uit shortlist`} disabled={saving || running} onClick={() => void save(symbols.filter(value => value !== symbol))}>Verwijderen</button></span>)}</div>
      {!symbols.length && <p className="monitor-empty">{shortlistLoaded ? 'Voeg aandelen toe die je bij toewijzing wilt bezitten.' : 'Shortlist laden…'}</p>}
      <p className="monitor-note">De shortlist wordt op de server bewaard en blijft na vernieuwen of een update beschikbaar.</p>
    </section>}
    <section className="monitor-panel">
      <div className="monitor-panel__header"><h2>{mode === 'iv' ? 'IV-resultaten' : 'Leaps-kandidaten'}</h2><span>{mode === 'iv' ? `${rows.length} / ${result.rows.length}` : rows.length} resultaten</span></div>
      <div className="scan-command"><label htmlFor="research-search">Ticker zoeken</label><input id="research-search" value={search} onChange={event => setSearch(event.target.value)} />
        {mode === 'iv' && <button type="button" onClick={() => setIvFilters(value => ({ ...value, descending: !value.descending }))} aria-label={`IV-rank sorteren: ${ivFilters.descending ? 'hoog naar laag' : 'laag naar hoog'}`}>IV-rank: {ivFilters.descending ? 'hoog → laag' : 'laag → hoog'}</button>}
        {mode === 'leaps' && <label><input type="checkbox" checked={matchesOnly} onChange={event => setMatchesOnly(event.target.checked)} /> Alleen passende kandidaten</label>}
        {search && <button type="button" onClick={() => setSearch('')}>Zoekfilter wissen</button>}
      </div>
      {mode === 'iv' && <fieldset className="iv-price-filter">
        <legend>Prijsfilter (USD)</legend>
        <label htmlFor="iv-price-range">Prijsrange</label><select id="iv-price-range" value={selectedRange} onChange={event => {
          const range = priceRanges.find(value => value.value === event.target.value)
          if (range) setIvFilters(value => ({ ...value, min: range.min, max: range.max }))
        }}>{priceRanges.map(range => <option key={range.value} value={range.value}>{range.label}</option>)}<option value="custom" disabled>Aangepast</option></select>
        <label htmlFor="iv-min-price">Minimumkoers</label><input id="iv-min-price" type="number" min="0" step="any" inputMode="decimal" placeholder="Geen minimum" value={ivFilters.min} aria-invalid={!!priceError} aria-describedby={priceError ? 'iv-price-error' : 'iv-filter-help'} onChange={event => setIvFilters(value => ({ ...value, min: event.target.value }))} />
        <label htmlFor="iv-max-price">Maximumkoers</label><input id="iv-max-price" type="number" min="0" step="any" inputMode="decimal" placeholder="Geen maximum" value={ivFilters.max} aria-invalid={!!priceError} aria-describedby={priceError ? 'iv-price-error' : 'iv-filter-help'} onChange={event => setIvFilters(value => ({ ...value, max: event.target.value }))} />
        {(hasPriceFilter || search) && <button type="button" onClick={() => { setSearch(''); setIvFilters(value => ({ ...value, min: '', max: '' })) }}>Filters wissen</button>}
      </fieldset>}
      {priceError && <p id="iv-price-error" role="alert">{priceError}</p>}
      {mode === 'iv' && <p id="iv-filter-help" className="monitor-note">Filter op de getoonde aandelenkoers in USD; grenzen zijn inclusief. Sortering en prijsfilter worden in deze browser onthouden. De scanresultaten en scanvoortgang blijven bewaard.</p>}
      {!rows.length ? <p className="monitor-empty">{priceError ? 'Pas het prijsfilter aan of wis de filters.' : mode === 'iv' && result.rows.length > 0 && (hasPriceFilter || search) ? 'Geen resultaten binnen deze filters. Wis de filters om alle gevonden aandelen te tonen.' : running ? 'Resultaten worden tijdens de scan aangevuld.' : result.state === 'idle' ? 'Start een scan om kandidaten te zoeken.' : result.symbolsChecked === 0 ? 'Nog geen aandelen gecontroleerd. Controleer de scanstatus en meldingen.' : 'Geen passende resultaten in de gecontroleerde aandelen. De scanstatus toont hoeveel aandelen al zijn gecontroleerd.'}</p> :
        <div className="scan-table-scroll" tabIndex={0} role="region" aria-label="Scanresultaten"><table className="scan-table"><thead><tr>
          <th scope="col">Aandeel / koers</th><th scope="col" aria-sort={mode === 'iv' ? ivFilters.descending ? 'descending' : 'ascending' : undefined}>IV-rank</th><th scope="col">IV-percentile</th>
          {mode === 'iv' ? <><th scope="col">IV</th><th scope="col">Universum</th></> : <><th scope="col">Lange put / DTE</th><th scope="col">Strike / |delta|</th><th scope="col">Bied / laat</th><th scope="col">Premie / onderpand</th><th scope="col">Break-even</th><th scope="col" title="Koersverandering vanaf de huidige koers tot break-even bij expiratie">Decrease to break even</th><th scope="col" title="Maximale premieopbrengst gedeeld door strike min premie, alleen bij waardeloos aflopen">Return if expired</th><th scope="col" title="Rendement op strike min premie, lineair omgerekend naar 365 dagen">Return annualized</th><th scope="col">Lang per jaar (onderpand)</th><th scope="col">Korte referentie</th><th scope="col">Kort per jaar (onderpand)</th><th scope="col">Verschil</th><th scope="col">50% exit</th><th scope="col">Beoordeling</th></>}
          <th scope="col">Marktdata</th>{mode === 'iv' && <th scope="col">Shortlist</th>}
        </tr></thead><tbody>{rows.map(row => <tr key={row.id ?? row.symbol}>
          <th scope="row">{row.symbol}<small>{usd(row.underlyingPrice)}</small></th><td>{num(row.ivr)}</td><td>{num(row.ivPercentile)}{row.ivPercentile >= 60 && <small>Voorkeur 60+</small>}</td>
          {mode === 'iv' ? <><td>{num(row.iv)}%</td><td>{row.universe}</td></> : <><td>{expiryLabel(row.expiry)}<small>{row.dte} dagen</small></td><td>{usd(row.strike)}<small>{num(row.absoluteDelta)}</small></td><td>{usd(row.bid)} / {usd(row.ask)}</td><td>{usd(row.premium)}<small>{usd(row.collateral)}</small></td><td>{usd(row.breakEven)}</td><td>{num(row.decreaseToBreakEven)}%</td><td>{num(row.returnIfExpired)}%</td><td>{num(row.returnAnnualized)}%</td><td>{num(row.annualizedYield)}%</td><td>{row.reference ? <>{expiryLabel(row.reference.expiry)}<small>{row.reference.dte} DTE · {usd(row.reference.strike)} · Δ {num(row.reference.absoluteDelta)}</small></> : 'Ontbreekt'}</td><td>{row.reference ? `${num(row.reference.annualizedYield)}%` : '—'}</td><td>{row.yieldAdvantage == null ? '—' : `${num(row.yieldAdvantage)} pp`}</td><td>{usd(row.exitPrice)}<small>Per aandeel</small></td><td>{row.qualifies ? 'Voldoet' : row.reference ? 'Kort is minstens even goed' : 'Niet toetsbaar'}</td></>}
          <td>{dataType(row.marketDataType)}<small>{new Date(row.quotedAt).toLocaleString('nl-NL')}</small></td>
          {mode === 'iv' && <td><button type="button" disabled={!shortlistLoaded || saving || symbols.includes(row.symbol) || symbols.length >= 50} onClick={() => void add([row.symbol])}>{symbols.includes(row.symbol) ? 'Op shortlist' : 'Toevoegen aan Leaps'}</button></td>}
        </tr>)}</tbody></table></div>}
    </section>
    {mode === 'leaps' && !!result.assessments?.length && <section className="monitor-panel"><h2>Beoordeling per aandeel</h2><ul>{result.assessments.map(item => <li key={item.symbol}><strong>{item.symbol}</strong>: {item.message} ({item.matches} matches)</li>)}</ul></section>}
    {result.warnings.length > 0 && <section className="monitor-panel"><h2>Meldingen over dekking en data</h2><ul>{result.warnings.map((warning, index) => <li key={`${index}:${warning}`}>{warning}</li>)}</ul></section>}
    {mode === 'leaps' && <p className="monitor-note">Decrease to break even = (break-even / koers − 1) × 100%. Return if expired = biedpremie / (strike − biedpremie) × 100%, alleen als de put waardeloos afloopt. Return annualized = dit rendement × 365 / DTE. Deze drie kolommen volgen de rekenbasis van je voorbeeld. Premie = biedprijs × 100; onderpand = strike × 100. Jaarrendement = premie / onderpand × 365 / DTE, vóór kosten en zonder cashrente. 50% exit = terugkopen tegen de helft van de ontvangen premie, vóór kosten. Toewijzing accepteren zolang je het bedrijf wilt bezitten; anders handmatig sluiten met verlies. De scan plaatst geen orders en beoordeelt geen beschikbare cash of bedrijfskwaliteit.</p>}
  </div>
}
