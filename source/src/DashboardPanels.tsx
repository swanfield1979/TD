import { useId, useState } from 'react'
import { contributionReturn } from '../shared/contribution-return.mjs'
import type { MonthlyTradingResult, PortfolioSummary, PremiumPeriod } from './types'

const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const money = (value: number, currency: string, signed = false) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency, currencyDisplay: 'narrowSymbol', signDisplay: signed ? 'always' : 'auto',
}).format(value)
const compact = (value: number, currency: string) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1,
}).format(value)
const direction = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

export function PortfolioTrend({ summary }: { summary: PortfolioSummary }) {
  const id = useId()
  const latestYear = summary.yearProfit.toDate.slice(0, 4)
  const [year, setYear] = useState(latestYear)
  const history = summary.portfolioHistory ?? []
  const years = [...new Set([...history.map(point => point.month.slice(0, 4)), latestYear])].sort()
  const points = history.filter(point => point.month.startsWith(year))
  const reference = history.filter(point => point.month.startsWith(String(Number(year) - 1)))
  const values = [...points, ...reference].map(point => point.balance)
  const low = Math.min(0, ...values)
  const high = Math.max(1, ...values) * 1.12
  const x = (month: string) => 78 + (Number(month.slice(5, 7)) - 1) / 11 * 660
  const y = (value: number) => 24 + (high - value) / (high - low) * 210
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.month)} ${y(point.balance)}`).join(' ')
  return <section className="monitor-panel trend-panel" aria-labelledby={`${id}-title`}>
    <header className="monitor-panel__header"><h2 id={`${id}-title`}>Portefeuilleverloop</h2>
      <div className="period-buttons" role="group" aria-label="Jaar portefeuilleverloop">{years.map(value =>
        <button key={value} type="button" aria-pressed={year === value} onClick={() => setYear(value)}>{value}</button>)}</div>
    </header>
    <div className="monitor-legend"><span><i /> Saldo {year}</span>{reference.length > 0 && <span><i className="monitor-legend__reference" /> {Number(year) - 1} ter vergelijking</span>}</div>
    {points.length === 0 ? <p className="monitor-empty">Nog geen saldohistorie voor {year}.</p> : <svg viewBox="0 0 770 280" className="monitor-chart" role="img" aria-label={`Maandeindsaldi ${year}; inclusief inleg en open posities`}>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#147d56" stopOpacity=".16" /><stop offset="100%" stopColor="#147d56" stopOpacity=".01" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map(ratio => <g key={ratio}><line className="chart-gridline" x1="78" x2="738" y1={24 + ratio * 210} y2={24 + ratio * 210} /><text className="chart-axis-value" textAnchor="end" x="66" y={28 + ratio * 210}>{compact(high - ratio * (high - low), summary.currency)}</text></g>)}
      {reference.map(point => <rect key={point.month} className="trend-reference" x={x(point.month) - 13} y={Math.min(y(point.balance), y(0))} width="26" height={Math.abs(y(0) - y(point.balance))} rx="3"><title>{point.date}: {money(point.balance, summary.currency)}</title></rect>)}
      <path d={`${path} L ${x(points.at(-1)!.month)} ${y(0)} L ${x(points[0].month)} ${y(0)} Z`} fill={`url(#${id}-fill)`} />
      <path d={path} className="chart-line" />
      {points.map(point => <circle key={point.month} cx={x(point.month)} cy={y(point.balance)} r="4" fill="var(--tm-accent-primary)"><title>{point.date}: {money(point.balance, summary.currency)}</title></circle>)}
      {months.map((label, index) => <text key={label} className="chart-month-label" textAnchor="middle" x={78 + index / 11 * 660} y="265">{label}</text>)}
    </svg>}
    <p className="monitor-note">Maandeindsaldi uit Flex · inclusief inleg en open posities</p>
  </section>
}

export function NetMonthlyResults({ summary }: { summary: PortfolioSummary }) {
  const id = useId()
  const data = summary.monthlyTradingResults ?? []
  const high = Math.max(1, ...data.map(point => Math.abs(point.value))) * 1.12
  const zero = 136
  return <section className="monitor-panel" aria-labelledby={`${id}-title`}>
    <header className="monitor-panel__header"><h2 id={`${id}-title`}>Netto maandresultaat</h2><span className="monitor-year">{summary.yearProfit.toDate.slice(0, 4)}</span></header>
    {data.length === 0 ? <p className="monitor-empty">Importeer Flex-gegevens opnieuw om de maandresultaten te tonen.</p> : <svg viewBox="0 0 770 250" className="monitor-chart" role="img" aria-label="Gerealiseerd nettoresultaat per maand uit premie en aandelen, na kosten">
      {[high, 0, -high].map(value => <g key={value}><line className="chart-gridline" x1="78" x2="738" y1={zero - value / high * 88} y2={zero - value / high * 88} /><text className="chart-axis-value" x="66" y={zero - value / high * 88 + 4} textAnchor="end">{compact(value, summary.currency)}</text></g>)}
      {months.map((label, index) => { const point = data.find(row => Number(row.month.slice(5, 7)) === index + 1); const px = 91 + index / 11 * 630; return <g key={label}>
        {point && <rect x={px - 14} y={Math.min(zero, zero - point.value / high * 88)} width="28" height={Math.max(2, Math.abs(point.value) / high * 88)} rx="3" fill={`var(--tm-status-${point.value > 0 ? 'success' : point.value < 0 ? 'danger' : 'neutral'})`}><title>{label}: {money(point.value, summary.currency, true)} · premie {money(point.premium, summary.premiumCurrency)} · aandelen {money(point.stockSales, summary.currency)}</title></rect>}
        <text className="chart-month-label" x={px} y="245" textAnchor="middle">{label}</text></g> })}
    </svg>}
    <p className="monitor-note">Gerealiseerde premie en aandelen · na commissies · ontbrekende maanden blijven leeg</p>
  </section>
}

