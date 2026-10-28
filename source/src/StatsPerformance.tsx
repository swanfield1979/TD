import { useId, useMemo, useState } from 'react'
import type { ClosedTrade } from './types'
import { realizedPerformance, symbolPerformance } from './stats-analytics'
import './stats-performance.css'

const number = (value: number, digits = 1) => new Intl.NumberFormat('nl-NL', { maximumFractionDigits: digits }).format(value)
const money = (value: number, currency: string, compact = false) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency, currencyDisplay: 'narrowSymbol',
  ...(compact ? { notation: 'compact' as const, maximumFractionDigits: 1 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}).format(value)
const state = (value: number) => `metric--${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`
type Props = { trades: ClosedTrade[]; currency: string; year: string }

export function RealizedPerformance({ trades, currency, year }: Props) {
  const id = useId()
  const result = useMemo(() => realizedPerformance(trades), [trades])
  const start = `${year}-01-01`
  const points = [{ date: start, cumulative: 0 }, ...result.points]
  const minimum = Math.min(0, ...points.map(point => point.cumulative))
  const maximum = Math.max(0, ...points.map(point => point.cumulative))
  const padding = Math.max((maximum - minimum) * .12, 1)
  const low = minimum - padding, high = maximum + padding
  const first = Date.parse(start), end = Date.parse(points.at(-1)!.date)
  const x = (date: string) => 90 + (Date.parse(date) - first) / Math.max(end - first, 86400000) * 640
  const y = (value: number) => 24 + (high - value) / (high - low) * 230
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date)},${y(point.cumulative)}`).join(' ')
  const sum = (label: string, value: number | null) => <div><dt>{label}</dt><dd className={value === null ? undefined : state(value)}>{value === null ? '—' : money(value, currency)}</dd></div>
  return <div className="stats-performance-layout">
    <section className="stats-panel realized-chart" aria-labelledby={`${id}-title`}>
      <header className="stats-panel__header"><div><span>GESLOTEN OPTIES · {year || 'GEEN HISTORIE'}</span><h2 id={`${id}-title`}>Cumulatief nettoresultaat</h2></div><span className="stats-scope">Na kosten</span></header>
      <div className="realized-chart__headline"><strong className={state(result.total)}>{money(result.total, currency)}</strong><span>{trades.length} sluitingen · {result.points.length} dagen met sluitingen</span></div>
      {!trades.length ? <p className="stats-performance-empty">Nog geen afgesloten optietrades in deze periode.</p> : <>
        <div className="stats-chart-scroll" tabIndex={0} role="region" aria-label="Cumulatief nettoresultaat; horizontaal scrollbaar op smalle schermen">
          <svg className="realized-chart__svg" viewBox="0 0 760 300" role="img" aria-labelledby={`${id}-svg-title ${id}-desc`}>
            <title id={`${id}-svg-title`}>Opgebouwd optieresultaat {year}</title><desc id={`${id}-desc`}>Cumulatieve gerealiseerde winst en verlies na kosten, op sluitingsdatum. Eindresultaat {money(result.total, currency)}. Geen portefeuillerendement.</desc>
            <defs><linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--tm-accent-primary)" stopOpacity=".22"/><stop offset="1" stopColor="var(--tm-accent-primary)" stopOpacity=".01"/></linearGradient></defs>
            {[0, .25, .5, .75, 1].map(ratio => <g key={ratio}><line className="chart-gridline" x1="90" x2="730" y1={24 + ratio * 230} y2={24 + ratio * 230}/><text className="stats-chart-axis" textAnchor="end" x="78" y={28 + ratio * 230}>{money(high - ratio * (high - low), currency, true)}</text></g>)}
            <line className="realized-chart__zero" x1="90" x2="730" y1={y(0)} y2={y(0)}/>
            <path d={`${path} L${x(points.at(-1)!.date)},${y(0)} L90,${y(0)} Z`} fill={`url(#${id}-area)`}/><path d={path} className="chart-line"/>
            {points.filter((_, index) => index === 0 || index === points.length - 1 || (points.length > 5 && index === Math.floor(points.length / 2))).map((point, index, labels) => <text key={`${point.date}-${index}`} className="stats-chart-month" x={x(point.date)} y="285" textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}>{new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(point.date))}</text>)}
          </svg>
        </div>
        <details className="chart-data"><summary>Dagresultaten bekijken</summary><div className="stats-chart-scroll" tabIndex={0} aria-label="Exacte dagresultaten"><table><caption className="visually-hidden">Cumulatief gesloten optieresultaat {year} in {currency}</caption><thead><tr><th scope="col">Datum</th><th scope="col">Netto dagresultaat</th><th scope="col">Cumulatief</th></tr></thead><tbody>{result.points.map(point => <tr key={point.date}><th scope="row">{point.date}</th><td className={state(point.profit)}>{money(point.profit, currency)}</td><td className={state(point.cumulative)}>{money(point.cumulative, currency)}</td></tr>)}</tbody></table></div></details>
      </>}
      <p className="monitor-note">Op sluitingsdatum · long en short opties · exclusief aandelen en open posities. De lijn toont gerealiseerd resultaat, geen rendement op kapitaal.</p>
    </section>
    <aside className="stats-performance-sidebar" aria-label="Resultaatanalyse gesloten opties">
      <section className="stats-panel stats-analysis-card"><h2>Opbouw nettoresultaat</h2><dl>{result.categories.filter(row => row.count).map(row => <div key={row.label}><dt>{row.label}<small>{row.count} sluitingen</small></dt><dd className={state(row.profit)}>{money(row.profit, currency)}</dd></div>)}{!trades.length && <p className="monitor-note">Geen gesloten opties beschikbaar.</p>}</dl><p className="monitor-note">Short calls zijn niet automatisch covered calls; short puts zijn niet automatisch cash secured.</p></section>
      <section className="stats-panel stats-analysis-card"><h2>Winst & verlies</h2><dl>{sum('Som winsttrades', trades.length ? result.totalWins : null)}{sum('Som verliestrades', trades.length ? result.totalLosses : null)}{sum('Gem. winsttrade', result.averageWin)}{sum('Gem. verliestrade', result.averageLoss)}<div><dt>Payoffratio</dt><dd>{result.payoff === null ? '—' : `${number(result.payoff, 2)}×`}</dd></div></dl></section>
      <section className="stats-panel stats-analysis-card"><h2>Terugval & uitersten</h2><dl>{sum('Max. gerealiseerde terugval', trades.length ? result.maxDrawdown : null)}{sum('Beste sluiting', result.best)}{sum('Slechtste sluiting', result.worst)}</dl><p className="monitor-note">Terugval vanaf de hoogste cumulatieve dagstand, vanaf nul. Dit is geen drawdown van het portefeuillesaldo.</p></section>
    </aside>
  </div>
}

