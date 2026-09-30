import type { TradingActivitySummary } from './types'

interface TradingActivityCardsProps {
  activity: TradingActivitySummary
  premiumCurrency: string
  year: string
}

const numberFormatter = new Intl.NumberFormat('nl-NL')

function directionFor(value: number) {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
}

function formatCurrency(value: number, currency: string, signDisplay: 'auto' | 'always' = 'auto') {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay,
  }).format(value)
}

export default function TradingActivityCards({
  activity,
  premiumCurrency,
  year,
}: TradingActivityCardsProps) {
  const captureDirection =
    activity.premiumCapturePercentage > 0
      ? 'positive'
      : activity.premiumCapturePercentage < 0
        ? 'negative'
        : 'neutral'
  const grossPremiumDirection = directionFor(activity.grossPremium)

  return (
      <>
        <article className="activity-card activity-card--trades">
          <h2>Totaal trades</h2>
          <p className="activity-card__value">{numberFormatter.format(activity.totalTrades)}</p>
          <p className="activity-card__context">
            {numberFormatter.format(activity.closedTrades)} gesloten in {year}
            <span aria-hidden="true"> · </span>
            {numberFormatter.format(activity.openTrades)} momenteel open
          </p>
        </article>

        <article className={`activity-card activity-card--${captureDirection}`}>
          <h2>Premie behouden</h2>
          <p className={`activity-card__value metric--${captureDirection}`}>
            {activity.premiumCapturePercentage.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
          <p className="activity-card__context">
            <strong className={`metric--${grossPremiumDirection}`}>
              {formatCurrency(activity.grossPremium, premiumCurrency)}
            </strong>{' '}
            brutopremie van afgesloten opties
          </p>
        </article>

        <article className="activity-card activity-card--duration">
          <h2>Gemiddeld aangehouden</h2>
          <p className="activity-card__value">
            {activity.averageDaysHeld.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <small> dagen</small>
          </p>
          <p className="activity-card__context">
            Bereik {activity.minimumDaysHeld}–{activity.maximumDaysHeld} dagen
            <span className="activity-card__sample"> · {activity.measuredClosedTrades} gemeten</span>
          </p>
        </article>
      </>
  )
}
