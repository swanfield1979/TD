import { DataLineRegular } from '@fluentui/react-icons'
import type { MonthlyBalanceChange } from './types'

const CHART_WIDTH = 960
const CHART_HEIGHT = 350
const PLOT_LEFT = 82
const PLOT_RIGHT = 28
const PLOT_TOP = 34
const PLOT_BOTTOM = 62
const PLOT_WIDTH = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT
const PLOT_HEIGHT = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM

interface MonthlyBalanceChartProps {
  data: MonthlyBalanceChange[]
  currency: string
  year: string
}

function compactCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(value)
}

function exactCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(value)
}

function niceMaximum(value: number) {
  if (value === 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const ceiling = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return ceiling * magnitude
}

export default function MonthlyBalanceChart({ data = [], currency, year }: MonthlyBalanceChartProps) {
  const availableData = data.filter(
    (item): item is MonthlyBalanceChange & { value: number; balance: number; toDate: string } =>
      item.value !== null && item.balance !== null && Boolean(item.toDate),
  )
  const maximum = niceMaximum(Math.max(...availableData.map((item) => Math.abs(item.value)), 0))
  const xForIndex = (index: number) => PLOT_LEFT + (index / 11) * PLOT_WIDTH
  const yForValue = (value: number) => PLOT_TOP + ((maximum - value) / (maximum * 2)) * PLOT_HEIGHT
  const zeroY = yForValue(0)
  const linePath = availableData
    .map((item, pathIndex) => {
      const index = data.findIndex((candidate) => candidate.month === item.month)
      return `${pathIndex === 0 ? 'M' : 'L'} ${xForIndex(index).toFixed(1)} ${yForValue(item.value).toFixed(1)}`
    })
    .join(' ')
  if (availableData.length === 0) {
    return (
      <section className="balance-chart balance-chart--empty">
        <h2>Saldoverandering per maand</h2>
        <p>Er zijn nog geen maandeindsaldi beschikbaar voor {year}.</p>
      </section>
    )
  }

  return (
    <section className="balance-chart" aria-labelledby="balance-chart-title">
      <header className="balance-chart__header">
        <div>
          <p className="balance-chart__kicker"><DataLineRegular aria-hidden="true" /> Jaarverloop</p>
          <h2 id="balance-chart-title">Verschil in saldo per maand</h2>
          <p>Verandering ten opzichte van het laatste saldo van de voorgaande maand.</p>
        </div>
        <div className="balance-chart__legend" aria-label="Legenda">
          <span><i className="legend-dot legend-dot--positive" /> Positief</span>
          <span><i className="legend-dot legend-dot--negative" /> Negatief</span>
          <span><i className="legend-dot legend-dot--missing" /> Nog geen data</span>
        </div>
      </header>

      <div className="balance-chart__scroll" tabIndex={0} aria-label={`Lijngrafiek saldoverandering ${year}; horizontaal scrollbaar op een klein scherm`}>
        <svg
          className="balance-chart__plot"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-labelledby="balance-chart-svg-title balance-chart-svg-description"
        >
          <title id="balance-chart-svg-title">Maandelijkse saldoverandering in {year}</title>
          <desc id="balance-chart-svg-description">
            Een lijn verbindt de beschikbare maandresultaten. Groene punten zijn positief, rode punten negatief en grijze punten hebben nog geen data.
          </desc>

          {[maximum, 0, -maximum].map((value) => {
            const y = yForValue(value)
            return (
              <g key={value}>
                <line
                  className={`chart-gridline${value === 0 ? ' chart-gridline--zero' : ''}`}
                  x1={PLOT_LEFT}
                  x2={CHART_WIDTH - PLOT_RIGHT}
                  y1={y}
                  y2={y}
                />
                <text className="chart-axis-value" x={PLOT_LEFT - 12} y={y + 4} textAnchor="end">
                  {compactCurrency(value, currency)}
                </text>
              </g>
            )
          })}

          <path className="chart-line" d={linePath} />

          {data.map((item, index) => {
            const x = xForIndex(index)
            const hasValue = item.value !== null
            const y = hasValue ? yForValue(item.value!) : zeroY
            const pointClass = hasValue
              ? item.value! >= 0
                ? 'chart-point chart-point--positive'
                : 'chart-point chart-point--negative'
              : 'chart-point chart-point--missing'

            return (
              <g key={item.month}>
                <line className="chart-month-guide" x1={x} x2={x} y1={PLOT_TOP} y2={PLOT_TOP + PLOT_HEIGHT} />
                <circle className={pointClass} cx={x} cy={y} r={hasValue ? 6 : 4}>
                  <title>
                    {hasValue ? `${item.label}: ${exactCurrency(item.value!, currency)}` : `${item.label}: nog geen data`}
                  </title>
                </circle>
                {hasValue && (
                  <text
                    className={`chart-point-value chart-point-value--${item.direction}`}
                    x={x}
                    y={item.value! >= 0 ? y - 14 : y + 22}
                    textAnchor="middle"
                  >
                    {compactCurrency(item.value!, currency)}
                  </text>
                )}
                <text className="chart-month-label" x={x} y={CHART_HEIGHT - 22} textAnchor="middle">
                  {item.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
