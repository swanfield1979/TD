import { useEffect, useMemo, useState } from 'react'
import './breakout.css'

type Status = 'forming' | 'ready' | 'breakout' | 'failed' | 'insufficient_data'
type Bar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}
type Stock = {
  symbol: string
  asOf: string
  close: number
  sessions: number
  returns: (number | null)[]
  ranks: (number | null)[]
  score: number | null
  status: Status
  reasons: string[]
  chart: Bar[]
  move: { pct: number; start: string; end: string; sessions: number } | null
  base: {
    start: string
    end: string
    sessions: number
    weeks: number
    high: number
    low: number
    depthPct: number
    rangeRatio: number | null
    volatilityRatio: number | null
    higherLows: boolean | null
    orderlyLows: boolean
    tighteningRange: boolean
    distanceToHighPct: number
  } | null
  indicators: Record<string, number | boolean | null> | null
}
type Scan = {
  state: string
  rows: Stock[]
  warnings: string[]
  progress: number
  total: number
  config: Record<string, unknown>
  universe: string
  symbols: string
  source?: string
  startedAt?: string
  finishedAt?: string
  asOf?: string
  currentSymbol?: string
  message?: string
  staleSymbols?: string[]
}
const labels: Record<Status, string> = {
  forming: 'Basis in vorming',
  ready: 'Consolidatie gereed',
  breakout: 'Breakout actief',
  failed: 'Structuur mislukt',
  insufficient_data: 'Onvoldoende historie',
}
const scanLabels: Record<string, string> = {
  idle: 'Nog niet gescand',
  running: 'Scan loopt',
  complete: 'Scan afgerond',
  partial: 'Gedeeltelijke scan',
  error: 'Scan mislukt',
  cancelled: 'Scan gestopt',
  interrupted: 'Scan onderbroken',
}
const number = (v: number | null | undefined, digits = 2) =>
  v == null
    ? '—'
    : v.toLocaleString('nl-NL', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
const percent = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${number(v, 1)}%`

function PriceChart({ row }: { row: Stock }) {
  const bars = row.chart,
    width = 900,
    height = 260,
    min = Math.min(...bars.map((b) => b.low)),
    max = Math.max(...bars.map((b) => b.high)),
    range = max - min || 1
  const x = (i: number) => 30 + (i / (bars.length - 1 || 1)) * 840,
    y = (v: number) => 230 - ((v - min) / range) * 205
  const line = bars.map((b, i) => `${x(i)},${y(b.close)}`).join(' ')
  const start = row.base
    ? bars.findIndex((b) => b.date === row.base!.start)
    : -1
  const end = row.base ? bars.findIndex((b) => b.date === row.base!.end) : -1
  return (
    <svg
      className="bo-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${row.symbol}: afgesloten dagkoersen en consolidatierange`}
    >
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <line
            x1="30"
            x2="870"
            y1={25 + i * 68}
            y2={25 + i * 68}
            stroke="#2c342b"
          />
          <text x="875" y={30 + i * 68}>
            {number(max - (i * range) / 3, 1)}
          </text>
        </g>
      ))}
      {row.base && start >= 0 && end >= 0 && (
        <g>
          <rect
            x={x(start)}
            y={y(row.base.high)}
            width={x(end) - x(start)}
            height={Math.max(1, y(row.base.low) - y(row.base.high))}
            fill="#c7f36b12"
            stroke="#c7f36b66"
          />
          <line
            x1={x(start)}
            x2="870"
            y1={y(row.base.high)}
            y2={y(row.base.high)}
            stroke="#c7f36b"
            strokeDasharray="5 4"
          />
        </g>
      )}
      {[10, 20, 50].map((period, p) => (
        <polyline
          key={period}
          points={bars
            .flatMap((_, i) =>
              i + 1 < period
                ? []
                : [
                    `${x(i)},${y(bars.slice(i - period + 1, i + 1).reduce((sum, b) => sum + b.close, 0) / period)}`,
                  ],
            )
            .join(' ')}
          fill="none"
          stroke={['#74a7ff', '#e8bd65', '#ba95db'][p]}
          strokeWidth="1.3"
        />
      ))}
      <polyline points={line} fill="none" stroke="#c7f36b" strokeWidth="2" />
      <text x="30" y="254">
        {bars[0]?.date}
      </text>
      <text x="775" y="254">
        {bars.at(-1)?.date}
      </text>
    </svg>
  )
}

