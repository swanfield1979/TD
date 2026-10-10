import { useEffect, useState } from 'react'
import { matchingCandidates, sortCandidates, type CspCandidate } from '../shared/csp-scan.mjs'
import { scanResponse, scanWarningSummary } from '../shared/scan-feedback.mjs'

interface ScanResult {
  state: 'idle' | 'running' | 'complete' | 'partial' | 'error'
  portfolio: CspCandidate[]; market: CspCandidate[]; warnings: string[]; progress: string
  symbolsChecked: number; contractsChecked: number; message?: string; startedAt?: string; finishedAt?: string
  portfolioSymbols?: string[]; marketSymbols?: number; portfolioAsOfDate?: string
}
const usd = (value: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'USD' }).format(value)
const number = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
const date = (value: string) => new Date(value).toLocaleString('nl-NL')
const empty: ScanResult = { state: 'idle', portfolio: [], market: [], warnings: [], progress: '', symbolsChecked: 0, contractsChecked: 0 }

function ScanTable({ title, rows, running, sort }: { title: string; rows: CspCandidate[]; running: boolean; sort: 'annualizedYield' | 'premium' | 'yieldPercentage' }) {
  return <section className="monitor-panel scan-results">
    <div className="monitor-panel__header"><h2>{title}</h2><span>{rows.length} passende CSP’s</span></div>
    {rows.length === 0 ? <p className="monitor-empty">{running ? 'Deze lijst wordt tijdens de scan aangevuld.' : 'Geen aantoonbare matches. Start een scan of controleer de meldingen over ontbrekende data.'}</p> :
      <div className="scan-table-scroll" tabIndex={0} role="region" aria-label={title}>
        <table className="scan-table">
          <thead><tr><th scope="col">Aandeel</th><th scope="col">Koers</th><th scope="col">Expiratie / DTE</th><th scope="col">Strike</th><th scope="col">|Delta| / POP</th><th scope="col">IVR</th><th scope="col">Bied / laat</th><th scope="col" aria-sort={sort === 'premium' ? 'descending' : undefined}>Premie¹</th><th scope="col">Onderpand¹</th><th scope="col" aria-sort={sort === 'yieldPercentage' ? 'descending' : undefined}>Rendement</th><th scope="col" aria-sort={sort === 'annualizedYield' ? 'descending' : undefined}>Per jaar²</th><th scope="col">Koersdata</th></tr></thead>
          <tbody>{sortCandidates(rows, sort).map((row) => <tr key={row.id}>
            <th scope="row"><strong>{row.symbol}</strong><small>{row.universe ?? 'Portfolio'}</small></th>
            <td>{usd(row.underlyingPrice)}</td><td>{row.expiry.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3-$2-$1')}<small>{row.dte} dagen</small></td>
            <td>{usd(row.strike)}</td><td>{number(row.absoluteDelta)}<small>{number(row.pop)}%</small></td><td>{number(row.ivr)}</td>
            <td>{usd(row.bid)} / {usd(row.ask)}</td><td>{usd(row.premium)}</td><td>{usd(row.collateral)}</td>
            <td>{number(row.yieldPercentage)}%</td><td>{number(row.annualizedYield)}%</td>
            <td>{({ 1: 'Live', 2: 'Bevroren', 3: 'Vertraagd', 4: 'Vertraagd / bevroren' } as Record<number, string>)[row.marketDataType] ?? 'Onbekend'}<small>Opgehaald {date(row.quotedAt)}</small></td>
          </tr>)}</tbody>
        </table>
      </div>}
  </section>
}

export default function ScansPage() {
  const [result, setResult] = useState<ScanResult>(empty)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sort, setSort] = useState<'annualizedYield' | 'premium' | 'yieldPercentage'>('annualizedYield')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        const response = await fetch('/api/scans', { cache: 'no-store', signal: controller.signal })
        const data = await scanResponse(response) as ScanResult
        setResult(data); setError(null)
        if (data.state === 'running') timer = setTimeout(() => void load(), 3000)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Scans niet bereikbaar. Controleer de server-API.')
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry])

  const start = async () => {
    setSubmitting(true); setError(null)
    try {
      const response = await fetch('/api/scans', { method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' } })
      setResult(await scanResponse(response) as ScanResult)
      setRetry((value) => value + 1)
    } catch (error) { setError(error instanceof Error ? error.message : 'De scan kon niet starten. Controleer de server-API.') }
    finally { setSubmitting(false) }
  }
  const running = result.state === 'running'
  const portfolioMatches = matchingCandidates(result.portfolio)
  const marketMatches = matchingCandidates(result.market, undefined, true)
  return <div className="scans-page">
    <section className="monitor-panel">
      <div className="monitor-panel__header"><div><h2>Cash-secured puts zoeken</h2><p className="monitor-note">Eerst je bestaande onderliggende waarden, daarna interessante NASDAQ / S&P 500-aandelen van $ 10–$ 50.</p></div>
        <button className="scan-button" type="button" onClick={() => void start()} disabled={running || submitting}>{running || submitting ? 'Scan bezig…' : 'Start scan'}</button></div>
      <ul className="scan-criteria" aria-label="CSP-criteria"><li>35–50 dagen</li><li>|Delta| 0,16–0,22</li><li>IVR &gt; 30</li><li>Put OTM: strike &lt; koers</li><li>POP &gt; 80%</li></ul>
      <p className="monitor-note">POP = (1 − |delta|) × 100%. Daardoor is de effectieve delta 0,16 tot onder 0,20. IVR gebruikt de actuele IV en het bereik van de afgelopen 12 maanden.</p>
      <div className="scan-command"><label htmlFor="scan-sort">Sorteer op</label><select id="scan-sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="annualizedYield">Jaarrendement, hoogste eerst</option><option value="yieldPercentage">Rendement op onderpand</option><option value="premium">Premie per contract</option></select></div>
      <p role="status" aria-live="polite">{running ? 'CSP-criteria worden gecontroleerd…' : result.state === 'idle' ? 'Klaar om te scannen' : result.state === 'error' ? result.message : result.state === 'partial' ? 'Scan afgerond met ontbrekende data; zie meldingen.' : 'Scan afgerond'}{result.startedAt && <> · Gestart {date(result.startedAt)}</>}{result.finishedAt && <> · Afgerond {date(result.finishedAt)}</>}</p>
      {result.startedAt && <p className="monitor-note">{result.symbolsChecked} aandelen en {result.contractsChecked} contracten gecontroleerd.{result.portfolioAsOfDate && <> Portfoliobasis t/m {result.portfolioAsOfDate}.</>} Alleen CSP’s die aan alle criteria voldoen worden getoond.</p>}
      <p className="monitor-note">De marktverkenning gebruikt maximaal 50 NASDAQ- en 50 Amerikaanse IBKR-scannerresultaten met de hoogste IV, met terugval naar actieve aandelen als de IV-scanner niet beschikbaar is. Amerikaanse resultaten worden getoetst aan de S&P 500-ledenlijst. Dit is een shortlist, geen volledige marktscan. Ontbrekende koersdata, Greeks of IVR worden overgeslagen.</p>
    </section>
    {error && <section className="state-panel state-panel--error" role="alert"><p>{error}</p><button type="button" disabled={submitting || running} onClick={() => void start()}>Scan opnieuw starten</button></section>}
    <ScanTable title="CSP’s op je portfolio" rows={portfolioMatches} running={running} sort={sort} />
    <ScanTable title="Interessante NASDAQ / S&P 500-aandelen" rows={marketMatches} running={running} sort={sort} />
    <p className="monitor-note">¹ Eén standaardcontract: 100 aandelen. Premie = biedprijs × 100; onderpand = strike × 100, vóór kosten. ² Lineair geannualiseerd: premie / onderpand × 365 / DTE. POP is jouw delta-benadering. De scan controleert geen beschikbare cash en plaatst geen orders.</p>
    {result.warnings.length > 0 && <section className="monitor-panel" aria-label="Dekking en marktdata"><p>{result.warnings.length} meldingen over onvolledige dekking of ontbrekende marktdata. Kandidaten zonder volledige toetsbare gegevens zijn overgeslagen.</p><ul>{scanWarningSummary(result.warnings).map(({ label, count }) => <li key={label}>{label} ({count})</li>)}</ul></section>}
  </div>
}
