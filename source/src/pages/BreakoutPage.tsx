import { useEffect, useMemo, useState } from 'react'
import '../breakout.css'

import type {
  BreakoutStock as Stock,
  BreakoutScan as Scan,
} from '../types/breakout'
import StockDetail from '../components/StockDetail'
import { labels, number, percent } from '../utils/breakout-display'
import ScannerBrokerControl from '../components/ScannerBrokerControl'
import { scannerRequest } from '../api/breakout'
import { filterLeaders } from '../utils/leader-selection'

const scanLabels: Record<string, string> = {
  idle: 'Nog niet gescand',
  running: 'Scan loopt',
  complete: 'Scan afgerond',
  partial: 'Gedeeltelijke scan',
  error: 'Scan mislukt',
  cancelled: 'Scan gestopt',
  interrupted: 'Scan onderbroken',
}
export default function BreakoutPage() {
  const [scan, setScan] = useState<Scan | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [top, setTop] = useState<number | null>(2),
    [period, setPeriod] = useState(0),
    [status, setStatus] = useState('all'),
    [search, setSearch] = useState(''),
    [showAll, setShowAll] = useState(false)
  const [sort, setSort] = useState('return0'),
    [descending, setDescending] = useState(true),
    [selected, setSelected] = useState('')
  const [universe, setUniverse] = useState('cached'),
    [symbols, setSymbols] = useState(''),
    [config, setConfig] = useState(''),
    [settings, setSettings] = useState(false)
  const [minPrice, setMinPrice] = useState(0),
    [minDollarVolume, setMinDollarVolume] = useState(0),
    [exchange, setExchange] = useState(''),
    [sector, setSector] = useState(''),
    [notice, setNotice] = useState(''),
    [replaceUniverse, setReplaceUniverse] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  useEffect(() => {
    let active = true,
      initialized = false,
      timer: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        const res = await fetch('/api/breakout', { cache: 'no-store' })
        if (!res.ok)
          throw new Error(`Scanner-API niet bereikbaar (HTTP ${res.status}).`)
        const data: Scan = await res.json()
        if (!active) return
        setScan(data)
        setConnectionError('')
        if (!initialized) {
          setConfig(JSON.stringify(data.config, null, 2))
          setUniverse('cached')
          setSymbols(data.symbols)
          initialized = true
        }
      } catch (e) {
        if (active) setConnectionError((e as Error).message)
      }
      if (active) timer = setTimeout(load, 5000)
    }
    void load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])
  const rows = useMemo(() => {
    return filterLeaders(scan?.rows ?? [], {
      period,
      top,
      showAll,
      status,
      search,
      minPrice,
      minDollarVolume,
      exchange,
      sector,
    }).sort((a, b) => {
      const value = (r: Stock): number | string =>
        sort.startsWith('return')
          ? (r.returns[Number(sort.slice(6))] ?? -Infinity)
          : sort === 'score'
            ? (r.score ?? -Infinity)
            : sort === 'close'
              ? r.close
              : sort === 'status'
                ? labels[r.status]
                : r.symbol
      const av = value(a),
        bv = value(b),
        diff =
          typeof av === 'string'
            ? av.localeCompare(String(bv))
            : av - Number(bv)
      return (descending ? -1 : 1) * diff || a.symbol.localeCompare(b.symbol)
    })
  }, [
    scan,
    period,
    top,
    showAll,
    status,
    search,
    sort,
    descending,
    minPrice,
    minDollarVolume,
    exchange,
    sector,
  ])
  const detail = scan?.rows.find((r) => (r.id ?? r.symbol) === selected)
  const periods = (scan?.config.periods as number[] | undefined) ?? [
    21, 63, 126,
  ]
  const running = scan?.state === 'running'
  async function submit(cancel = false, retry = false, force = false) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = cancel
        ? {}
        : {
            config: JSON.parse(config),
            retry_failed: retry,
            force_refresh: force,
            ...(!retry && universe !== 'cached' ? { universe, symbols } : {}),
          }
      const data = await scannerRequest<Scan>(
        cancel ? 'breakout/cancel' : 'breakout',
        { method: 'POST', body: JSON.stringify(body) },
      )
      setScan(data)
      setSelected('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function uploadUniverse(file: File) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await scannerRequest<{ imported: number; total: number }>(
        `universe/upload?replace=${replaceUniverse}`,
        { method: 'POST', body },
      )
      setUniverse('cached')
      setNotice(
        `${result.imported} aandelen geïmporteerd; ${result.total} in het actieve universum.`,
      )
      setScan(await scannerRequest<Scan>('breakout'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function exportCsv() {
    const headers = [
      'symbol',
      'exchange',
      'currency',
      'company',
      'averageDollarVolume',
      'asOf',
      'close',
      'momentum1',
      'momentum3',
      'momentum6',
      'score',
      'status',
      'movePct',
      'moveStart',
      'moveEnd',
      'moveSessions',
      'baseStart',
      'baseEnd',
      'baseSessions',
      'baseWeeks',
      'baseHigh',
      'baseLow',
      'depthPct',
      'rangeRatio',
      'volatilityRatio',
      'higherLows',
      'tighteningRange',
      'ma10',
      'ma20',
      'ma50',
      'slope10',
      'slope20',
      'slope50',
      'distance10',
      'distance20',
      'distance50',
      'atr20',
      'rangeExpansion',
    ]
    const lines = rows.map((r) => [
      r.symbol,
      r.exchange,
      r.currency,
      r.company,
      r.averageDollarVolume,
      r.asOf,
      r.close,
      ...r.returns,
      r.score,
      r.status,
      r.move?.pct,
      r.move?.start,
      r.move?.end,
      r.move?.sessions,
      r.base?.start,
      r.base?.end,
      r.base?.sessions,
      r.base?.weeks,
      r.base?.high,
      r.base?.low,
      r.base?.depthPct,
      r.base?.rangeRatio,
      r.base?.volatilityRatio,
      r.base?.higherLows,
      r.base?.tighteningRange,
      ...[
        'ma10',
        'ma20',
        'ma50',
        'slope10',
        'slope20',
        'slope50',
        'distance10',
        'distance20',
        'distance50',
        'atr20',
        'rangeExpansion',
      ].map((k) => r.indicators?.[k]),
    ])
    const csv = [headers, ...lines]
      .map((line) =>
        line.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','),
      )
      .join('\r\n')
    const url = URL.createObjectURL(
        new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
      ),
      a = document.createElement('a')
    a.href = url
    a.download = `breakout-${scan?.asOf ?? 'scan'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="breakout-page">
      <div className="bo-heading">
        <div>
          <p className="bo-eyebrow">MARKTLEIDERS · STAIR-STEP SCANNER</p>
          <h2>Sterke aandelen. Geordende bases.</h2>
          <p className="bo-muted">
            Vind leiders over drie vensters en beoordeel impuls, consolidatie en
            range-expansie.
          </p>
        </div>
        <div className="bo-actions">
          <button
            onClick={() => setSettings(!settings)}
            aria-expanded={settings}
          >
            Instellingen
          </button>
          <button
            className="bo-primary"
            disabled={busy || !scan}
            onClick={() => void submit(!!running)}
          >
            {running ? 'Scan stoppen' : 'Scan starten'}
          </button>
        </div>
      </div>
      <ScannerBrokerControl disabled={running} />
      {connectionError && (
        <p className="bo-error" role="alert">
          {connectionError}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="bo-error" role="alert">
          {error}
        </p>
      )}
      <section className="bo-panel bo-source" aria-live="polite">
        <span className={running ? 'bo-lime' : ''}>
          {scanLabels[scan?.state ?? 'idle'] ?? scan?.state}
        </span>
        <span>{scan?.source ?? 'IBKR-historie · geen demokoersen'}</span>
        <span>Peildatum: {scan?.asOf ?? '—'}</span>
        {scan?.finishedAt && (
          <span>
            Bijgewerkt: {new Date(scan.finishedAt).toLocaleString('nl-NL')}
          </span>
        )}
        {running && (
          <>
            <progress value={scan?.progress ?? 0} max={scan?.total || 1} />
            <span>
              {scan?.progress}/{scan?.total} ·{' '}
              {scan?.currentSymbol ?? 'Universum laden'}
            </span>
          </>
        )}
      </section>
      {scan?.message && <p className="bo-error">{scan.message}</p>}
      {settings && (
        <section className="bo-panel bo-settings">
          <h3>Universum en detectiecriteria</h3>
          <p className="bo-muted">
            Alle tickers worden gescand. Toppercentages gelden binnen dit
            universum. Een eerste S&P 500-synchronisatie kan uren duren; daarna
            worden alleen ontbrekende candles opgehaald.
          </p>
          <label>
            Universum
            <select
              aria-label="Universum"
              disabled={running}
              value={universe}
              onChange={(e) => setUniverse(e.target.value)}
            >
              <option value="cached">Opgeslagen CSV-universum</option>
              <option value="sp500">S&P 500 · actuele ledenlijst</option>
              <option value="custom">Eigen USD-aandelenuniversum</option>
            </select>
          </label>
          {universe === 'custom' && (
            <label>
              Tickers
              <textarea
                aria-label="Tickers"
                disabled={running}
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                placeholder="NVDA, APP, PLTR"
              />
            </label>
          )}
          <label>
            Universum-CSV uploaden
            <input
              type="file"
              aria-label="Universum-CSV uploaden"
              accept=".csv,text/csv"
              disabled={busy || running}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadUniverse(file)
                e.target.value = ''
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={replaceUniverse}
              onChange={(e) => setReplaceUniverse(e.target.checked)}
            />{' '}
            Huidig universum vervangen (historie blijft bewaard)
          </label>
          <p className="bo-muted">
            CSV: symbol, exchange, currency; company en sector optioneel.{' '}
            <a href="/data/example-universe.csv" download>
              Download klein voorbeelduniversum
            </a>{' '}
            · geen compleet marktuniversum.
          </p>
          <div className="bo-actions">
            <button
              disabled={busy || running}
              onClick={() => void submit(false, true)}
            >
              Mislukte aandelen opnieuw proberen
            </button>
            <button
              disabled={busy || running}
              onClick={() => void submit(false, false, true)}
            >
              Volledige historie hercontroleren
            </button>
          </div>
          <label>
            Configuratie (JSON)
            <textarea
              aria-label="Configuratie (JSON)"
              className="bo-config"
              disabled={running}
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              spellCheck={false}
            />
          </label>
          <p className="bo-muted">
            Percentages in procentpunten; vensters in handelssessies.
            Wijzigingen gelden bij de volgende scan.{' '}
            <a
              href="https://github.com/swanfield1979/TD/blob/main/docs/breakout-scanner.md"
              target="_blank"
              rel="noreferrer"
            >
              Uitleg van alle criteria
            </a>
          </p>
        </section>
      )}
      <section className="bo-periods" aria-label="Momentumvensters">
        {periods.map((sessions, p) => {
          const count = (scan?.rows ?? []).filter(
            (r) =>
              r.returns[p] !== null && !r.stale && !r.corporateActionReview,
          ).length
          return (
            <button
              key={p}
              className={period === p ? 'active' : ''}
              onClick={() => {
                setPeriod(p)
                setSort(`return${p}`)
                setDescending(true)
              }}
              aria-pressed={period === p}
            >
              <span>
                {['1 maand', '3 maanden', '6 maanden'][p]}
                {sessions !== [21, 63, 126][p] ? ' · aangepast' : ''}
              </span>
              <strong>{top === null ? 'Alle leiders' : `Top ${top}%`}</strong>
              <small>
                {sessions} sessies ·{' '}
                {top === null ? count : Math.ceil((count * top) / 100)} van{' '}
                {count} meetbare aandelen
              </small>
            </button>
          )
        })}
      </section>
      <div className="bo-toolbar">
        <div className="bo-segment" aria-label="Sterkste aandelen">
          {[1, 2, 5, null].map((v) => (
            <button
              key={v ?? 'all'}
              aria-pressed={v === top}
              className={v === top ? 'active' : ''}
              onClick={() => setTop(v)}
            >
              {v === null ? 'Alle leiders' : `Top ${v}%`}
            </button>
          ))}
        </div>
        <label className="visually-hidden" htmlFor="bo-status">
          Setupstatus
        </label>
        <select
          id="bo-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Alle setups</option>
          {Object.entries(labels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="Ticker zoeken"
          placeholder="Ticker zoeken…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />{' '}
          Volledig universum
        </label>
        <button disabled={!rows.length} onClick={exportCsv}>
          CSV exporteren
        </button>
      </div>
      <div className="bo-toolbar">
        <label>
          Minimumprijs
          <input
            aria-label="Minimumprijs"
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label>
          Gem. dollarvolume
          <input
            aria-label="Minimum gemiddeld dollarvolume"
            type="number"
            min="0"
            step="100000"
            value={minDollarVolume}
            onChange={(e) =>
              setMinDollarVolume(Math.max(0, Number(e.target.value)))
            }
          />
        </label>
        <label>
          Beurs
          <select
            aria-label="Beursfilter"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
          >
            <option value="">Alle beurzen</option>
            {[
              ...new Set(scan?.rows.map((r) => r.exchange).filter(Boolean)),
            ].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sector
          <select
            aria-label="Sectorfilter"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="">Alle sectoren</option>
            {[...new Set(scan?.rows.map((r) => r.sector).filter(Boolean))].map(
              (v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          onClick={() => {
            setStatus('all')
            setSearch('')
            setMinPrice(0)
            setMinDollarVolume(0)
            setExchange('')
            setSector('')
          }}
        >
          Filters wissen
        </button>
      </div>
      <p className="bo-muted">
        {rows.length} resultaten · dekking {scan?.rows.length ?? 0}/
        {scan?.totalUniverse ?? scan?.total ?? 0}.{' '}
        {running
          ? 'Ranglijst beschikbaar na afronden.'
          : 'Selectie vóór statusfilter; rendement gerangschikt per gekozen periode.'}
        {scan?.state === 'partial' &&
          ' Toppercentages zijn voorlopig: niet alle aandelen konden worden gemeten.'}
      </p>
      <div className="bo-panel bo-table-wrap">
        <table>
          <thead>
            <tr>
              {[
                ['symbol', 'Aandeel'],
                ['close', 'Slotkoers'],
                ['return0', '1M'],
                ['return1', '3M'],
                ['return2', '6M'],
                ['score', 'Score'],
                ['status', 'Setup'],
              ].map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={
                    sort === key
                      ? descending
                        ? 'descending'
                        : 'ascending'
                      : 'none'
                  }
                >
                  <button
                    onClick={() => {
                      setSort(key)
                      setDescending(
                        sort === key ? !descending : key !== 'symbol',
                      )
                    }}
                  >
                    {label} {sort === key ? (descending ? '↓' : '↑') : ''}
                  </button>
                </th>
              ))}
              <th>Impuls</th>
              <th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id ?? r.symbol}
                className={selected === (r.id ?? r.symbol) ? 'selected' : ''}
              >
                <td>
                  <button
                    className="bo-ticker"
                    onClick={() =>
                      setSelected(
                        selected === (r.id ?? r.symbol)
                          ? ''
                          : (r.id ?? r.symbol),
                      )
                    }
                    aria-expanded={selected === r.symbol}
                  >
                    {r.symbol}
                  </button>
                  <small>
                    Rang {r.ranks?.[period] ?? '—'} · {r.exchange} ·{' '}
                    {r.currency}
                  </small>
                </td>
                <td>
                  {r.currency ?? 'USD'} {number(r.close)}
                </td>
                {r.returns.map((v, p) => (
                  <td
                    key={p}
                    className={v !== null && v >= 0 ? 'bo-lime' : 'bo-negative'}
                  >
                    {percent(v)}
                  </td>
                ))}
                <td>
                  <span className="bo-score">{number(r.score, 0)}</span>
                </td>
                <td>
                  <span className={`bo-status ${r.status}`}>
                    {labels[r.status]}
                  </span>
                </td>
                <td>{percent(r.move?.pct)}</td>
                <td>
                  {r.base
                    ? `${number(r.base.weeks, 1)}w · ${number(r.base.depthPct, 1)}% diep`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="bo-empty">
            <h3>
              {running ? 'Historie ophalen…' : 'Geen leiders in deze selectie'}
            </h3>
            <p>
              {scan?.rows.length
                ? 'Verruim het toppercentage, wijzig het filter of toon het volledige universum.'
                : 'Verbind de scanner hierboven, importeer een universum en start een scan.'}
            </p>
          </div>
        )}
      </div>
      {detail && <StockDetail row={detail} />}
      {!!scan?.warnings.length && (
        <details className="bo-panel bo-warnings">
          <summary>{scan.warnings.length} datameldingen</summary>
          <ul>
            {scan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <section className="bo-panel bo-explanation">
        <p className="bo-eyebrow">HET STAIR-STEP PATROON</p>
        <h2>Impuls. Rust. Volgende impuls.</h2>
        <div className="bo-details">
          <article>
            <h3>01 · Grote voorafgaande beweging</h3>
            <p>
              Zoek een stijging vanaf {String(scan?.config.moveMinPct ?? 30)}%
              over meerdere dagen of weken. Ook bewegingen boven 100% tellen
              mee.
            </p>
          </article>
          <article>
            <h3>02 · Geordende consolidatie</h3>
            <p>
              Een basis van {String(scan?.config.baseMinSessions ?? 10)}–
              {String(scan?.config.baseMaxSessions ?? 42)} sessies, met
              ordelijke bodems, een vernauwende range en steun op stijgende
              gemiddelden.
            </p>
          </article>
          <article>
            <h3>03 · Range-expansie</h3>
            <p>
              De laatste afgesloten slotkoers ligt boven de eerdere
              consolidatiehigh en de true range is minimaal{' '}
              {String(scan?.config.expansionRatio ?? 1.3)}× de ATR20 vóór die
              candle.
            </p>
          </article>
        </div>
        <p className="bo-muted">
          Score = gewogen percentielrang over de drie vensters. Topselectie =
          rendement per gekozen venster. Geen handelsorders; dit is een
          selectiehulpmiddel. Dagdata van vandaag wordt conservatief
          uitgesloten.
        </p>
      </section>
    </div>
  )
}
