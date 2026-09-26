import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowClockwiseRegular,
  PlugConnectedRegular,
  ShieldKeyholeRegular,
} from '@fluentui/react-icons'
import type { IbkrConnectionStatus, IbkrLiveSnapshot } from './types'

interface IbkrConnectionControlProps {
  onSnapshot: (snapshot: IbkrLiveSnapshot) => void
}

const statusLabel: Record<IbkrConnectionStatus['state'], string> = {
  offline: 'IBKR niet verbonden',
  refreshing: 'Posities ophalen',
  awaiting_mfa: 'IB Key bevestigen',
  connected: 'IBKR verbonden',
  error: 'Koppeling mislukt',
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
  const appliedSnapshotAt = useRef<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    const response = await fetch('/api/ibkr/snapshot', { cache: 'no-store' })
    if (!response.ok) return
    const snapshot = (await response.json()) as IbkrLiveSnapshot
    if (snapshot.generatedAt === appliedSnapshotAt.current) return
    appliedSnapshotAt.current = snapshot.generatedAt
    onSnapshot(snapshot)
  }, [onSnapshot])

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/ibkr/status', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextStatus = (await response.json()) as IbkrConnectionStatus
      setStatus(nextStatus)
      setIsAvailable(true)
      if (nextStatus.state === 'connected') await loadSnapshot()
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
  }, [loadSnapshot])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!status.isBusy) return
    const timer = window.setInterval(() => void loadStatus(), 3_000)
    return () => window.clearInterval(timer)
  }, [loadStatus, status.isBusy])

  const handleRefresh = async () => {
    try {
      setStatus((current) => ({
        ...current,
        state: 'refreshing',
        message: 'IBKR Gateway en posities worden gecontroleerd.',
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

  const updateTime = formatUpdateTime(status.lastUpdatedAt)
  const buttonLabel = status.state === 'error' ? 'Opnieuw proberen' : status.state === 'connected' ? 'Vernieuwen' : 'Verbinden'
  const StatusIcon = status.state === 'awaiting_mfa' ? ShieldKeyholeRegular : PlugConnectedRegular

  return (
    <section className={`ibkr-control ibkr-control--${status.state}`} aria-label="IBKR-koppeling">
      <div className="ibkr-control__status" role="status" aria-live="polite">
        <StatusIcon aria-hidden="true" />
        <span>
          <strong>{statusLabel[status.state]}</strong>
          <small>{updateTime ? `Bijgewerkt ${updateTime}` : status.message}</small>
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={status.isBusy || !isAvailable}
        title={!isAvailable ? 'Installeer eerst de IBKR-backendservice' : status.message}
      >
        <ArrowClockwiseRegular className={status.isBusy ? 'ibkr-control__spinner' : undefined} aria-hidden="true" />
        <span>{status.isBusy ? 'Even wachten' : buttonLabel}</span>
      </button>
    </section>
  )
}
