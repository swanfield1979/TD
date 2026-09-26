import { CalendarLtrRegular, SavingsRegular, TargetArrowRegular, TrophyRegular } from '@fluentui/react-icons'
import type { GoalPlan, PortfolioMetric } from './types'

interface GoalsPageProps {
  goalPlan: GoalPlan | null
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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))

const percentage = (value: number) =>
  new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)

function yearFraction(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00Z`)
  const start = Date.UTC(date.getUTCFullYear(), 0, 1, 12)
  const end = Date.UTC(date.getUTCFullYear() + 1, 0, 1, 12)
  return Math.min(1, Math.max(0, (date.getTime() - start) / (end - start)))
}

export default function GoalsPage({ goalPlan, balance, currency }: GoalsPageProps) {
  if (!goalPlan || goalPlan.years.length === 0) {
    return (
      <section className="state-panel" role="status">
        <div>
          <h2>Jaardoel nog niet beschikbaar</h2>
          <p>Voor de berekening is een eindstand van het voorgaande kalenderjaar nodig.</p>
        </div>
      </section>
    )
  }

  const currentGoal = goalPlan.years.find((yearGoal) => yearGoal.status === 'current')
  if (!currentGoal) return null
  const targetIncrease = currentGoal.targetValue - currentGoal.startValue
  const achievedIncrease = balance.value - currentGoal.startValue
  const progress = targetIncrease > 0 ? (achievedIncrease / targetIncrease) * 100 : 0
  const displayedProgress = Math.min(100, Math.max(0, progress))
  const targetToDate = currentGoal.startValue + targetIncrease * yearFraction(balance.toDate)
  const scheduleDifference = balance.value - targetToDate
  const remaining = currentGoal.targetValue - balance.value
  const asOf = new Date(`${balance.toDate}T12:00:00`)
  const remainingFullMonths = Math.max(0, 11 - asOf.getMonth())
  const requiredPerMonth = remaining > 0 && remainingFullMonths > 0 ? remaining / remainingFullMonths : Math.max(0, remaining)
  const scheduleDirection = scheduleDifference > 0 ? 'positive' : scheduleDifference < 0 ? 'negative' : 'neutral'

  return (
    <div className="goals-page">
      <section className="goals-summary" aria-label={`Berekening jaardoel ${currentGoal.year}`}>
        <article className="goal-stat">
          <span className="goal-stat__icon"><CalendarLtrRegular aria-hidden="true" /></span>
          <div><span>Eindstand {goalPlan.baseYear}</span><strong>{formatCurrency(goalPlan.baseYearEndValue, currency)}</strong><small>Startpunt op {formatDate(goalPlan.baseYearEndDate)}</small></div>
        </article>
        <article className="goal-stat">
          <span className="goal-stat__icon goal-stat__icon--growth"><TargetArrowRegular aria-hidden="true" /></span>
          <div><span>Rendementsdoel</span><strong>{formatCurrency(currentGoal.growthValue, currency)}</strong><small>{percentage(goalPlan.annualGrowthPercentage)}% van het startsaldo</small></div>
        </article>
        <article className="goal-stat">
          <span className="goal-stat__icon goal-stat__icon--deposit"><SavingsRegular aria-hidden="true" /></span>
          <div><span>Jaarlijkse inleg</span><strong>{formatCurrency(currentGoal.contribution, currency)}</strong><small>Telt mee boven op het rendement</small></div>
        </article>
        <article className="goal-stat goal-stat--target">
          <span className="goal-stat__icon goal-stat__icon--target"><TrophyRegular aria-hidden="true" /></span>
          <div><span>Jaardoel {currentGoal.year}</span><strong>{formatCurrency(currentGoal.targetValue, currency)}</strong><small>Start + rendement + inleg</small></div>
        </article>
      </section>

      <section className="goal-progress" aria-labelledby="goal-progress-title">
        <header className="goal-progress__header">
          <div>
            <p className="goal-progress__kicker"><TargetArrowRegular aria-hidden="true" /> Voortgang {currentGoal.year}</p>
            <h2 id="goal-progress-title">Op weg naar het jaardoel</h2>
            <p>Actueel saldo vergeleken met het lineaire jaarschema.</p>
          </div>
          <div className={`goal-progress__status goal-progress__status--${scheduleDirection}`}>
            <span>{scheduleDifference >= 0 ? 'Voor op schema' : 'Achter op schema'}</span>
            <strong>{formatCurrency(scheduleDifference, currency, true)}</strong>
          </div>
        </header>

        <div className="goal-progress__amounts">
          <div><span>Actueel saldo</span><strong>{formatCurrency(balance.value, currency)}</strong><small>Bijgewerkt t/m {formatDate(balance.toDate)}</small></div>
          <div><span>Jaardoel</span><strong>{formatCurrency(currentGoal.targetValue, currency)}</strong><small>Nog {formatCurrency(Math.max(0, remaining), currency)} nodig</small></div>
        </div>

        <div className="goal-progress__track" role="progressbar" aria-label={`Voortgang jaardoel ${currentGoal.year}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(displayedProgress)}>
          <span style={{ width: `${displayedProgress}%` }} />
        </div>
        <p className="goal-progress__caption">
          <strong>{percentage(Math.max(0, progress))}%</strong> van de benodigde groei gerealiseerd
        </p>

        <div className="goal-progress__details">
          <div><span>Doelstand tot nu toe</span><strong>{formatCurrency(targetToDate, currency)}</strong></div>
          <div><span>{remainingFullMonths > 0 ? `Nodig per resterende maand (${remainingFullMonths})` : 'Nog nodig tot jaareinde'}</span><strong>{formatCurrency(requiredPerMonth, currency)}</strong></div>
          <div><span>Totale doelgroei</span><strong>{formatCurrency(targetIncrease, currency)}</strong></div>
        </div>
      </section>

      <section className="goal-plan" aria-labelledby="goal-plan-title">
        <header>
          <div>
            <h2 id="goal-plan-title">Jaarresultaten en planning</h2>
            <p>Ieder jaar gebruikt {percentage(goalPlan.annualGrowthPercentage)}% rendement en {formatCurrency(goalPlan.annualContribution, currency)} inleg als doel.</p>
          </div>
          <span>Planning</span>
        </header>
        <div className="goal-plan__table-region" tabIndex={0} aria-label="Meerjarenplanning; horizontaal scrollbaar op een klein scherm">
          <table>
            <thead><tr><th scope="col">Jaar</th><th scope="col">Start</th><th scope="col">Rendement</th><th scope="col">Inleg</th><th scope="col">Doel</th><th scope="col">Resultaat</th><th scope="col">Verschil</th></tr></thead>
            <tbody>
              {goalPlan.years.map((yearGoal) => {
                const isCurrent = yearGoal.status === 'current'
                const isCompleted = yearGoal.status === 'completed'
                const resultValue = isCurrent ? balance.value : yearGoal.resultValue
                const resultDate = isCurrent ? balance.toDate : yearGoal.resultDate
                const difference = resultValue === null ? null : resultValue - yearGoal.targetValue
                return (
                  <tr key={yearGoal.year} className={isCurrent ? 'goal-plan__current' : isCompleted ? 'goal-plan__completed' : undefined}>
                    <th scope="row">{yearGoal.year}{isCurrent && <small>Huidig jaar</small>}{isCompleted && <small>Afgesloten jaar</small>}</th>
                    <td>{formatCurrency(yearGoal.startValue, currency)}</td>
                    <td>{formatCurrency(yearGoal.growthValue, currency)}<small>{percentage(goalPlan.annualGrowthPercentage)}%</small></td>
                    <td>{formatCurrency(yearGoal.contribution, currency)}</td>
                    <td><strong>{formatCurrency(yearGoal.targetValue, currency)}</strong></td>
                    <td>{resultValue !== null && resultDate ? <>{formatCurrency(resultValue, currency)}<small>{isCurrent ? 't/m ' : 'eindstand '}{formatDate(resultDate)}</small></> : <span className="goal-plan__pending">—</span>}</td>
                    <td className={difference === null ? undefined : `metric--${difference > 0 ? 'positive' : difference < 0 ? 'negative' : 'neutral'}`}>{difference === null ? <span className="goal-plan__pending">—</span> : formatCurrency(difference, currency, true)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="goal-plan__note">Afgesloten jaren gebruiken hun werkelijke eindstand. Toekomstige startsaldi gebruiken het geplande doel van het voorgaande jaar totdat een nieuwe jaarafsluiting beschikbaar is.</p>
      </section>
    </div>
  )
}
