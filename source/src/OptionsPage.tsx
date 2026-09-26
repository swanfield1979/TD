import type { OptionHolding, OptionStrategy } from './types'

interface OptionsPageProps {
  holdings: OptionHolding[]
  currency: string
  asOfDate: string
}

const numberFormatter = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 })

const strategyLabels: Record<OptionStrategy, string> = {
  SYNT_LONG: 'SYNT long',
  SYNT_SHORT: 'SYNT short',
  SHORT_CALL: 'Short call',
  SHORT_PUT: 'Short put',
  LONG_CALL: 'Long call',
  LONG_PUT: 'Long put',
  OTHER: 'Overig',
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00Z`))
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00Z`)
  const endDate = new Date(`${end}T12:00:00Z`)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
}

function UnavailableValue() {
  return <span className="options-table__unavailable" title="Niet beschikbaar in de laatst opgehaalde gegevens">—</span>
}

function OptionsMetric({ value, currency, percentage }: { value: number | null; currency: string; percentage?: number | null }) {
  if (value === null) return <UnavailableValue />
  const direction = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
  return (
    <span className={`options-table__metric metric--${direction}`}>
      {formatCurrency(value, currency)}
      {percentage !== null && percentage !== undefined && (
        <small>{percentage.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</small>
      )}
      <span className="visually-hidden"> {value > 0 ? 'winst' : value < 0 ? 'verlies' : 'ongewijzigd'}</span>
    </span>
  )
}

export default function OptionsPage({ holdings, currency, asOfDate }: OptionsPageProps) {
  const sortedHoldings = [...holdings].sort((left, right) => (
    `${left.expiry || '9999'}${left.symbol}${left.strike ?? ''}`.localeCompare(`${right.expiry || '9999'}${right.symbol}${right.strike ?? ''}`)
  ))
  const openContracts = holdings.reduce((sum, holding) => sum + Math.abs(holding.quantity), 0)
  const holdingsWithChosenDte = holdings.filter((holding) => holding.chosenDte !== null)
  const chosenDteWeight = holdingsWithChosenDte.reduce((sum, holding) => sum + Math.abs(holding.quantity), 0)
  const averageChosenDte = chosenDteWeight
    ? holdingsWithChosenDte.reduce((sum, holding) => sum + (holding.chosenDte ?? 0) * Math.abs(holding.quantity), 0) / chosenDteWeight
    : null
  const holdingsWithResult = holdings.filter((holding) => holding.difference !== null)
  const holdingsWithCurrentValue = holdings.filter((holding) => holding.currentValue !== null)
  const hasCompleteLiveValues = holdings.length > 0 && holdingsWithResult.length === holdings.length
  const hasCompleteCurrentValues = holdings.length > 0 && holdingsWithCurrentValue.length === holdings.length
  const totalDifference = hasCompleteLiveValues
    ? holdings.reduce((sum, holding) => sum + (holding.difference ?? 0), 0)
    : null
  const totalCurrentValue = hasCompleteCurrentValues
    ? holdings.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0)
    : null
  const resultDirection = totalDifference === null || totalDifference === 0 ? 'neutral' : totalDifference > 0 ? 'positive' : 'negative'

  return (
    <div className="options-page">
      <section className="positions-summary" aria-label="Samenvatting open opties">
        <article className="positions-summary__card">
          <span>Open posities</span>
          <strong>{numberFormatter.format(holdings.length)}</strong>
          <small>Verschillende optiecontracten</small>
        </article>
        <article className="positions-summary__card">
          <span>Open contracten</span>
          <strong>{numberFormatter.format(openContracts)}</strong>
          <small>Long en short samengeteld</small>
        </article>
        <article className="positions-summary__card">
          <span>Gem. gekozen DTE</span>
          <strong>{averageChosenDte === null ? '—' : `${Math.round(averageChosenDte)} dagen`}</strong>
          <small>Gewogen naar het aantal contracten</small>
        </article>
        <article className={`positions-summary__card positions-summary__card--${totalDifference === null ? 'pending' : resultDirection}`}>
          <span>Winst/verlies opties</span>
          <strong className={`metric--${resultDirection}`}>{totalDifference === null ? '—' : formatCurrency(totalDifference, currency)}</strong>
          <small>{hasCompleteLiveValues ? 'Ongerealiseerd resultaat open opties' : `${holdingsWithResult.length}/${holdings.length} actuele waarden beschikbaar`}</small>
        </article>
      </section>

      <section className="positions-data" aria-labelledby="options-table-title">
        <header className="positions-data__header">
          <div>
            <h2 id="options-table-title">Open optieposities</h2>
            <p>Expiratie, gekozen looptijd, resterende looptijd en actueel resultaat per contract.</p>
          </div>
          <span className={`positions-data__status${hasCompleteLiveValues ? ' positions-data__status--live' : ''}`}>
            {hasCompleteLiveValues ? 'Actuele IBKR-posities' : 'Koersen beschikbaar na IBKR-refresh'}
          </span>
        </header>

        {holdings.length === 0 ? (
          <div className="positions-empty">
            <h3>Geen open opties gevonden</h3>
            <p>Vernieuw de IBKR-koppeling of importeer een Flex-rapport met open optieposities.</p>
          </div>
        ) : (
          <div className="positions-table-region" tabIndex={0} aria-label="Open optieposities; horizontaal scrollbaar op een klein scherm">
            <table className="options-table">
              <caption className="visually-hidden">Open opties met strategie, positie, strike, expiratie, DTE, marktwaarde en winst of verlies</caption>
              <thead>
                <tr>
                  <th scope="col">Onderliggende waarde</th>
                  <th scope="col">Strategie</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="options-table__number">Aantal</th>
                  <th scope="col" className="options-table__number">Strike</th>
                  <th scope="col">Expiratie</th>
                  <th scope="col" className="options-table__number" title="Days to expiration bij het openen">DTE gekozen</th>
                  <th scope="col" className="options-table__number">Gem. premie</th>
                  <th scope="col" className="options-table__number">Huidige prijs</th>
                  <th scope="col" className="options-table__number">Marktwaarde</th>
                  <th scope="col" className="options-table__number">Winst/verlies</th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((holding) => {
                  const daysRemaining = holding.expiry ? daysBetween(asOfDate, holding.expiry) : null
                  const expiryStatus = daysRemaining === null ? 'unknown' : daysRemaining < 0 ? 'expired' : daysRemaining <= 7 ? 'urgent' : daysRemaining <= 30 ? 'soon' : 'normal'
                  return (
                    <tr key={holding.conid}>
                      <th scope="row">
                        <strong>{holding.symbol}</strong>
                        <small>{holding.name}</small>
                      </th>
                      <td><span className={`option-strategy option-strategy--${holding.strategy.startsWith('SYNT') ? 'synthetic' : 'standard'}`}>{strategyLabels[holding.strategy] ?? 'Overig'}</span></td>
                      <td>{holding.optionRight === 'C' || holding.optionRight === 'CALL' ? 'Call' : holding.optionRight === 'P' || holding.optionRight === 'PUT' ? 'Put' : '—'}</td>
                      <td className="options-table__number">
                        <span className="option-position"><strong>{numberFormatter.format(Math.abs(holding.quantity))}</strong><small>{holding.quantity < 0 ? 'short' : 'long'}</small></span>
                      </td>
                      <td className="options-table__number">{holding.strike === null ? <UnavailableValue /> : formatCurrency(holding.strike, currency)}</td>
                      <td>
                        {holding.expiry === null ? <UnavailableValue /> : (
                          <span className={`option-expiry option-expiry--${expiryStatus}`}>
                            <strong>{formatDate(holding.expiry)}</strong>
                            <small>
                              {daysRemaining! < 0
                                ? `${Math.abs(daysRemaining!)} ${Math.abs(daysRemaining!) === 1 ? 'dag' : 'dagen'} verlopen`
                                : `${daysRemaining} ${daysRemaining === 1 ? 'dag' : 'dagen'} resterend`}
                            </small>
                          </span>
                        )}
                      </td>
                      <td className="options-table__number">{holding.chosenDte === null ? <UnavailableValue /> : `${numberFormatter.format(holding.chosenDte)} dagen`}</td>
                      <td className="options-table__number">{holding.averageOpenPrice === null ? <UnavailableValue /> : formatCurrency(holding.averageOpenPrice, currency)}</td>
                      <td className="options-table__number">{holding.currentPrice === null ? <UnavailableValue /> : formatCurrency(holding.currentPrice, currency)}</td>
                      <td className="options-table__number">{holding.currentValue === null ? <UnavailableValue /> : formatCurrency(holding.currentValue, currency)}</td>
                      <td className="options-table__number"><OptionsMetric value={holding.difference} currency={currency} percentage={holding.differencePercentage} /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Totaal</th>
                  <td />
                  <td />
                  <td className="options-table__number">{numberFormatter.format(openContracts)}</td>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td className="options-table__number">{totalCurrentValue === null ? <UnavailableValue /> : formatCurrency(totalCurrentValue, currency)}</td>
                  <td className="options-table__number"><OptionsMetric value={totalDifference} currency={currency} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
