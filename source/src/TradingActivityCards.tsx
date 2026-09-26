import type { PremiumPeriod, TradingActivitySummary } from './types'

interface TradingActivityCardsProps {
  activity: TradingActivitySummary
  currentPremium: PremiumPeriod
  previousPremium: PremiumPeriod
  premiumCurrency: string
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

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(
    new Date(`${value}-01T12:00:00`),
  )
}

function PremiumPeriodCard({
  label,
  premium,
  currency,
  isCurrent = false,
}: {
  label: string
  premium: PremiumPeriod
  currency: string
  isCurrent?: boolean
}) {
  const netDirection = directionFor(premium.net)
  const receivedDirection = directionFor(premium.received)
  const buybackDirection = premium.buyback > 0 ? 'negative' : 'neutral'
  const commissionDirection = premium.commission > 0 ? 'negative' : 'neutral'

  return (
    <article className={`premium-card premium-card--${receivedDirection}${isCurrent ? ' premium-card--current' : ''}`}>
      <h2>{label}</h2>
      <p className={`premium-card__value metric--${receivedDirection}`}>
        {formatCurrency(premium.received, currency, 'always')}
      </p>
      <p className="premium-card__breakdown">
        {formatMonth(premium.month)}<span aria-hidden="true"> · </span>
        terugkoop <strong className={`metric--${buybackDirection}`}>{formatCurrency(-premium.buyback, currency)}</strong>
        <span aria-hidden="true"> · </span>
        commissie <strong className={`metric--${commissionDirection}`}>{formatCurrency(-premium.commission, currency)}</strong>
        <span aria-hidden="true"> · </span>
        netto <strong className={`metric--${netDirection}`}>{formatCurrency(premium.net, currency, 'always')}</strong>
      </p>
    </article>
  )
}

export default function TradingActivityCards({
  activity,
  currentPremium,
  previousPremium,
  premiumCurrency,
}: TradingActivityCardsProps) {
  const captureDirection =
    activity.premiumCapturePercentage > 0
      ? 'positive'
      : activity.premiumCapturePercentage < 0
        ? 'negative'
        : 'neutral'
  const grossPremiumDirection = directionFor(activity.grossPremium)

  return (
      <section className="activity-grid" aria-label="Handelsactiviteit en optiepremie">
        <article className="activity-card activity-card--trades">
          <h2>Totaal trades</h2>
          <p className="activity-card__value">{numberFormatter.format(activity.totalTrades)}</p>
          <p className="activity-card__context">
            {numberFormatter.format(activity.closedTrades)} gesloten
            <span aria-hidden="true"> · </span>
            {numberFormatter.format(activity.openTrades)} open
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
            ontvangen brutopremie
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
        <PremiumPeriodCard
          label="Ontvangen premie deze maand"
          premium={currentPremium}
          currency={premiumCurrency}
          isCurrent
        />
        <PremiumPeriodCard
          label="Ontvangen premie vorige maand"
          premium={previousPremium}
          currency={premiumCurrency}
        />
      </section>
  )
}
