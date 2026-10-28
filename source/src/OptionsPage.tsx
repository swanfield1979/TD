import { Fragment, useId, useMemo, useState } from 'react'
import { ChevronDownRegular, MergeRegular } from '@fluentui/react-icons'
import { groupOptionHoldings, openingWeek, type OptionDisplayRow } from './option-groups'
import './option-groups.css'
import type { OptionHolding, OptionStrategy } from './types'

interface OptionsPageProps {
  holdings: OptionHolding[]
  currency: string
  asOfDate: string
  reservedCash: number
  freeToSpend: number
  unpricedContractCount: number
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

function isSyntheticStrategy(strategy: OptionStrategy) {
  return strategy === 'SYNT_LONG' || strategy === 'SYNT_SHORT'
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

function OpeningDate({ value }: { value: string | null }) {
  if (!value) return <UnavailableValue />
  const week = openingWeek(value)
  return <span className="option-opened">{week !== null && <small>Week {week}</small>}<span>{formatDate(value)}</span></span>
}

function GroupRow({ row, currency, asOfDate, expanded, controls, onToggle }: {
  row: Extract<OptionDisplayRow, { kind: 'group' }>; currency: string; asOfDate: string;
  expanded: boolean; controls: string; onToggle: () => void;
}) {
  const daysRemaining = daysBetween(asOfDate, row.expiry)
  const expiryStatus = daysRemaining < 0 ? 'expired' : daysRemaining <= 7 ? 'urgent' : daysRemaining <= 30 ? 'soon' : 'normal'
  const label = row.strategy === 'PUT_SPREAD' ? 'Put Spread' : strategyLabels[row.strategy]
  const legLabel = (leg: OptionHolding) => `${leg.quantity < 0 ? 'Short' : 'Long'} ${['P', 'PUT'].includes(leg.optionRight ?? '') ? 'put' : 'call'}`
  const values = (field: 'strike' | 'chosenDte', format: (value: number) => string) => {
    if (row.legs[0][field] === row.legs[1][field]) return row.legs[0][field] === null ? <UnavailableValue /> : format(row.legs[0][field]!)
    return <span className="option-group-values">{row.legs.map(leg => <span key={leg.conid}><small>{legLabel(leg)}</small>{leg[field] === null ? <UnavailableValue /> : format(leg[field]!)}</span>)}</span>
  }
  return <tr className={`options-table__row--group${row.strategy.startsWith('SYNT') ? ' options-table__row--synthetic' : ''}`}>
    <th scope="row"><button type="button" className="option-group-toggle" aria-expanded={expanded} aria-controls={controls} onClick={onToggle} aria-label={`${label} ${row.symbol}, ${row.expiry}, ${row.legs.map(leg => leg.strike).join('/')}, ${expanded ? 'inklappen' : 'uitklappen'}`}><ChevronDownRegular aria-hidden="true" /><span><strong>{row.symbol}</strong><small>{label} · 2 benen</small></span></button></th>
    <td><span className={`option-strategy option-strategy--${row.strategy === 'PUT_SPREAD' ? 'spread' : 'synthetic'}`}><MergeRegular aria-hidden="true" />{label}</span></td>
    <td>{row.strategy === 'PUT_SPREAD' ? 'Put / Put' : 'Call / Put'}</td>
    <td className="options-table__number"><span className="option-position"><strong>{numberFormatter.format(row.quantity)}</strong><small>{row.quantity === 1 ? 'set' : 'sets'} · 2 benen</small></span></td>
    <td className="options-table__number">{values('strike', value => formatCurrency(value, currency))}</td>
    <td>{row.legs[0].openedAt === row.legs[1].openedAt ? <OpeningDate value={row.legs[0].openedAt} /> : <span className="option-group-dates">{row.legs.map(leg => <span key={leg.conid}><small>{legLabel(leg)}</small><OpeningDate value={leg.openedAt} /></span>)}</span>}</td>
    <td><span className={`option-expiry option-expiry--${expiryStatus}`}><strong>{formatDate(row.expiry)}</strong><small>{daysRemaining < 0 ? `${Math.abs(daysRemaining)} dagen verlopen` : `${daysRemaining} dagen resterend`}</small></span></td>
    <td className="options-table__number">{values('chosenDte', value => `${numberFormatter.format(value)} dagen`)}</td>
    <td className="options-table__number">{row.averageOpenPrice === null ? <UnavailableValue /> : <span className="option-net-price">{formatCurrency(row.averageOpenPrice, currency)}<small>{row.averageOpenPrice > 0 ? 'netto credit' : row.averageOpenPrice < 0 ? 'netto debet' : 'netto'} per set</small></span>}</td>
    <td className="options-table__number">{row.currentPrice === null ? <UnavailableValue /> : <span className="option-net-price" title="Positief = netto betalen bij sluiten; negatief = netto ontvangen bij sluiten">{formatCurrency(row.currentPrice, currency)}<small>netto sluitprijs per set</small></span>}</td>
    <td className="options-table__number">{row.currentValue === null ? <UnavailableValue /> : formatCurrency(row.currentValue, currency)}</td>
    <td className="options-table__number"><OptionsMetric value={row.difference} currency={currency} /></td>
  </tr>
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

function HoldingRow({ holding, currency, asOfDate, child = false }: { holding: OptionHolding; currency: string; asOfDate: string; child?: boolean }) {
  const daysRemaining = holding.expiry ? daysBetween(asOfDate, holding.expiry) : null
  const expiryStatus = daysRemaining === null ? 'unknown' : daysRemaining < 0 ? 'expired' : daysRemaining <= 7 ? 'urgent' : daysRemaining <= 30 ? 'soon' : 'normal'
  const isSynthetic = isSyntheticStrategy(holding.strategy)
  return (
    <tr className={child ? 'options-table__row--leg' : isSynthetic ? 'options-table__row--synthetic' : undefined}>
      <th scope="row">
        <strong>{child && <span aria-hidden="true">↳ </span>}{holding.symbol}</strong>
        <small>{holding.name}</small>
      </th>
      <td>
        <span
          className={`option-strategy option-strategy--${isSynthetic ? 'synthetic' : 'standard'}`}
          title={isSynthetic ? 'Gecombineerde synthetische strategie' : undefined}
        >
          {isSynthetic && <MergeRegular aria-hidden="true" />}
          {strategyLabels[holding.strategy] ?? 'Overig'}
          {isSynthetic && <span className="visually-hidden">, gecombineerde strategie</span>}
        </span>
      </td>
      <td>{holding.optionRight === 'C' || holding.optionRight === 'CALL' ? 'Call' : holding.optionRight === 'P' || holding.optionRight === 'PUT' ? 'Put' : '—'}</td>
      <td className="options-table__number">
        <span className="option-position"><strong>{numberFormatter.format(Math.abs(holding.quantity))}</strong><small>{holding.quantity < 0 ? 'short' : 'long'}</small></span>
      </td>
      <td className="options-table__number">{holding.strike === null ? <UnavailableValue /> : formatCurrency(holding.strike, currency)}</td>
      <td><OpeningDate value={holding.openedAt} /></td>
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

}

export default function OptionsPage({ holdings, currency, asOfDate, reservedCash, freeToSpend, unpricedContractCount }: OptionsPageProps) {
  const displayRows = useMemo(() => groupOptionHoldings(holdings), [holdings])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const id = useId()
  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
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
        <article className="positions-summary__card positions-summary__card--reserved">
          <span>Gereserveerd voor CSP</span>
          <strong>{formatCurrency(reservedCash, currency)}</strong>
          <small>
            {unpricedContractCount > 0
              ? `${numberFormatter.format(unpricedContractCount)} contract(en) zonder bekende strike`
              : 'Strike × 100 × open short-putcontracten'}
          </small>
        </article>
        <article className={`positions-summary__card positions-summary__card--${freeToSpend < 0 ? 'negative' : 'available'}`}>
          <span>Vrij te besteden</span>
          <strong className={freeToSpend < 0 ? 'metric--negative' : undefined}>{formatCurrency(freeToSpend, currency)}</strong>
          <small>Saldo − aandelen − CSP-reservering</small>
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
            <p>Putspreads en SYNT staan eenmaal in het overzicht. Klap een combinatie uit om beide benen te zien; de hoofdregel toont netto bedragen per set.</p>
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
              <caption className="visually-hidden">Open opties met strategie, positie, strike, openingsdatum, expiratie, DTE, marktwaarde en winst of verlies</caption>
              <thead>
                <tr>
                  <th scope="col">Onderliggende waarde</th>
                  <th scope="col">Strategie</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="options-table__number">Aantal</th>
                  <th scope="col" className="options-table__number">Strike</th>
                  <th scope="col">Geopend</th>
                  <th scope="col">Expiratie</th>
                  <th scope="col" className="options-table__number" title="Days to expiration bij het openen">DTE gekozen</th>
                  <th scope="col" className="options-table__number">Gem. premie</th>
                  <th scope="col" className="options-table__number">Huidige prijs</th>
                  <th scope="col" className="options-table__number">Marktwaarde</th>
                  <th scope="col" className="options-table__number">Winst/verlies</th>
                </tr>
              </thead>
              {displayRows.map(row => row.kind === 'single' ? <tbody key={row.id}><HoldingRow holding={row.holding} currency={currency} asOfDate={asOfDate} /></tbody> : <Fragment key={row.id}>
                <tbody><GroupRow row={row} currency={currency} asOfDate={asOfDate} expanded={expanded.has(row.id)} controls={`${id}-${row.id}`} onToggle={() => toggle(row.id)} /></tbody>
                <tbody id={`${id}-${row.id}`} hidden={!expanded.has(row.id)} className="options-table__legs">{row.legs.map(holding => <HoldingRow key={holding.conid} holding={holding} currency={currency} asOfDate={asOfDate} child />)}</tbody>
              </Fragment>)}
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
