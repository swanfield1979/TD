import {
  ClockRegular,
  DataPieRegular,
  MoneyHandRegular,
  PulseRegular,
} from '@fluentui/react-icons'
import type { PremiumPeriod, TradingActivitySummary } from './types'

interface TradingActivityCardsProps {
  activity: TradingActivitySummary
  currentPremium: PremiumPeriod
  previousPremium: PremiumPeriod
  premiumCurrency: string
}

const numberFormatter = new Intl.NumberFormat('nl-NL')

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
  const netDirection = premium.net > 0 ? 'positive' : premium.net < 0 ? 'negative' : 'neutral'

  return (
    <article className={`premium-card${isCurrent ? ' premium-card--current' : ''}`}>
      <div className="premium-card__header">
        <span className="activity-card__icon activity-card__icon--premium" aria-hidden="true">
          <MoneyHandRegular />
        </span>
        <div>
          <h2>{label}</h2>
          <p>{formatMonth(premium.month)}</p>
        </div>
      </div>
      <p className="premium-card__value">{formatCurrency(premium.received, currency, 'always')}</p>
      <p className="premium-card__breakdown">
        Terugkoop {formatCurrency(premium.buyback, currency)}
        <span aria-hidden="true"> · </span>
        commissie {formatCurrency(premium.commission, currency)}
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

  return (
    <>
      <section className="activity-grid" aria-label="Handelsactiviteit">
        <article className="activity-card">
          <div className="activity-card__header">
            <span className="activity-card__icon" aria-hidden="true"><PulseRegular /></span>
            <h2>Totaal trades</h2>
          </div>
          <p className="activity-card__value">{numberFormatter.format(activity.totalTrades)}</p>
          <p className="activity-card__context">
            {numberFormatter.format(activity.closedTrades)} gesloten
            <span aria-hidden="true"> · </span>
            {numberFormatter.format(activity.openTrades)} open
          </p>
        </article>

        <article className="activity-card">
          <div className="activity-card__header">
            <span className="activity-card__icon activity-card__icon--premium" aria-hidden="true"><DataPieRegular /></span>
            <h2>Premie behouden</h2>
          </div>
          <p className={`activity-card__value metric--${captureDirection}`}>
            {activity.premiumCapturePercentage.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
          <p className="activity-card__context">
            {formatCurrency(activity.grossPremium, premiumCurrency)} ontvangen brutopremie
          </p>
        </article>

        <article className="activity-card">
          <div className="activity-card__header">
            <span className="activity-card__icon" aria-hidden="true"><ClockRegular /></span>
            <h2>Gemiddeld aangehouden</h2>
          </div>
          <p className="activity-card__value">
            {activity.averageDaysHeld.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <small> dagen</small>
          </p>
          <p className="activity-card__context">
            Bereik {activity.minimumDaysHeld}–{activity.maximumDaysHeld} dagen
            <span className="activity-card__sample"> · {activity.measuredClosedTrades} gemeten</span>
          </p>
        </article>
      </section>

      <section className="premium-grid" aria-label="Ontvangen optiepremie per maand">
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
    </>
  )
}
