import { useEffect, useState } from 'react'
import { ArrowSyncRegular } from '@fluentui/react-icons'
import './sync-log.css'

const sources: Record<string, string> = { manual: 'Appverzoek', scheduled: 'Uurlijkse taak', startup: 'API-opstart', background: 'Achtergrondcontrole' }
const events: Record<string, string> = {
  started: 'Gestart', gateway_start: 'Gateway-start aangevraagd', awaiting_mfa: 'Wachten op verbinding / IB Key',
  stop_requested: 'Stop aangevraagd', cancelled: 'Gestopt', completed: 'Geslaagd', offline: 'Offline', failed: 'Mislukt', timed_out: 'Verlopen', skipped: 'Overgeslagen', interrupted: 'Onderbroken',
}
interface LogEntry { sessionId: string; at: string; source: string; event: string; message: string }
interface LogData { entries: LogEntry[]; retained: number; limit: number; storageError: string | null }
const formatTime = (at: string) => new Intl.DateTimeFormat('nl-NL', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date(at))

export default function SyncLogPage() {
  const [data, setData] = useState<LogData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [source, setSource] = useState('all')
  const [session, setSession] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const response = await fetch('/api/ibkr/logs', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw Error(response.status === 404 ? 'Het logboek is nog niet beschikbaar op deze server. Werk de server bij naar versie 0.43.2 of hoger.' : 'Het logboek kon niet worden geladen.')
        const next: LogData = await response.json()
        if (!Array.isArray(next.entries) || next.entries.some(e => !sources[e.source] || !events[e.event] || !Number.isFinite(Date.parse(e.at)))) throw Error('De server gaf geen geldig logboek terug.')
        if (!controller.signal.aborted) { setData(next); setError('') }
      } catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message) }
      finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(() => void load(), 5000) }
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry])
  const entries = data?.entries.filter(entry => (source === 'all' || entry.source === source) && (!session || entry.sessionId.includes(session.trim()))) ?? []
  return <section className="monitor-panel sync-log" aria-labelledby="sync-log-title">
    <div className="monitor-panel__header"><h2 id="sync-log-title">IBKR-synchronisatielogboek</h2>
      <button type="button" className="scan-button" disabled={loading} onClick={() => { setLoading(true); setRetry(n => n + 1) }}><ArrowSyncRegular aria-hidden="true" />{loading ? 'Laden…' : 'Logboek vernieuwen'}</button>
    </div>
    <p>Handmatige en automatische sessies, Gateway-startverzoeken en resultaten. Tijden zijn in Nederlandse tijd (Europe/Amsterdam). Wordt elke vijf seconden bijgewerkt.</p>
    <p className="monitor-note">Een Gateway-start kan een IB Key-verzoek veroorzaken. Dit logboek bevestigt niet dat een melding op je telefoon is aangekomen. De bron is een technische aanduiding, geen bewijs van wie het verzoek deed.</p>
    <div className="sync-log-filters">
      <div><label htmlFor="sync-source">Bron</label><select id="sync-source" value={source} onChange={e => setSource(e.target.value)}><option value="all">Alle bronnen</option>{Object.entries(sources).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></div>
      <div><label htmlFor="sync-session">Sessie zoeken</label><input id="sync-session" value={session} onChange={e => setSession(e.target.value)} placeholder="Sessie-ID" /></div>
      {(source !== 'all' || session) && <button type="button" className="scan-button" onClick={() => { setSource('all'); setSession('') }}>Filters wissen</button>}
    </div>
    {error && <div className="state-panel state-panel--error" role="alert"><p>{error}{data ? ' De laatst geladen regels blijven zichtbaar.' : ''}</p><button type="button" className="scan-button" onClick={() => { setLoading(true); setRetry(n => n + 1) }}>Opnieuw laden</button></div>}
    {data?.storageError && <p className="state-panel state-panel--error" role="alert">{data.storageError}</p>}
    <p role="status" aria-live="polite" className="monitor-note">{loading ? 'Logboek laden…' : data ? `${entries.length} regels getoond van de laatste ${data.entries.length}. ${data.retained} regels bewaard, maximaal ${data.limit}.` : 'Geen logboek geladen.'}</p>
    {data && entries.length === 0 && <p>{data.entries.length ? 'Geen regels voor deze filters. Wis de filters om alle recente regels te zien.' : 'Nog geen synchronisaties vastgelegd. Nieuwe sessies verschijnen hier automatisch; eerdere sessies kunnen niet worden teruggehaald.'}</p>}
    {entries.length > 0 && <div className="sync-log-table" role="region" aria-label="Synchronisatiegebeurtenissen" tabIndex={0}><table>
      <caption className="visually-hidden">Laatste synchronisatiegebeurtenissen, nieuwste eerst</caption>
      <thead><tr><th scope="col">Tijdstip</th><th scope="col">Bron</th><th scope="col">Gebeurtenis</th><th scope="col">Toelichting</th><th scope="col">Sessie</th></tr></thead>
      <tbody>{entries.map((entry, index) => <tr key={`${entry.sessionId}-${entry.event}-${index}`}>
        <td><time dateTime={entry.at}>{formatTime(entry.at)}</time></td><td>{sources[entry.source]}</td><td>{events[entry.event]}</td><td>{entry.message}</td><td><code>{entry.sessionId}</code></td>
      </tr>)}</tbody>
    </table></div>}
  </section>
}
