import type { PortfolioAllocation, PortfolioMetric } from './types'

interface PortfolioAllocationCardProps {
  allocation: PortfolioAllocation
  balance: PortfolioMetric
  currency: string
}

const formatCurrency = (value: number, currency: string, showSign = false) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'always' : 'auto',
  }).format(value)

export default function PortfolioAllocationCard({
  allocation,
  balance,
  currency,
}: PortfolioAllocationCardProps) {
  let offset = 0
  const summary = allocation.categories
    .map((category) => `${category.label}: ${category.percentage.toLocaleString('nl-NL')}%`)
    .join(', ')

  return (
    <article className="allocation-card" aria-label={`Portefeuilleverdeling. ${summary}`}>
      <h2 className="visually-hidden">Portefeuilleverdeling</h2>
      <div className="allocation-card__chart" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <circle className="allocation-card__track" cx="60" cy="60" r="48" pathLength="100" />
          {allocation.categories.map((category) => {
            const dashOffset = -offset
            offset += category.percentage
            return (
              <circle
                key={category.key}
                className={`allocation-card__segment allocation-card__segment--${category.key}`}
                cx="60"
                cy="60"
                r="48"
                pathLength="100"
                strokeDasharray={`${category.percentage} ${100 - category.percentage}`}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </svg>
        <div className="allocation-card__total">
          <strong>{formatCurrency(balance.value, currency)}</strong>
          <span>Netto saldo</span>
        </div>
      </div>

      <ul className="allocation-card__legend">
        {allocation.categories.map((category) => (
          <li key={category.key}>
            <span className={`allocation-card__swatch allocation-card__swatch--${category.key}`} aria-hidden="true" />
            <span className="allocation-card__label">{category.label}</span>
            <span className="allocation-card__amount">
              <strong>{formatCurrency(category.value, currency)}</strong>
              <small>{category.percentage.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</small>
            </span>
          </li>
        ))}
      </ul>

      {allocation.isEstimated && <p className="allocation-card__note">Indicatief · aandelen op resterende kostprijs</p>}
    </article>
  )
}