export function AnnualGoal({ summary }: { summary: PortfolioSummary }) {
  const plan = summary.goalPlan
  const goal = plan?.years.find(row => row.status === 'current' && row.year === Number(summary.balance.toDate.slice(0, 4)))
  if (!goal || !plan) return <section className="monitor-panel"><h2>Jaardoel</h2><p className="monitor-empty">Importeer de vorige jaarafsluiting om het jaardoel te berekenen.</p><a className="monitor-link" href="#goals">Bekijk Goals →</a></section>
  const progress = goal.targetValue > 0 ? Math.max(0, summary.balance.value / goal.targetValue * 100) : 0
  const cash = summary.contributionPeriods?.find(row => row.year === goal.year)
  const date = new Date(`${summary.balance.toDate}T12:00:00Z`)
  const fraction = (date.getTime() - Date.UTC(goal.year, 0, 1, 12)) / (Date.UTC(goal.year + 1, 0, 1, 12) - Date.UTC(goal.year, 0, 1, 12))
  const difference = summary.balance.value - (goal.startValue + (cash?.net ?? 0) + goal.growthValue * fraction)
  const result = contributionReturn(summary.balance.value, goal.startValue, cash?.net)
  return <section className="monitor-panel annual-goal">
    <header className="monitor-panel__header"><h2>Jaardoel {goal.year}</h2><span className="monitor-note">Doelrendement {plan.annualGrowthPercentage}%</span></header>
    <div className="annual-goal__headline"><strong>{progress.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%</strong><span>van de doelwaarde bereikt</span></div>
    <div className="annual-goal__track" role="progressbar" aria-label="Saldo ten opzichte van jaardoel" aria-valuenow={Math.round(Math.min(100, progress))} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, progress)}%` }} /></div>
    <p className={`annual-goal__schedule metric--${cash ? direction(difference) : 'neutral'}`}>{cash ? `${difference >= 0 ? 'Voor' : 'Achter'} op jaarschema · ${money(difference, summary.currency, true)}` : 'Jaarschema: inleggegevens ontbreken'}</p>
    <dl className="annual-goal__details"><div><dt>Startwaarde</dt><dd>{money(goal.startValue, summary.currency)}</dd></div><div><dt>Doelwaarde</dt><dd>{money(goal.targetValue, summary.currency)}</dd></div><div><dt>Winst na inleg</dt><dd className={result ? `metric--${direction(result.profit)}` : ''}>{result ? money(result.profit, summary.currency, true) : '—'}</dd></div></dl>
    <a className="monitor-link" href="#goals">Bekijk planning en berekening →</a>
  </section>
}

export function MonthDetail({ label, result, premium, currency, premiumCurrency }: {
  label: string; result: MonthlyTradingResult; premium?: PremiumPeriod; currency: string; premiumCurrency: string;
}) {
  const month = premium?.month ?? result.toDate.slice(0, 7)
  const monthLabel = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))
  return <article className="monitor-panel month-detail">
    <h2>{label} · {monthLabel}</h2><strong className={`month-detail__value metric--${result.direction}`}>{money(result.value, currency, true)}</strong><span className="monitor-note">Nettoresultaat</span>
    <div className="month-detail__columns"><dl><div><dt>Premie</dt><dd className={`metric--${direction(result.premium)}`}>{money(result.premium, premiumCurrency, true)}</dd></div><div><dt>Aandelen</dt><dd className={`metric--${direction(result.stockSales)}`}>{money(result.stockSales, currency, true)}</dd></div></dl>
      {premium && <dl><div><dt>Ontvangen</dt><dd className={`metric--${direction(premium.received)}`}>{money(premium.received, premiumCurrency)}</dd></div><div><dt>Terugkoop</dt><dd className={`metric--${direction(-premium.buyback)}`}>{money(-premium.buyback, premiumCurrency)}</dd></div><div><dt>Commissie</dt><dd className={`metric--${direction(-premium.commission)}`}>{money(-premium.commission, premiumCurrency)}</dd></div>{premium.historicalNet !== undefined && <div><dt>Historisch netto *</dt><dd>{money(premium.historicalNet, premiumCurrency, true)}</dd></div>}</dl>}
    </div>{premium?.historicalNet !== undefined && <p className="monitor-note">* Opening ontbreekt in het rapport.</p>}
  </article>
}
