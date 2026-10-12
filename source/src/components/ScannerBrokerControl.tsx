import { useEffect, useState } from 'react'
import { scannerRequest } from '../api/breakout'
import { defaultBrokerPort } from '../utils/leader-selection'
import type { BrokerConfig, BrokerStatus } from '../types/breakout'

export default function ScannerBrokerControl({
  disabled,
}: {
  disabled: boolean
}) {
  const [status, setStatus] = useState<BrokerStatus | null>(null),
    [config, setConfig] = useState<BrokerConfig | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false),
    [success, setSuccess] = useState('')
  useEffect(() => {
    let active = true
    const load = () =>
      scannerRequest<BrokerStatus>('broker/status')
        .then((data) => {
          if (active) setStatus(data)
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    void load()
    void scannerRequest<{ broker: BrokerConfig }>('settings')
      .then((s) => {
        if (active) setConfig(s.broker)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    const timer = setInterval(load, 4000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])
  async function action(path: string, body?: BrokerConfig) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await scannerRequest(path, {
        method: path.startsWith('settings') ? 'PUT' : 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      setStatus(await scannerRequest<BrokerStatus>('broker/status'))
      if (body)
        setSuccess('Verbindingsinstellingen opgeslagen. Verbind opnieuw.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="bo-panel bo-settings" aria-label="Scannerverbinding">
      <div className="bo-heading">
        <div>
          <strong>Read-only — geen orderuitvoering</strong>
          <p className="bo-muted" aria-live="polite">
            {status?.message ?? 'Scannerverbinding laden…'} ·{' '}
            {status?.mode === 'live' ? 'Liveomgeving' : 'Paperomgeving'} ·{' '}
            {status?.retries ?? 0} retries
          </p>
        </div>
        <div className="bo-actions">
          <button
            disabled={busy || disabled || !config}
            onClick={() =>
              void action(
                status?.connected ? 'broker/disconnect' : 'broker/connect',
              )
            }
          >
            {status?.connected ? 'Scanner loskoppelen' : 'Scanner verbinden'}
          </button>
          <button onClick={() => setEditing(!editing)} aria-expanded={editing}>
            Verbinding instellen
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="bo-error">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {editing && config && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void action('settings/broker', config)
          }}
        >
          <div className="bo-details">
            <label>
              IBKR-applicatie
              <select
                aria-label="IBKR-applicatie"
                value={config.application}
                onChange={(e) => {
                  const application = e.target
                    .value as BrokerConfig['application']
                  setConfig({
                    ...config,
                    application,
                    port: defaultBrokerPort(application, config.mode),
                  })
                }}
              >
                <option value="gateway">IB Gateway</option>
                <option value="tws">Trader Workstation</option>
              </select>
            </label>
            <label>
              Omgeving
              <select
                aria-label="Omgeving"
                value={config.mode}
                onChange={(e) => {
                  const mode = e.target.value as BrokerConfig['mode']
                  setConfig({
                    ...config,
                    mode,
                    port: defaultBrokerPort(config.application, mode),
                  })
                }}
              >
                <option value="paper">Paper trading</option>
                <option value="live">Live marktdata · read-only</option>
              </select>
            </label>
            <label>
              Host
              <input
                aria-label="Brokerhost"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                required
              />
            </label>
            <label>
              Poort
              <input
                aria-label="Brokerpoort"
                type="number"
                min="1"
                max="65535"
                value={config.port}
                onChange={(e) =>
                  setConfig({ ...config, port: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Client-ID
              <input
                aria-label="Broker client-ID"
                type="number"
                min="1"
                value={config.client_id}
                onChange={(e) =>
                  setConfig({ ...config, client_id: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Koersbasis
              <select
                aria-label="Koersbasis"
                value={config.what_to_show}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    what_to_show: e.target
                      .value as BrokerConfig['what_to_show'],
                  })
                }
              >
                <option value="TRADES">
                  TRADES · splits, geen dividendcorrectie
                </option>
                <option value="ADJUSTED_LAST">
                  ADJUSTED_LAST · splits en dividendcorrectie
                </option>
              </select>
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              checked={config.delayed_data}
              onChange={(e) =>
                setConfig({ ...config, delayed_data: e.target.checked })
              }
            />{' '}
            Vertraagde marktdata aanvragen indien beschikbaar
          </label>
          <p className="bo-muted">
            Geen gebruikersnaam of wachtwoord nodig: meld je zelf aan in TWS /
            Gateway. Marktdatarechten blijven vereist. Een andere koersbasis
            gebruikt een afzonderlijke cache.
          </p>
          <button disabled={busy || disabled} type="submit">
            Verbindingsinstellingen opslaan
          </button>
        </form>
      )}
    </section>
  )
}
