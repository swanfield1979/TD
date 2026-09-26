import type { StockHolding } from './types'

interface StocksPageProps {
  holdings: StockHolding[]
  currency: string
}

const numberFormatter = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 4 })

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function UnavailableValue() {
  return <span className="stocks-table__unavailable" title="Niet beschikbaar in de laatst opgehaalde IBKR-gegevens">—</span>
}

function DailyChangeValue({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <UnavailableValue />
  const direction = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
  const formattedValue = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value)

  return (
    <span className={`stocks-table__daily-change metric--${direction}`}>
      {formattedValue}%
      <span className="visually-hidden"> {value > 0 ? 'gestegen vandaag' : value < 0 ? 'gedaald vandaag' : 'ongewijzigd vandaag'}</span>
    </span>
  )
}

const coverageLabels = {
  complete: 'Volledig gedekt',
  partial: 'Deels gedekt',
  none: 'Niet gedekt',
  over: 'Overgedekt',
  not_applicable: 'Geen volledig lot',
} as const

function CoveredCallValue({ holding }: { holding: StockHolding }) {
  const coverage = holding.coveredCallCoverage
  if (!coverage) return <UnavailableValue />
  const label = coverageLabels[coverage.status]

  return (
    <span
      className={`cc-coverage cc-coverage--${coverage.status}`}
      aria-label={`${coverage.openContracts} van ${coverage.availableContracts} covered calls; ${label.toLowerCase()}`}
    >
      <strong>{numberFormatter.format(coverage.openContracts)}/{numberFormatter.format(coverage.availableContracts)}</strong>
      <small>{label}</small>
    </span>
  )
}

export default function StocksPage({ holdings, currency }: StocksPageProps) {
  const totalPurchaseValue = holdings.reduce((sum, holding) => sum + holding.purchaseValue, 0)
  const holdingsWithPrice = holdings.filter((holding) => holding.currentPrice !== null).length
  const hasCompletePrices = holdings.length > 0 && holdingsWithPrice === holdings.length
  const totalCurrentValue = hasCompletePrices
    ? holdings.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0)
    : null
  const totalDifference = hasCompletePrices
    ? holdings.reduce((sum, holding) => sum + (holding.difference ?? 0), 0)
    : null
  const differenceDirection = totalDifference === null || totalDifference === 0
    ? 'neutral'
    : totalDifference > 0 ? 'positive' : 'negative'

  return (
    <div className="stocks-page">
      <section className="positions-summary" aria-label="Samenvatting aandelen">
        <article className="positions-summary__card">
          <span>Open aandelen</span>
          <strong>{numberFormatter.format(holdings.length)}</strong>
          <small>Verschillende posities</small>
        </article>
        <article className="positions-summary__card">
          <span>Netto kostprijs</span>
          <strong>{formatCurrency(totalPurchaseValue, currency)}</strong>
          <small>Resterende FIFO-kostprijs inclusief commissie</small>
        </article>
        <article className="positions-summary__card">
          <span>Netto positiewaarde</span>
          <strong>{totalCurrentValue === null ? '—' : formatCurrency(totalCurrentValue, currency)}</strong>
          <small>{hasCompletePrices ? 'Actuele waarde van open aandelen' : 'Beschikbaar na koppeling met actuele koersen'}</small>
        </article>
        <article className={`positions-summary__card positions-summary__card--${hasCompletePrices ? differenceDirection : 'pending'}`}>
          <span>Winst/verlies aandelen</span>
          <strong className={`metric--${differenceDirection}`}>
            {totalDifference === null ? '—' : formatCurrency(totalDifference, currency)}
          </strong>
          <small>{hasCompletePrices ? 'Actuele waarde minus nettokostprijs' : `${holdingsWithPrice}/${holdings.length} actuele koersen beschikbaar`}</small>
        </article>
      </section>

      <section className="positions-data" aria-labelledby="stocks-table-title">
        <header className="positions-data__header">
          <div>
            <h2 id="stocks-table-title">Aandelenposities</h2>
            <p>{hasCompletePrices ? 'Open posities met de laatst opgehaalde IBKR-koersen.' : 'Open posities op basis van de aangeleverde Flex-trades.'}</p>
          </div>
          <span className={`positions-data__status${hasCompletePrices ? ' positions-data__status--live' : ''}`}>
            {hasCompletePrices ? 'Actuele IBKR-koersen' : 'Actuele koersen nog niet gekoppeld'}
          </span>
        </header>

        {holdings.length === 0 ? (
          <div className="positions-empty">
            <h3>Geen open aandelen gevonden</h3>
            <p>Importeer een Flex-rapport met aandelentrades om posities te tonen.</p>
          </div>
        ) : (
          <div className="positions-table-region" tabIndex={0} aria-label="Aandelenposities; horizontaal scrollbaar op een klein scherm">
            <table className="stocks-table">
              <caption className="visually-hidden">Open aandelenposities met covered-call-dekking, aankoop- en actuele waardes en de koersverandering van vandaag</caption>
              <thead>
                <tr>
                  <th scope="col">Aandeel</th>
                  <th scope="col" className="stocks-table__number">Aantal</th>
                  <th scope="col" className="stocks-table__number" title="Open short calls ten opzichte van volledige pakketten van 100 aandelen">CC-dekking</th>
                  <th scope="col" className="stocks-table__number">Gem. aankoop</th>
                  <th scope="col" className="stocks-table__number">Huidige prijs</th>
                  <th scope="col" className="stocks-table__number">Netto kostprijs</th>
                  <th scope="col" className="stocks-table__number">Netto positiewaarde</th>
                  <th scope="col" className="stocks-table__number">Winst/verlies</th>
                  <th scope="col" className="stocks-table__number" title="Verandering ten opzichte van de vorige slotkoers">Vandaag</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.conid}>
                    <th scope="row">
                      <strong>{holding.symbol}</strong>
                      <small>{holding.name}</small>
                    </th>
                    <td className="stocks-table__number">{numberFormatter.format(holding.quantity)}</td>
                    <td className="stocks-table__number"><CoveredCallValue holding={holding} /></td>
                    <td className="stocks-table__number">{formatCurrency(holding.averagePurchasePrice, currency)}</td>
                    <td className="stocks-table__number">
                      {holding.currentPrice === null ? <UnavailableValue /> : formatCurrency(holding.currentPrice, currency)}
                    </td>
                    <td className="stocks-table__number stocks-table__purchase-value">{formatCurrency(holding.purchaseValue, currency)}</td>
                    <td className="stocks-table__number">
                      {holding.currentValue === null ? <UnavailableValue /> : formatCurrency(holding.currentValue, currency)}
                    </td>
                    <td className="stocks-table__number">
                      {holding.difference === null ? (
                        <UnavailableValue />
                      ) : (
                        <span className={`metric--${holding.difference > 0 ? 'positive' : holding.difference < 0 ? 'negative' : 'neutral'}`}>
                          {formatCurrency(holding.difference, currency)}
                          <small>{holding.differencePercentage?.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</small>
                        </span>
                      )}
                    </td>
                    <td className="stocks-table__number"><DailyChangeValue value={holding.dailyChangePercentage} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Totaal</th>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td className="stocks-table__number">{formatCurrency(totalPurchaseValue, currency)}</td>
                  <td className="stocks-table__number">{totalCurrentValue === null ? <UnavailableValue /> : formatCurrency(totalCurrentValue, currency)}</td>
                  <td className="stocks-table__number">
                    {totalDifference === null ? <UnavailableValue /> : (
                      <span className={`metric--${differenceDirection}`}>{formatCurrency(totalDifference, currency)}</span>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
