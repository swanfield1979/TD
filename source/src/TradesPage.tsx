import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftRegular, ChevronRightRegular } from '@fluentui/react-icons'
import type { ClosedTrade } from './types'

interface TradesPageProps {
  trades: ClosedTrade[]
  currency: string
}

const PAGE_SIZE = 50

const formatCurrency = (value: number, currency: string, showSign = false) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'always' : 'auto',
  }).format(value)

const formatPercentage = (value: number, showSign = false) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: showSign ? 'always' : 'auto',
  }).format(value / 100)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))

const directionClass = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

function paginationItems(currentPage: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1])
  const validPages = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b)
  const items: Array<number | 'ellipsis'> = []
  validPages.forEach((page, index) => {
    if (index > 0 && page - validPages[index - 1] > 1) items.push('ellipsis')
    items.push(page)
  })
  return items
}

export default function TradesPage({ trades, currency }: TradesPageProps) {
  const years = useMemo(
    () => [...new Set(trades.map((trade) => trade.closedAt.slice(0, 4)))].sort((left, right) => right.localeCompare(left)),
    [trades],
  )
  const [selectedYear, setSelectedYear] = useState(() => years[0] ?? '')
  const [currentPage, setCurrentPage] = useState(1)
  const filteredTrades = useMemo(
    () => trades.filter((trade) => trade.closedAt.startsWith(selectedYear)),
    [selectedYear, trades],
  )
  const pageCount = Math.max(1, Math.ceil(filteredTrades.length / PAGE_SIZE))

  useEffect(() => {
    if (!years.includes(selectedYear)) setSelectedYear(years[0] ?? '')
  }, [selectedYear, years])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedYear])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount))
  }, [pageCount])

  const pageTrades = useMemo(
    () => filteredTrades.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredTrades],
  )
  const winningTrades = filteredTrades.filter((trade) => trade.profit > 0).length
  const measuredDurations = filteredTrades.filter((trade): trade is ClosedTrade & { daysHeld: number } => trade.daysHeld !== null)
  const totalProfit = filteredTrades.reduce((sum, trade) => sum + trade.profit, 0)
  const averageDays = measuredDurations.length
    ? measuredDurations.reduce((sum, trade) => sum + trade.daysHeld, 0) / measuredDurations.length
    : 0
  const firstItem = filteredTrades.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastItem = Math.min(currentPage * PAGE_SIZE, filteredTrades.length)

  return (
    <div className="trades-page">
      <section className="trades-year-filter" aria-labelledby="trades-year-filter-label">
        <div>
          <span id="trades-year-filter-label">Boekjaar</span>
          <small>Kies welke afgesloten trades je wilt bekijken.</small>
        </div>
        <div className="trades-year-filter__options" role="group" aria-label="Kies een boekjaar">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={year === selectedYear ? 'trades-year-filter__active' : undefined}
              aria-pressed={year === selectedYear}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </section>

      <section className="positions-summary" aria-label="Samenvatting afgesloten trades">
        <article className="positions-summary__card">
          <span>Afgesloten trades</span><strong>{filteredTrades.length}</strong><small>In {selectedYear || 'het gekozen jaar'}</small>
        </article>
        <article className="positions-summary__card positions-summary__card--positive">
          <span>Winnende trades</span><strong>{filteredTrades.length ? formatPercentage((winningTrades / filteredTrades.length) * 100) : '0,0%'}</strong><small>{winningTrades} met positief resultaat</small>
        </article>
        <article className={`positions-summary__card positions-summary__card--${directionClass(totalProfit)}`}>
          <span>Gerealiseerd optieresultaat</span><strong className={`metric--${directionClass(totalProfit)}`}>{formatCurrency(totalProfit, currency, true)}</strong><small>Long en short · exclusief aandelen</small>
        </article>
        <article className="positions-summary__card positions-summary__card--neutral">
          <span>Gemiddeld aangehouden</span><strong>{new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(averageDays)} dagen</strong><small>{measuredDurations.length} volledig gemeten trades</small>
        </article>
      </section>

      <section className="positions-data trades-data" aria-labelledby="closed-trades-title">
        <header className="positions-data__header">
          <div>
            <h2 id="closed-trades-title">Afgesloten trades {selectedYear}</h2>
            <p>Alle gesloten opties inclusief gekochte opties. Het dashboard telt uitsluitend short-premie en gerealiseerde aandelenwinst.</p>
          </div>
          <span className="positions-data__status positions-data__status--live">{firstItem}–{lastItem} van {filteredTrades.length}</span>
        </header>

        {filteredTrades.length === 0 ? (
          <div className="positions-empty">
            <h3>Nog geen afgesloten trades</h3>
            <p>Afgesloten optieposities (ook deels gesloten) verschijnen na de volgende Flex-import.</p>
          </div>
        ) : (
          <>
            <div className="positions-table-region" tabIndex={0} aria-label="Afgesloten trades; horizontaal scrollbaar op een klein scherm">
              <table className="trades-table">
                <caption className="visually-hidden">Afgesloten optieposities (ook deels gesloten) met resultaat en geannualiseerd rendement</caption>
                <thead>
                  <tr>
                    <th scope="col">Onderliggende waarde</th>
                    <th scope="col">Positie</th>
                    <th scope="col">Strike</th>
                    <th scope="col">Geopend</th>
                    <th scope="col">Gesloten</th>
                    <th scope="col">Dagen</th>
                    <th scope="col">Openingspremie</th>
                    <th scope="col">Winst/verlies</th>
                    <th scope="col">Rendement</th>
                    <th scope="col">Geannualiseerd (lineair)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTrades.map((trade) => {
                    const profitDirection = directionClass(trade.profit)
                    return (
                      <tr key={trade.id}>
                        <th scope="row"><strong>{trade.symbol}</strong><small>{trade.name}</small></th>
                        <td><span className="trade-position"><strong>{trade.direction === 'short' ? 'Short' : 'Long'} {trade.optionRight === 'P' ? 'put' : trade.optionRight === 'C' ? 'call' : 'optie'}</strong><small>{Math.abs(trade.quantity)} contract{Math.abs(trade.quantity) === 1 ? '' : 'en'}</small></span></td>
                        <td className="trades-table__number">{trade.strike === null ? <span className="trades-table__unavailable">—</span> : formatCurrency(trade.strike, currency)}</td>
                        <td>{trade.openedAt ? formatDate(trade.openedAt) : <span className="trades-table__unavailable">Niet in bron</span>}</td>
                        <td>{formatDate(trade.closedAt)}</td>
                        <td className="trades-table__number">{trade.daysHeld === null ? <span className="trades-table__unavailable">—</span> : trade.daysHeld}</td>
                        <td className="trades-table__number">{trade.openingValue === null ? <span className="trades-table__unavailable">—</span> : formatCurrency(trade.openingValue, currency)}</td>
                        <td className={`trades-table__number metric--${profitDirection}`}><strong>{formatCurrency(trade.profit, currency, true)}</strong><small>{profitDirection === 'positive' ? 'Winst' : profitDirection === 'negative' ? 'Verlies' : 'Gelijk'}</small></td>
                        <td className={`trades-table__number metric--${trade.profitPercentage === null ? 'neutral' : directionClass(trade.profitPercentage)}`}>{trade.profitPercentage === null ? <span className="trades-table__unavailable">—</span> : formatPercentage(trade.profitPercentage, true)}</td>
                        <td className={`trades-table__number metric--${trade.annualizedPercentage === null ? 'neutral' : directionClass(trade.annualizedPercentage)}`}>{trade.annualizedPercentage === null ? <span className="trades-table__unavailable">—</span> : formatPercentage(trade.annualizedPercentage, true)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <nav className="trades-pagination" aria-label="Paginering afgesloten trades">
              <p>Pagina {currentPage} van {pageCount}</p>
              <div>
                <button type="button" onClick={() => setCurrentPage((page) => page - 1)} disabled={currentPage === 1} aria-label="Vorige pagina"><ChevronLeftRegular aria-hidden="true" /></button>
                {paginationItems(currentPage, pageCount).map((item, index) => item === 'ellipsis'
                  ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
                  : <button key={item} type="button" className={item === currentPage ? 'trades-pagination__active' : undefined} onClick={() => setCurrentPage(item)} aria-current={item === currentPage ? 'page' : undefined} aria-label={`Pagina ${item}`}>{item}</button>
                )}
                <button type="button" onClick={() => setCurrentPage((page) => page + 1)} disabled={currentPage === pageCount} aria-label="Volgende pagina"><ChevronRightRegular aria-hidden="true" /></button>
              </div>
            </nav>
            <p className="trades-data__note">Geannualiseerd rendement = trade-rendement × 365 ÷ aangehouden dagen. Dit is een lineaire vergelijking en geen voorspelling van toekomstig rendement.</p>
          </>
        )}
      </section>
    </div>
  )
}