type SymbolRow = ReturnType<typeof symbolPerformance>[number]
type SortKey = 'symbol' | 'profit' | 'count' | 'winRate' | 'averageProfit' | 'averageDays' | 'averageReturn'
export function SymbolPerformance({ trades, currency, year }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: 'profit', ascending: false })
  const [query, setQuery] = useState('')
  const rows = useMemo(() => symbolPerformance(trades), [trades])
  const visible = rows.filter(row => `${row.symbol} ${row.name}`.toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => {
    const left = a[sort.key], right = b[sort.key]
    if (left === null) return right === null ? a.symbol.localeCompare(b.symbol) : 1
    if (right === null) return -1
    const order = typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right)
    return (sort.ascending ? order : -order) || a.symbol.localeCompare(b.symbol)
  })
  const header = (label: string, key: SortKey) => <th scope="col" aria-sort={sort.key === key ? sort.ascending ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => setSort(current => ({ key, ascending: current.key === key ? !current.ascending : key === 'symbol' }))}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? ' ↑' : ' ↓' : ' ↕'}</span></button></th>
  const nullable = (value: number | null, suffix = '') => value === null ? '—' : `${number(value)}${suffix}`
  const returnCell = (row: SymbolRow) => <td title={`${row.measuredReturns} van ${row.count} sluitingen met bekend rendement op openingswaarde`}>{nullable(row.averageReturn, '%')}<small>{row.measuredReturns}/{row.count} gemeten</small></td>
  return <section className="stats-panel stats-symbols" aria-labelledby="stats-symbols-title">
    <header className="stats-symbols__header"><div><p className="page-eyebrow">Prestaties per aandeel · {year || 'geen historie'}</p><h2 id="stats-symbols-title">Waar komt je resultaat vandaan?</h2><p className="monitor-note">{visible.length} van {rows.length} aandelen · uitsluitend gesloten opties na kosten</p></div><label>Zoek aandeel<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ticker of bedrijfsnaam" /></label></header>
    <div className="stats-symbols__scroll" tabIndex={0} role="region" aria-label="Prestaties per aandeel; horizontaal scrollbaar">
      <table className="stats-symbols-table"><caption className="visually-hidden">Resultaat van gesloten optietrades per aandeel in {year}, bedragen in {currency}</caption><thead><tr>{header('Aandeel', 'symbol')}{header(`Netto (${currency})`, 'profit')}{header('Sluitingen', 'count')}{header('Winratio', 'winRate')}{header('Gem. per sluiting', 'averageProfit')}{header('Gem. dagen', 'averageDays')}{header('Gem. openingsrendement', 'averageReturn')}<th scope="col">Short puts</th><th scope="col">Short calls</th><th scope="col">Long opties</th></tr></thead><tbody>{visible.map(row => <tr key={row.symbol}><th scope="row"><strong>{row.symbol}</strong></th><td className={state(row.profit)}><strong>{money(row.profit, currency)}</strong></td><td>{row.count}</td><td>{number(row.winRate)}%</td><td className={state(row.averageProfit)}>{money(row.averageProfit, currency)}</td><td title={`${row.measuredDays} van ${row.count} sluitingen met bekende duur`}>{nullable(row.averageDays)}<small>{row.measuredDays}/{row.count} gemeten</small></td>{returnCell(row)}<td>{row.shortPuts}</td><td>{row.shortCalls}</td><td>{row.longOptions}</td></tr>)}</tbody><tfoot><tr><th scope="row">Totaal selectie</th><td className={state(visible.reduce((sum, row) => sum + row.profit, 0))}>{money(visible.reduce((sum, row) => sum + row.profit, 0), currency)}</td><td>{visible.reduce((sum, row) => sum + row.count, 0)}</td><td colSpan={7}/></tr></tfoot></table>
    </div>
    {!visible.length && <p className="stats-performance-empty" role="status">{rows.length ? 'Geen aandelen gevonden. Pas je zoekopdracht aan.' : 'Nog geen gesloten optietrades voor dit jaar.'}</p>}
    <p className="monitor-note">Eén gedeeltelijke sluiting telt als één sluiting. Gemiddelden zijn per sluiting, niet gewogen naar contractaantal. Openingsrendement = nettoresultaat ÷ openingswaarde van de optie; dit is geen rendement op onderpand (ROC). Ontbrekende waarden tellen niet als nul.</p>
  </section>
}
