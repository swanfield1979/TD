import { useEffect, useState } from 'react'
import { ArrowDownloadRegular, ArrowSyncRegular } from '@fluentui/react-icons'
import metadata from '../../package.json'
import './app-update.css'

interface UpdateStatus {
  installedVersion: string; configured: boolean; state: string; busy: boolean; blocked: boolean;
  available?: boolean; latestVersion?: string; installed?: boolean; message?: string; updatedAt?: string; storageError?: string;
}
export default function AppUpdatePage() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [retry, setRetry] = useState(0)
  const [reconnecting, setReconnecting] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let lastBusy = status?.busy ?? false
    let disconnectSince: number | undefined
    async function load() {
      try {
        const response = await fetch('/api/app-update', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw Error(response.status === 404 ? 'De server heeft deze updatefunctie nog niet. Installeer deze versie eenmalig via de terminal.' : 'De updatestatus is tijdelijk niet bereikbaar.')
        const data: UpdateStatus = await response.json()
        if (controller.signal.aborted) return
        if (typeof data.installedVersion !== 'string' || typeof data.busy !== 'boolean') throw Error('De server gaf geen geldige updatestatus terug.')
        lastBusy = data.busy; disconnectSince = undefined
        setStatus(data); setLoadError(''); setReconnecting(false)
      } catch (cause) {
        if (controller.signal.aborted) return
        if (lastBusy) {
          disconnectSince ??= Date.now()
          setReconnecting(true)
          if (Date.now() - disconnectSince > 120000) setLoadError('De server is langer dan twee minuten niet bereikbaar. Controleer de services op de server; de update kan nog bezig zijn.')
        } else setLoadError((cause as Error).message)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void load(), 2000)
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [retry])
  async function start(action: 'check' | 'install') {
    setSubmitting(true); setError('')
    try {
      const response = await fetch('/api/app-update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'trading-monitor' }, body: JSON.stringify({ action }) })
      const data = await response.json()
      if (!response.ok) throw Error(data.message || 'De updateactie kon niet starten.')
      setStatus(data)
      setRetry(value => value + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { setSubmitting(false) }
  }
  const disabled = !status?.configured || status.busy || status.blocked || submitting || !!status.storageError
  return <section className="monitor-panel app-update" aria-labelledby="update-title">
    <div className="monitor-panel__header"><h2 id="update-title">Trading Monitor bijwerken</h2></div>
    <p>Controleer of er een nieuwe versie beschikbaar is en installeer deze vanaf GitHub. De server test en bouwt de versie voordat deze wordt geplaatst.</p>
    <dl className="app-update-versions"><div><dt>Webapp</dt><dd>v{metadata.version}</dd></div><div><dt>Geïnstalleerde server</dt><dd>{status ? `v${status.installedVersion}` : 'Laden…'}</dd></div>{status?.latestVersion && <div><dt>Beschikbaar op GitHub</dt><dd>v{status.latestVersion}</dd></div>}</dl>
    {status && !status.configured && <p className="app-update-notice">De updateservice moet eenmalig op de server worden geïnstalleerd. Daarna kun je hier bijwerken. <a href="https://github.com/swanfield1979/TD/blob/main/docs/app-updates.md" target="_blank" rel="noopener noreferrer">Installatiehandleiding</a></p>}
    {status?.blocked && <p className="app-update-notice">Wacht tot scans en het vernieuwen van IBKR klaar zijn, of stop de scans eerst.</p>}
    <div className="app-update-actions">
      <button className="scan-button" type="button" disabled={disabled} onClick={() => void start('check')}><ArrowSyncRegular aria-hidden="true" />{submitting || status?.busy ? 'Bezig…' : 'Controleren op updates'}</button>
      {status?.available && !status.installed && <button className="scan-button app-update-primary" type="button" disabled={disabled} onClick={() => void start('install')}><ArrowDownloadRegular aria-hidden="true" />Versie {status.latestVersion} installeren</button>}
      {status?.installed && status.state === 'complete' && <button className="scan-button app-update-primary" type="button" onClick={() => window.location.reload()}>Nieuwe versie openen</button>}
    </div>
    <div role="status" aria-live="polite" className="app-update-progress">{status?.busy && <progress aria-label="Applicatie bijwerken" />}{status?.message && <p>{status.message}</p>}{reconnecting && <p>Verbinding herstellen na serverherstart…</p>}</div>
    {(error || loadError || status?.storageError || status?.state === 'error') && <div className="state-panel state-panel--error" role="alert"><p>{error || loadError || status?.storageError || status?.message}</p><button className="scan-button" type="button" onClick={() => { setError(''); setRetry(value => value + 1) }}>Opnieuw laden</button></div>}
    <p className="monitor-note">Tijdens het bijwerken starten er geen nieuwe scans. Een korte onderbreking bij de serverherstart is normaal. Bestaande portefeuille- en scandata blijven bewaard.</p>
  </section>
}