function StockDetail({ row }: { row: Stock }) {
  const i = row.indicators,
    b = row.base,
    m = row.move
  return (
    <section
      className="bo-panel bo-detail"
      aria-label={`Setupdetails ${row.symbol}`}
    >
      <div className="bo-heading">
        <h2>
          {row.symbol}{' '}
          <small>
            {row.asOf} · ${number(row.close)}
          </small>
        </h2>
        <span className={`bo-status ${row.status}`}>{labels[row.status]}</span>
      </div>
      <PriceChart row={row} />
      <p className="bo-muted">
        Lime: slotkoers · blauw: MA10 · amber: MA20 · paars: MA50 · kader:
        consolidatie vóór de laatste candle
      </p>
      <div className="bo-details">
        <article>
          <h3>01 · Voorafgaande impuls</h3>
          {m ? (
            <>
              <strong>{percent(m.pct)}</strong>
              <p>
                {m.start} → {m.end}
                <br />
                {m.sessions} handelssessies
              </p>
            </>
          ) : (
            <p>Geen kwalificerende impuls.</p>
          )}
        </article>
        <article>
          <h3>02 · Consolidatie</h3>
          {b ? (
            <dl>
              {Object.entries({
                'Start / einde': `${b.start} / ${b.end}`,
                Duur: `${b.sessions} sessies · ${number(b.weeks, 1)} weken`,
                'High / low': `${number(b.high)} / ${number(b.low)}`,
                Diepte: `${number(b.depthPct, 1)}%`,
                Rangecontractie: `${number(b.rangeRatio)}×`,
                Volatiliteitsratio: `${number(b.volatilityRatio)}×`,
                'Hogere swingbodems':
                  b.higherLows === null
                    ? 'Niet toetsbaar (te weinig pivots)'
                    : b.higherLows
                      ? 'Ja'
                      : 'Nee',
                'Bodems ordelijk': b.orderlyLows ? 'Ja' : 'Nee',
                'Range vernauwt': b.tighteningRange ? 'Ja' : 'Nee',
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Geen consolidatie gevonden.</p>
          )}
        </article>
        <article>
          <h3>03 · Range-expansie</h3>
          {i && (
            <dl>
              {Object.entries({
                'ATR20 vóór laatste bar': number(i.atr20 as number),
                'Laatste true range': number(i.trueRange as number),
                Expansie: `${number(i.rangeExpansion as number)}×`,
                'Volume bevestigd':
                  i.volumeConfirmation === null
                    ? 'Volume ontbreekt'
                    : i.volumeConfirmation
                      ? 'Ja'
                      : 'Nee',
                'Afstand tot high': b
                  ? `${number(b.distanceToHighPct, 1)}%`
                  : '—',
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      </div>
      {i && (
        <div className="bo-table-wrap">
          <table>
            <caption>
              Voortschrijdende gemiddelden · helling gemeten vóór de laatste
              candle
            </caption>
            <thead>
              <tr>
                <th>Gemiddelde</th>
                <th>Waarde</th>
                <th>Helling</th>
                <th>Koersafstand</th>
              </tr>
            </thead>
            <tbody>
              {[10, 20, 50].map((p) => (
                <tr key={p}>
                  <td>MA{p}</td>
                  <td>{number(i[`ma${p}`] as number)}</td>
                  <td>{percent(i[`slope${p}`] as number)}</td>
                  <td>{percent(i[`distance${p}`] as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!row.reasons.length && (
        <ul className="bo-muted">
          {row.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function BreakoutPage() {
  const [scan, setScan] = useState<Scan | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [top, setTop] = useState(2),
    [period, setPeriod] = useState(0),
    [status, setStatus] = useState('all'),
    [search, setSearch] = useState(''),
    [showAll, setShowAll] = useState(false)
  const [sort, setSort] = useState('return0'),
    [descending, setDescending] = useState(true),
    [selected, setSelected] = useState('')
  const [universe, setUniverse] = useState('sp500'),
    [symbols, setSymbols] = useState(''),
    [config, setConfig] = useState(''),
    [settings, setSettings] = useState(false)
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
        setError('')
        if (!initialized) {
          setConfig(JSON.stringify(data.config, null, 2))
          setUniverse(data.universe)
          setSymbols(data.symbols)
          initialized = true
        }
      } catch (e) {
        if (active) setError((e as Error).message)
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
    const all = scan?.rows ?? [],
      eligible = all
        .filter((r) => r.returns[period] !== null)
        .sort(
          (a, b) =>
            b.returns[period]! - a.returns[period]! ||
            a.symbol.localeCompare(b.symbol),
        )
    const leaders = showAll
      ? all
      : eligible.slice(0, Math.ceil((eligible.length * top) / 100))
    return leaders
      .filter(
        (r) =>
          (status === 'all' || r.status === status) &&
          r.symbol.includes(search.toUpperCase()),
      )
      .sort((a, b) => {
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
  }, [scan, period, top, showAll, status, search, sort, descending])
  const detail = scan?.rows.find((r) => r.symbol === selected)
  const periods = (scan?.config.periods as number[] | undefined) ?? [
    21, 63, 126,
  ]
  const running = scan?.state === 'running'
  async function submit(cancel = false) {
    setBusy(true)
    setError('')
    try {
      const body = cancel
        ? {}
        : { config: JSON.parse(config), universe, symbols }
      const res = await fetch(`/api/breakout${cancel ? '/cancel' : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'trading-monitor',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setScan(data)
      setSelected('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function exportCsv() {
    const headers = [
      'symbol',
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
            universum. Een S&P 500-scan kan tientallen minuten duren.
          </p>
          <label>
            Universum
            <select
              aria-label="Universum"
              disabled={running}
              value={universe}
              onChange={(e) => setUniverse(e.target.value)}
            >
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
            (r) => r.returns[p] !== null,
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
              <strong>Top {top}%</strong>
              <small>
                {sessions} sessies · {Math.ceil((count * top) / 100)} van{' '}
                {count} meetbare aandelen
              </small>
            </button>
          )
        })}
      </section>
      <div className="bo-toolbar">
        <div className="bo-segment" aria-label="Sterkste aandelen">
          {[1, 2, 5].map((v) => (
            <button
              key={v}
              aria-pressed={v === top}
              className={v === top ? 'active' : ''}
              onClick={() => setTop(v)}
            >
              Top {v}%
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
      <p className="bo-muted">
        {rows.length} resultaten · dekking {scan?.rows.length ?? 0}/
        {scan?.total ?? 0}.{' '}
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
                key={r.symbol}
                className={selected === r.symbol ? 'selected' : ''}
              >
                <td>
                  <button
                    className="bo-ticker"
                    onClick={() =>
                      setSelected(selected === r.symbol ? '' : r.symbol)
                    }
                    aria-expanded={selected === r.symbol}
                  >
                    {r.symbol}
                  </button>
                  <small>Rang {r.ranks?.[period] ?? '—'}</small>
                </td>
                <td>${number(r.close)}</td>
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
                : 'Verbind IBKR via de koppeling in het menu en start een scan.'}
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
