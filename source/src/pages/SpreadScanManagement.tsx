import { useEffect, useState } from 'react'
interface Settings { enabled: boolean; stockDay: number; stockTime: string; ivAtMarketOpen: boolean; timeZone?: string }
interface Schedule { settings: Settings; state: string; running?: boolean; phase?: string; message?: string; finishedAt?: string; storageError?: string }
const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
export default function SpreadScanManagement({ disabled, refresh, onRunning, onBlock }: { disabled: boolean; refresh: number; onRunning: (running: boolean) => void; onBlock: (symbol: string, blocked: boolean) => Promise<void> }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null), [settings, setSettings] = useState<Settings | null>(null)
  const [blocked, setBlocked] = useState<{ symbol: string; blockedAt: string }[]>([]), [ticker, setTicker] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => { onRunning(!!schedule?.running) }, [schedule?.running, onRunning])
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const responses = await Promise.all(['/api/put-spreads/schedule', '/api/put-spreads/blocked'].map(url => fetch(url, { cache: 'no-store', signal: controller.signal })))
        const [planning, blocklist] = await Promise.all(responses.map(async response => { const data = await response.json(); if (!response.ok || data.storageError) throw Error(data.message || data.storageError || 'Scaninstellingen niet bereikbaar.'); return data }))
        if (controller.signal.aborted) return
        setSchedule(planning); setSettings(value => value || planning.settings); setBlocked(blocklist.entries); setError('')
        timer = setTimeout(() => void load(), 5000)
      } catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message) }
    }
    void load(); return () => { controller.abort(); clearTimeout(timer) }
  }, [refresh, retry])
  async function save() {
    setBusy(true); setNotice(''); setError('')
    try {
      const response = await fetch('/api/put-spreads/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify(settings) }), data = await response.json()
      if (!response.ok) throw Error(data.message)
      setSchedule(data); setSettings(data.settings); setNotice('Weekplanning opgeslagen.')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <div className="spreads-management">
    <section className="monitor-panel stock-filter-panel"><h2>Weekplanning</h2>
      <p>Stock Filter op zondag; IV Scan vanaf maandag bij de eerstvolgende Amerikaanse beursopening (09:30 New York). De Option Scan start je handmatig. De API-server moet aanstaan; je browser mag gesloten zijn.</p>
      {settings && <form onSubmit={event => { event.preventDefault(); void save() }}><fieldset className="stock-filter-fields" disabled={disabled || busy || schedule?.running}>
        <legend>Wekelijkse uitvoering</legend>
        <label className="spreads-checkbox"><input type="checkbox" checked={settings.enabled} onChange={event => setSettings({ ...settings, enabled: event.target.checked })} />Weekplanning ingeschakeld</label>
        <label>Dag Stock Filter<select aria-label="Dag Stock Filter" value={settings.stockDay} onChange={event => setSettings({ ...settings, stockDay: Number(event.target.value) })}>{days.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
        <label>Tijd Stock Filter (Nederland)<input aria-label="Tijd Stock Filter (Nederland)" type="time" required value={settings.stockTime} onChange={event => setSettings({ ...settings, stockTime: event.target.value })} /></label>
        <label className="spreads-checkbox"><input type="checkbox" checked={settings.ivAtMarketOpen} onChange={event => setSettings({ ...settings, ivAtMarketOpen: event.target.checked })} />IV Scan bij de volgende beursopening</label>
      </fieldset><button type="submit" disabled={disabled || busy || schedule?.running}>Weekplanning opslaan</button></form>}
      {schedule && <p role="status">{schedule.settings.enabled ? `Actief: ${days[schedule.settings.stockDay].toLowerCase()} ${schedule.settings.stockTime} Nederlandse tijd.` : 'Weekplanning uitgeschakeld.'} {schedule.running ? `Weekscan bezig: ${schedule.phase === 'iv' ? 'IV Scan' : 'Stock Filter'}.` : schedule.message}</p>}
      {schedule?.finishedAt && <p>Laatste uitvoering: {new Date(schedule.finishedAt).toLocaleString('nl-NL')}.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Scaninstellingen opnieuw laden</button></div>}
    </section>
    <section className="monitor-panel stock-filter-panel"><h2>Geblokkeerde Stocks</h2><p>Verwijderen uit een scan blokkeert het aandeel in alle drie de stappen en toekomstige weekscans. Deblokkeren maakt het weer beschikbaar.</p>
      <form onSubmit={event => { event.preventDefault(); void onBlock(ticker, true).then(() => setTicker('')).catch(cause => setError(cause.message)) }}><div className="spreads-toolbar"><label htmlFor="blocked-stock-input">Ticker blokkeren<input id="blocked-stock-input" value={ticker} required disabled={disabled || !schedule} onChange={event => setTicker(event.target.value.toUpperCase())} placeholder="Bijvoorbeeld TSLA" /></label><button disabled={disabled || !ticker.trim() || !schedule}>Stock blokkeren</button></div></form>
      {!blocked.length ? <p>Geen geblokkeerde stocks.</p> : <div className="scan-table-scroll" role="region" aria-label="Geblokkeerde Stocks" tabIndex={0}><table className="scan-table"><thead><tr><th>Aandeel</th><th>Geblokkeerd op</th><th>Actie</th></tr></thead><tbody>{blocked.map(row => <tr key={row.symbol}><th scope="row">{row.symbol}</th><td>{new Date(row.blockedAt).toLocaleString('nl-NL')}</td><td><button disabled={disabled} onClick={() => void onBlock(row.symbol, false).catch(cause => setError(cause.message))}>Deblokkeer {row.symbol}</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
