import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowClockwiseRegular,
  PlugConnectedRegular,
  ShieldKeyholeRegular,
  StopRegular,
} from '@fluentui/react-icons'
import type { IbkrConnectionStatus, IbkrLiveSnapshot } from './types'

interface IbkrConnectionControlProps {
  onSnapshot: (snapshot: IbkrLiveSnapshot) => void
}

const statusLabel: Record<IbkrConnectionStatus['state'], string> = {
  offline: 'IBKR niet verbonden',
  refreshing: 'Alle actuele gegevens ophalen',
  awaiting_mfa: 'IB Key bevestigen',
  connected: 'IBKR verbonden',
  error: 'Koppeling mislukt',
  stopping: 'Synchronisatie stoppen…',
  stopped: 'Synchronisatie gestopt',
}

function formatUpdateTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function IbkrConnectionControl({ onSnapshot }: IbkrConnectionControlProps) {
  const [status, setStatus] = useState<IbkrConnectionStatus>({
    state: 'offline',
    message: 'Koppeling wordt gecontroleerd.',
    lastUpdatedAt: null,
    isBusy: false,
  })
  const [isAvailable, setIsAvailable] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState('')
  const appliedSnapshotAt = useRef<string | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    const response = await fetch('/api/ibkr/snapshot', { cache: 'no-store' })
    if (!response.ok) return
    const snapshot = (await response.json()) as IbkrLiveSnapshot
    if (!Number.isFinite(Date.parse(snapshot.generatedAt)) || !Number.isFinite(snapshot.netLiquidation)
      || !Array.isArray(snapshot.positions) || typeof snapshot.currency !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOfDate)) return
    if (appliedSnapshotAt.current && snapshot.generatedAt <= appliedSnapshotAt.current) return
    appliedSnapshotAt.current = snapshot.generatedAt
    setSnapshotAt(snapshot.generatedAt)
    onSnapshot(snapshot)
  }, [onSnapshot])

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/ibkr/status', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextStatus = (await response.json()) as IbkrConnectionStatus
      setStatus(nextStatus)
      setIsAvailable(true)
      return nextStatus
    } catch {
      setIsAvailable(false)
      setStatus({
        state: 'offline',
        message: 'De IBKR-service is nog niet geïnstalleerd.',
        lastUpdatedAt: null,
        isBusy: false,
      })
      return null
    }
  }, [])

  useEffect(() => {
    void Promise.allSettled([loadStatus(), loadSnapshot()])
  }, [loadStatus, loadSnapshot])

  useEffect(() => {
    const timer = window.setInterval(() => { void Promise.allSettled([loadStatus(), loadSnapshot()]) }, status.isBusy ? 3_000 : 15_000)
    return () => window.clearInterval(timer)
  }, [loadStatus, loadSnapshot, status.isBusy])

  const handleRefresh = async () => {
    setStopError('')
    try {
      setStatus((current) => ({
        ...current,
        state: 'refreshing',
        message: 'Saldo, posities, trades en dashboardresultaten worden bijgewerkt.',
        isBusy: true,
      }))
      const response = await fetch('/api/ibkr/refresh', {
        method: 'POST',
        headers: { 'X-Requested-With': 'trading-monitor' },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message || `HTTP ${response.status}`)
      }
      setIsAvailable(true)
      setStatus((await response.json()) as IbkrConnectionStatus)
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'De IBKR-koppeling is mislukt.',
        lastUpdatedAt: status.lastUpdatedAt,
        isBusy: false,
      })
    }
  }

  const handleStop = async () => {
    setStopping(true); setStopError('')
    try {
      const response = await fetch('/api/ibkr/stop', {
        method: 'POST', headers: { 'X-Requested-With': 'trading-monitor' },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw Error(body?.message || (response.status === 404 ? 'Werk de server bij om synchronisaties te kunnen stoppen.' : 'Synchronisatie kon niet worden gestopt. Probeer opnieuw.'))
      setStatus(body as IbkrConnectionStatus)
    } catch (error) { setStopError((error as Error).message) }
    finally { setStopping(false) }
  }

  const updateTime = formatUpdateTime(snapshotAt ?? status.lastUpdatedAt)
  const buttonLabel = status.state === 'error' ? 'Opnieuw proberen' : status.state === 'connected' ? 'Vernieuwen' : 'Verbinden'
  const StatusIcon = status.state === 'awaiting_mfa' ? ShieldKeyholeRegular : PlugConnectedRegular

  return (
    <section className={`ibkr-control ibkr-control--${status.state}`} aria-label="IBKR-koppeling">
      <div className="ibkr-control__status" role="status" aria-live="polite">
        <StatusIcon aria-hidden="true" />
        <span>
          <strong>{statusLabel[status.state]}</strong>
          <small>{status.state === 'stopped' || status.state === 'stopping' ? status.message : updateTime ? `Laatste synchronisatie ${updateTime}` : status.message}</small>
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={status.isBusy || stopping || !isAvailable}
        title={!isAvailable ? 'Installeer eerst de IBKR-backendservice' : status.message}
      >
        <ArrowClockwiseRegular className={status.isBusy ? 'ibkr-control__spinner' : undefined} aria-hidden="true" />
        <span>{status.isBusy ? 'Even wachten' : buttonLabel}</span>
      </button>
      {status.isBusy && <button type="button" onClick={() => void handleStop()} disabled={stopping || status.canStop === false || !isAvailable}
        title={status.canStop === false ? 'De sessie wordt al afgerond of gestopt.' : 'Onderbreek alleen de lopende synchronisatie.'}>
        <StopRegular aria-hidden="true" /><span>{stopping || status.state === 'stopping' ? 'Stoppen…' : 'Synchronisatie stoppen'}</span>
      </button>}
      {status.isBusy && <p className="ibkr-control__note">Stoppen onderbreekt deze sessie. Gateway en automatische planning blijven actief; een verstuurd IB Key-verzoek blijft mogelijk zichtbaar.</p>}
      {stopError && <p className="ibkr-control__note" role="alert">{stopError}</p>}
    </section>
  )
}
