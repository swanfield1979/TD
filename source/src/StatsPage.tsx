import { useMemo, useState } from 'react'
import { ChartMultipleRegular, ClockRegular, TrophyRegular } from '@fluentui/react-icons'
import type { ClosedTrade } from './types'

interface StatsPageProps {
  trades: ClosedTrade[]
  currency: string
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const formatCurrency = (value: number, currency: string, showSign = false) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'always' : 'auto',
  }).format(value)

const formatCompactCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value)

const formatPercentage = (value: number) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)

const formatNumber = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('nl-NL', { maximumFractionDigits }).format(value)

const direction = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

function MonthlyResultChart({ trades, currency, year }: StatsPageProps & { year: string }) {
  const monthly = MONTHS.map((label, monthIndex) => ({
    label,
    value: trades
      .filter((trade) => Number(trade.closedAt.slice(5, 7)) === monthIndex + 1)
      .reduce((sum, trade) => sum + trade.profit, 0),
  }))
  const maximum = Math.max(...monthly.map((month) => Math.abs(month.value)), 1)
  const zeroY = 132
  const scaleHeight = 88

  return (
    <section className="stats-panel stats-panel--monthly" aria-labelledby="stats-monthly-title">
      <header className="stats-panel__header">
        <div>
          <span><ChartMultipleRegular aria-hidden="true" /> Resultaatverloop</span>
          <h2 id="stats-monthly-title">Gerealiseerd resultaat per maand</h2>
        </div>
        <small>{year}</small>
      </header>
      <div className="stats-chart-scroll" tabIndex={0} aria-label={`Maandresultaten ${year}; horizontaal scrollbaar op een klein scherm`}>
        <svg className="stats-monthly-chart" viewBox="0 0 760 278" role="img" aria-labelledby="stats-monthly-svg-title stats-monthly-svg-desc">
          <title id="stats-monthly-svg-title">Gerealiseerd resultaat per maand in {year}</title>
          <desc id="stats-monthly-svg-desc">Groene balken zijn winst, rode balken verlies. Iedere balk heeft een direct bedraglabel.</desc>
          <line className="stats-chart-gridline" x1="52" x2="742" y1="44" y2="44" />
          <line className="stats-chart-gridline stats-chart-gridline--zero" x1="52" x2="742" y1={zeroY} y2={zeroY} />
          <line className="stats-chart-gridline" x1="52" x2="742" y1="220" y2="220" />
          <text className="stats-chart-axis" x="45" y="48" textAnchor="end">{formatCompactCurrency(maximum, currency)}</text>
          <text className="stats-chart-axis" x="45" y={zeroY + 4} textAnchor="end">0</text>
          <text className="stats-chart-axis" x="45" y="224" textAnchor="end">{formatCompactCurrency(-maximum, currency)}</text>
          {monthly.map((month, index) => {
            const x = 64 + index * 57
            const height = Math.abs(month.value) / maximum * scaleHeight
            const y = month.value >= 0 ? zeroY - height : zeroY
            return (
              <g key={month.label}>
                <rect
                  className={`stats-monthly-chart__bar stats-monthly-chart__bar--${direction(month.value)}`}
                  x={x}
                  y={month.value === 0 ? zeroY - 1 : y}
                  width="32"
                  height={month.value === 0 ? 2 : height}
                  rx="4"
                >
                  <title>{month.label}: {formatCurrency(month.value, currency, true)}</title>
                </rect>
                {month.value !== 0 && (
                  <text
                    className={`stats-chart-value stats-chart-value--${direction(month.value)}`}
                    x={x + 16}
                    y={month.value > 0 ? y - 8 : y + height + 15}
                    textAnchor="middle"
                  >
                    {formatCompactCurrency(month.value, currency)}
                  </text>
                )}
                <text className="stats-chart-month" x={x + 16} y="252" textAnchor="middle">{month.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}

function OutcomeChart({ trades }: { trades: ClosedTrade[] }) {
  const wins = trades.filter((trade) => trade.profit > 0).length
  const losses = trades.filter((trade) => trade.profit < 0).length
  const neutral = trades.length - wins - losses
  const percentage = (value: number) => trades.length ? value / trades.length * 100 : 0
  const winPercentage = percentage(wins)
  const lossPercentage = percentage(losses)

  return (
    <section className="stats-panel stats-panel--outcomes" aria-labelledby="stats-outcomes-title">
      <header className="stats-panel__header">
        <div>
          <span><TrophyRegular aria-hidden="true" /> Slagingspercentage</span>
          <h2 id="stats-outcomes-title">Winst- en verliestrades</h2>
        </div>
      </header>
      <div className="stats-outcome-chart" role="img" aria-label={`${wins} winsttrades, ${losses} verliestrades en ${neutral} neutrale trades`}>
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle className="stats-outcome-chart__track" cx="70" cy="70" r="52" pathLength="100" />
          <circle className="stats-outcome-chart__wins" cx="70" cy="70" r="52" pathLength="100" strokeDasharray={`${winPercentage} ${100 - winPercentage}`} />
          <circle className="stats-outcome-chart__losses" cx="70" cy="70" r="52" pathLength="100" strokeDasharray={`${lossPercentage} ${100 - lossPercentage}`} strokeDashoffset={-winPercentage} />
        </svg>
        <div><strong>{formatPercentage(winPercentage)}</strong><span>winratio</span></div>
      </div>
      <dl className="stats-outcome-legend">
        <div><dt><i className="legend-dot legend-dot--positive" /> Winst</dt><dd>{wins}</dd></div>
        <div><dt><i className="legend-dot legend-dot--negative" /> Verlies</dt><dd>{losses}</dd></div>
        <div><dt><i className="legend-dot legend-dot--missing" /> Gelijk</dt><dd>{neutral}</dd></div>
      </dl>
    </section>
  )
}

function UnderlyingResults({ trades, currency }: Pick<StatsPageProps, 'trades' | 'currency'>) {
  const tradesBySymbol = trades.reduce((groups, trade) => {
    const group = groups.get(trade.symbol) ?? []
    group.push(trade)
    groups.set(trade.symbol, group)
    return groups
  }, new Map<string, ClosedTrade[]>())
  const results = [...tradesBySymbol.entries()]
    .map(([symbol, symbolTrades]) => ({
      symbol,
      result: symbolTrades.reduce((sum, trade) => sum + trade.profit, 0),
      count: symbolTrades.length,
    }))
    .sort((left, right) => Math.abs(right.result) - Math.abs(left.result))
    .slice(0, 8)
  const maximum = Math.max(...results.map((item) => Math.abs(item.result)), 1)

  return (
    <section className="stats-panel" aria-labelledby="stats-underlyings-title">
      <header className="stats-panel__header">
        <div>
          <span><ChartMultipleRegular aria-hidden="true" /> Grootste impact</span>
          <h2 id="stats-underlyings-title">Resultaat per onderliggende waarde</h2>
        </div>
        <small>Top {results.length} op absolute impact</small>
      </header>
      <div className="stats-underlying-list">
        {results.map((item) => (
          <div key={item.symbol} className="stats-underlying-row">
            <div><strong>{item.symbol}</strong><small>{item.count} trade{item.count === 1 ? '' : 's'}</small></div>
            <div className="stats-underlying-row__scale" aria-hidden="true">
              <span
                className={`stats-underlying-row__bar stats-underlying-row__bar--${direction(item.result)}`}
                style={{ '--stats-bar-size': `${Math.max(2, Math.abs(item.result) / maximum * 100)}%` } as React.CSSProperties}
              />
            </div>
            <strong className={`metric--${direction(item.result)}`}>{formatCurrency(item.result, currency, true)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function DurationDistribution({ trades }: { trades: ClosedTrade[] }) {
  const measured = trades.filter((trade): trade is ClosedTrade & { daysHeld: number } => trade.daysHeld !== null)
  const buckets = [
    { label: '0–1 dag', count: measured.filter((trade) => trade.daysHeld <= 1).length },
    { label: '2–7 dagen', count: measured.filter((trade) => trade.daysHeld >= 2 && trade.daysHeld <= 7).length },
    { label: '8–14 dagen', count: measured.filter((trade) => trade.daysHeld >= 8 && trade.daysHeld <= 14).length },
    { label: '15–30 dagen', count: measured.filter((trade) => trade.daysHeld >= 15 && trade.daysHeld <= 30).length },
    { label: '31+ dagen', count: measured.filter((trade) => trade.daysHeld >= 31).length },
  ]
  const maximum = Math.max(...buckets.map((bucket) => bucket.count), 1)

  return (
    <section className="stats-panel" aria-labelledby="stats-duration-title">
      <header className="stats-panel__header">
        <div>
          <span><ClockRegular aria-hidden="true" /> Aanhoudduur</span>
          <h2 id="stats-duration-title">Verdeling gesloten trades</h2>
        </div>
        <small>{measured.length} gemeten</small>
      </header>
      <div className="stats-duration-list">
        {buckets.map((bucket) => (
          <div key={bucket.label}>
            <span>{bucket.label}</span>
            <div aria-hidden="true"><i style={{ '--stats-bar-size': `${bucket.count / maximum * 100}%` } as React.CSSProperties} /></div>
            <strong>{bucket.count}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function StatsPage({ trades, currency }: StatsPageProps) {
  const years = useMemo(
    () => [...new Set(trades.map((trade) => trade.closedAt.slice(0, 4)))].sort((left, right) => right.localeCompare(left)),
    [trades],
  )
  const [selectedYear, setSelectedYear] = useState(() => years[0] ?? '')
  const filteredTrades = useMemo(
    () => trades.filter((trade) => trade.closedAt.startsWith(selectedYear)),
    [selectedYear, trades],
  )

  const winningTrades = filteredTrades.filter((trade) => trade.profit > 0)
  const losingTrades = filteredTrades.filter((trade) => trade.profit < 0)
  const totalProfit = filteredTrades.reduce((sum, trade) => sum + trade.profit, 0)
  const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.profit, 0)
  const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit, 0))
  const measuredDurations = filteredTrades.filter((trade): trade is ClosedTrade & { daysHeld: number } => trade.daysHeld !== null)
  const averageDays = measuredDurations.length
    ? measuredDurations.reduce((sum, trade) => sum + trade.daysHeld, 0) / measuredDurations.length
    : 0
  const profitFactor = grossLoss ? grossProfit / grossLoss : null
  const averageProfit = filteredTrades.length ? totalProfit / filteredTrades.length : 0

  if (years.length === 0) {
    return (
      <section className="state-panel" role="status">
        <div><h2>Statistieken nog niet beschikbaar</h2><p>Importeer eerst afgesloten trades om deze analyse te vullen.</p></div>
      </section>
    )
  }

  return (
    <div className="stats-page">
      <section className="trades-year-filter" aria-labelledby="stats-year-filter-label">
        <div><span id="stats-year-filter-label">Analysejaar</span><small>Alle statistieken en grafieken volgen deze selectie.</small></div>
        <div className="trades-year-filter__options" role="group" aria-label="Kies een analysejaar">
          {years.map((year) => (
            <button key={year} type="button" className={year === selectedYear ? 'trades-year-filter__active' : undefined} aria-pressed={year === selectedYear} onClick={() => setSelectedYear(year)}>{year}</button>
          ))}
        </div>
      </section>

      <section className="stats-kpi-grid" aria-label={`Kernstatistieken ${selectedYear}`}>
        <article><span>Afgesloten trades</span><strong>{filteredTrades.length}</strong><small>{selectedYear}</small></article>
        <article><span>Winratio</span><strong className="metric--positive">{formatPercentage(filteredTrades.length ? winningTrades.length / filteredTrades.length * 100 : 0)}</strong><small>{winningTrades.length} winsttrades</small></article>
        <article><span>Nettoresultaat</span><strong className={`metric--${direction(totalProfit)}`}>{formatCurrency(totalProfit, currency, true)}</strong><small>Gerealiseerd</small></article>
        <article><span>Gemiddeld per trade</span><strong className={`metric--${direction(averageProfit)}`}>{formatCurrency(averageProfit, currency, true)}</strong><small>Over alle sluitingen</small></article>
        <article><span>Profit factor</span><strong>{profitFactor === null ? '—' : formatNumber(profitFactor, 2)}</strong><small>Brutowinst ÷ brutoverlies</small></article>
        <article><span>Gemiddelde looptijd</span><strong>{formatNumber(averageDays)} dagen</strong><small>{measuredDurations.length} gemeten trades</small></article>
      </section>

      <div className="stats-grid stats-grid--primary">
        <MonthlyResultChart trades={filteredTrades} currency={currency} year={selectedYear} />
        <OutcomeChart trades={filteredTrades} />
      </div>
      <div className="stats-grid stats-grid--secondary">
        <UnderlyingResults trades={filteredTrades} currency={currency} />
        <DurationDistribution trades={filteredTrades} />
      </div>
    </div>
  )
}
