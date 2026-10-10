import { contributionReturn, contributionsSince } from '../shared/contribution-return.mjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowSwapRegular,
  ChartMultipleRegular,
  DataTrendingRegular,
  DismissRegular,
  HomeRegular,
  HistoryRegular,
  NavigationRegular,
  TargetArrowRegular,
} from '@fluentui/react-icons'
import type { MetricDirection, PortfolioMetric, PortfolioSummary } from './types'
import { AnnualGoal, MonthDetail, NetMonthlyResults, PortfolioTrend } from './DashboardPanels'
import PortfolioAllocationCard from './PortfolioAllocationCard'
import StocksPage from './StocksPage'
import OptionsPage from './OptionsPage'
import GoalsPage from './GoalsPage'
import TradesPage from './TradesPage'
import StatsPage from './StatsPage'
import ScansPage from './ScansPage'
import TradingActivityCards from './TradingActivityCards'
import IbkrConnectionControl from './IbkrConnectionControl'
import { mergeLiveSnapshot, resolvePortfolio } from './ibkr'

const DATA_URL = '/data/portfolio-summary.json'
type Page = 'dashboard' | 'stocks' | 'options' | 'goals' | 'stats' | 'trades' | 'scans'

const pageFromHash = (): Page => {
  if (window.location.hash === '#scans') return 'scans'
  if (window.location.hash === '#stocks') return 'stocks'
  if (window.location.hash === '#options') return 'options'
  if (window.location.hash === '#goals') return 'goals'
  if (window.location.hash === '#stats') return 'stats'
  if (window.location.hash === '#trades') return 'trades'
  return 'dashboard'
}

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  stocks: 'Stocks',
  options: 'Options',
  goals: 'Goals',
  stats: 'Stats',
  trades: 'Trades',
  scans: 'Scans',
}

const currencyFormatter = (currency: string, showSign = false) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'always' : 'auto',
  })

const percentageFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))

const directionLabel: Record<MetricDirection, string> = {
  positive: 'Positief',
  negative: 'Negatief',
  neutral: 'Ongewijzigd',
}

interface StatCardProps {
  label: string
  metric: PortfolioMetric
  currency: string
  context: string
  prominent?: boolean
}

function StatCard({ label, metric, currency, context, prominent = false }: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${prominent ? 'balance' : metric.direction}`}>
      <h2>{label}</h2>
      <p className={`stat-card__value metric--${metric.direction}`}>
        {currencyFormatter(currency, !prominent).format(metric.value)}
      </p>
      <p className="stat-card__context">{context}</p>
      {!prominent && <span className="visually-hidden">{directionLabel[metric.direction]}</span>}
    </article>
  )
}

interface DailyProfitCardProps {
  metric: PortfolioSummary['dailyProfit']
  balance: PortfolioMetric
  currency: string
}

export function DailyProfitCard({ metric, balance, currency }: DailyProfitCardProps) {
  const previousBalance = balance.value - metric.value
  const percentage = previousBalance === 0 || metric.unavailable ? null : metric.value / Math.abs(previousBalance)

  return (
    <article className={`stat-card daily-profit-card stat-card--${metric.direction}`}>
      <h2>Saldoverandering{metric.source === 'live' ? ' live' : ' rapportdag'}</h2>
      <div className="daily-profit-card__values">
        <p className={`stat-card__value metric--${metric.direction}`}>
          {metric.unavailable ? '—' : currencyFormatter(currency, true).format(metric.value)}
        </p>
        <p className={`daily-profit-card__percentage metric--${metric.direction}`}>
          {percentage === null ? '—' : percentageFormatter.format(percentage)}
        </p>
      </div>
      <p className="stat-card__context">
        {metric.unavailable ? 'Vorige dagstand ontbreekt' : <>
          {metric.fromDate && `${formatDate(metric.fromDate)} – `}{formatDate(metric.toDate)}
          {metric.source === 'live' && <><br />Ten opzichte van {metric.referenceSource === 'snapshot' ? 'laatste meting' : 'rapportsaldo'} op {metric.fromDate && formatDate(metric.fromDate)}</>}
        </>}
      </p>
      {!metric.unavailable && <span className="visually-hidden">{directionLabel[metric.direction]} ten opzichte van de vorige beschikbare dagstand</span>}
    </article>
  )
}

function TotalProfitCard({ startingBalance, balance, currency, contributions = [] }: {
  contributions?: PortfolioSummary['contributionPeriods']
  startingBalance: PortfolioSummary['startingBalance']
  balance: PortfolioMetric
  currency: string
}) {
  const cash = contributionsSince(contributions, startingBalance?.date, balance.toDate)
  const result = contributionReturn(balance.value, startingBalance?.value, cash?.net)
  const profit = result?.profit ?? null
  const percentage = result?.percentage ?? null
  const direction = profit === null || profit === 0 ? 'neutral' : profit > 0 ? 'positive' : 'negative'

  return (
    <article className={`stat-card daily-profit-card total-profit-card stat-card--${direction}`}>
      <h2>Totale winst</h2>
      <div className="daily-profit-card__values">
        <p className={`stat-card__value metric--${direction}`}>
          {profit === null ? '—' : `${cash?.datesDiffer ? '≈ ' : ''}${currencyFormatter(currency, true).format(profit)}`}
        </p>
        <p className={`daily-profit-card__percentage metric--${direction}`}>
          {percentage === null ? '—' : `${cash?.datesDiffer ? '≈ ' : ''}${percentageFormatter.format(percentage)}`}
        </p>
      </div>
      <p className="stat-card__context">
        {startingBalance ? <>
          Sinds start 2025 · {formatDate(startingBalance.date)}<br />
          Start {currencyFormatter(currency).format(startingBalance.value)} / nu {currencyFormatter(currency).format(balance.value)}<br />
          {cash ? <>Netto inleg {currencyFormatter(currency).format(cash.net)} t/m {formatDate(cash.toDate)}</> : 'Stortingshistorie ontbreekt · importeer jaarrapporten.'}
        </> : 'Startsaldo ontbreekt · importeer Flex-saldi uit 2025.'}
      </p>
      <span className="visually-hidden">Winst na aftrek van netto inleg; percentage over startsaldo plus netto inleg, inclusief open posities. Bij afwijkende peildatums is het resultaat voorlopig.</span>
    </article>
  )
}

function LoadingDashboard() {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="loader" aria-hidden="true" />
      <div>
        <h2>Portefeuille laden</h2>
        <p>De lokale Flex-data wordt verwerkt.</p>
      </div>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('tm-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('tm-theme', theme) } catch { /* Theme also works without storage. */ }
  }, [theme])
  const [importedSummary, setSummary] = useState<PortfolioSummary | null>(null)
  const [liveSnapshot, setLiveSnapshot] = useState<Parameters<typeof mergeLiveSnapshot>[1] | null>(null)
  const summary = useMemo(() => resolvePortfolio(importedSummary, liveSnapshot), [importedSummary, liveSnapshot])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>(pageFromHash)
  const hasLiveSnapshot = !!summary && summary !== importedSummary
  const showLiveFreshness = hasLiveSnapshot && currentPage !== 'stats' && currentPage !== 'trades'

  const handleLiveSnapshot = useCallback((snapshot: Parameters<typeof mergeLiveSnapshot>[1]) => {
    setLiveSnapshot((current) => !current || snapshot.generatedAt >= current.generatedAt ? snapshot : current)
  }, [])

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as PortfolioSummary
      setSummary(data)
    } catch {
      setSummary(null)
      setError('Er is nog geen lokaal portfolio-overzicht. Importeer eerst de Flex-rapporten.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(pageFromHash())
      setIsMenuOpen(false)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    document.title = `${pageTitles[currentPage]} · Trading Monitor`
  }, [currentPage])

  useEffect(() => {
    if (!isMenuOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMenuOpen])

  return (
    <div className="app-shell">
      <button
        className="menu-button"
        type="button"
        aria-label={isMenuOpen ? 'Menu sluiten' : 'Menu openen'}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((value) => !value)}
      >
        {isMenuOpen ? <DismissRegular /> : <NavigationRegular />}
      </button>

      {isMenuOpen && (
        <button
          className="nav-backdrop"
          type="button"
          aria-label="Menu sluiten"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <aside className={`side-nav${isMenuOpen ? ' side-nav--open' : ''}`} aria-label="Hoofdnavigatie">
        <div className="brand">
          <DataTrendingRegular aria-hidden="true" /><span>Trading Monitor</span>
        </div>
        <nav>
          <p className="nav-label">Overzicht</p>
          <a
            className={`nav-item${currentPage === 'dashboard' ? ' nav-item--active' : ''}`}
            href="#dashboard"
            aria-current={currentPage === 'dashboard' ? 'page' : undefined}
          >
            <HomeRegular aria-hidden="true" />
            <span>Dashboard</span>
          </a>
          <a
            className={`nav-item${currentPage === 'stocks' ? ' nav-item--active' : ''}`}
            href="#stocks"
            aria-current={currentPage === 'stocks' ? 'page' : undefined}
          >
            <DataTrendingRegular aria-hidden="true" />
            <span>Stocks</span>
          </a>
          <a
            className={`nav-item${currentPage === 'options' ? ' nav-item--active' : ''}`}
            href="#options"
            aria-current={currentPage === 'options' ? 'page' : undefined}
          >
            <ArrowSwapRegular aria-hidden="true" />
            <span>Options</span>
          </a>
          <a className={`nav-item${currentPage === 'scans' ? ' nav-item--active' : ''}`} href="#scans" aria-current={currentPage === 'scans' ? 'page' : undefined}>
            <TargetArrowRegular aria-hidden="true" /><span>Scans</span>
          </a>
          <a
            className={`nav-item${currentPage === 'goals' ? ' nav-item--active' : ''}`}
            href="#goals"
            aria-current={currentPage === 'goals' ? 'page' : undefined}
          >
            <TargetArrowRegular aria-hidden="true" />
            <span>Goals</span>
          </a>
          <a
            className={`nav-item${currentPage === 'stats' ? ' nav-item--active' : ''}`}
            href="#stats"
            aria-current={currentPage === 'stats' ? 'page' : undefined}
          >
            <ChartMultipleRegular aria-hidden="true" />
            <span>Stats</span>
          </a>
          <a
            className={`nav-item${currentPage === 'trades' ? ' nav-item--active' : ''}`}
            href="#trades"
            aria-current={currentPage === 'trades' ? 'page' : undefined}
          >
            <HistoryRegular aria-hidden="true" />
            <span>Trades</span>
          </a>
        </nav>
        <button className="theme-toggle" type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>
          Donkere modus: {theme === 'dark' ? 'aan' : 'uit'}
        </button>
        <IbkrConnectionControl onSnapshot={handleLiveSnapshot} />
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>{pageTitles[currentPage]}</h1>
            {currentPage === 'dashboard' && <p className="page-subtitle">Je portefeuille in één oogopslag</p>}
          </div>
          {summary && currentPage !== 'scans' && (
            <div className="data-freshness" title={showLiveFreshness ? `IBKR-snapshot opgehaald op ${summary.sourceUpdatedAt}; historische Flex-basis t/m ${importedSummary?.balance.toDate}` : `Bronbestand gegenereerd op ${importedSummary?.sourceUpdatedAt}`}>
              <span className="data-freshness__pulse" aria-hidden="true" />
              <span>
                <strong>Bijgewerkt t/m {formatDate((showLiveFreshness ? summary : importedSummary)!.balance.toDate)}</strong>
                <small>{showLiveFreshness ? `IBKR live · Flex-basis t/m ${formatDate(importedSummary!.balance.toDate)}` : 'Historische Flex-gegevens'}</small>
              </span>
            </div>
          )}
        </header>

        {currentPage === 'scans' && <ScansPage />}
        {isLoading && currentPage !== 'scans' && <LoadingDashboard />}

        {!isLoading && error && currentPage !== 'scans' && (
          <section className="state-panel state-panel--error" role="alert">
            <div>
              <h2>Dashboarddata ontbreekt</h2>
              <p>{error}</p>
              <code>npm run import:flex</code>
            </div>
            <button type="button" onClick={() => void loadSummary()}>Opnieuw proberen</button>
          </section>
        )}

        {!isLoading && summary && currentPage === 'dashboard' && (
          <>
            <section className="portfolio-summary" aria-label="Portefeuillesaldo, totale winst, saldoverandering en jaarresultaat">
              <StatCard
                label="Portefeuillesaldo"
                metric={summary.balance}
                currency={summary.currency}
                context={`Netto liquidatiewaarde op ${formatDate(summary.balance.toDate)}`}
                prominent
              />
              <TotalProfitCard contributions={summary.contributionPeriods} startingBalance={summary.startingBalance} balance={summary.balance} currency={summary.currency} />
              <DailyProfitCard
                metric={summary.dailyProfit}
                balance={summary.balance}
                currency={summary.currency}
              />
              <StatCard
                label={`Jaarresultaat ${summary.yearProfit.toDate.slice(0, 4)}`}
                metric={summary.yearProfit}
                currency={summary.currency}
                context="Gerealiseerde opties en aandelen"
              />
            </section>
            <div className="monitor-row monitor-row--overview">
              <PortfolioTrend summary={summary} />
              <PortfolioAllocationCard allocation={summary.portfolioAllocation} balance={summary.balance} currency={summary.currency} />
            </div>
            <div className="monitor-row monitor-row--results">
              <NetMonthlyResults summary={summary} />
              <AnnualGoal summary={summary} />
            </div>
            <h2 className="details-heading">Handelsdetails <span>{summary.yearProfit.toDate.slice(0, 4)}</span></h2>
            <div className="monitor-row monitor-row--months">
              <MonthDetail label="Deze maand" result={summary.currentMonthProfit} premium={summary.premiumPeriods?.currentMonth} currency={summary.currency} premiumCurrency={summary.premiumCurrency ?? summary.currency} />
              <MonthDetail label="Vorige maand" result={summary.previousMonthProfit} premium={summary.premiumPeriods?.previousMonth} currency={summary.currency} premiumCurrency={summary.premiumCurrency ?? summary.currency} />
            </div>
            <section className="activity-grid" aria-label="Handelsstatistieken">
              <StatCard
                label="Gemiddeld per maand"
                metric={summary.averageMonthlyProfit}
                currency={summary.currency}
                context={`Gemiddelde over ${summary.averageMonthlyProfit.monthCount} kalendermaanden`}
              />
              {summary.tradingActivity && (
                <TradingActivityCards
                  activity={summary.tradingActivity}
                  premiumCurrency={summary.premiumCurrency ?? 'USD'}
                  year={summary.yearProfit.toDate.slice(0, 4)}
                />
              )}
            </section>
          </>
        )}

        {!isLoading && summary && currentPage === 'stocks' && (
          <StocksPage holdings={summary.stockHoldings ?? []} currency={summary.currency} />
        )}

        {!isLoading && summary && currentPage === 'options' && (
          <OptionsPage
            holdings={summary.optionHoldings ?? []}
            currency={summary.currency}
            asOfDate={summary.balance.toDate}
            reservedCash={summary.portfolioAllocation.reservedCash ?? 0}
            freeToSpend={summary.portfolioAllocation.freeToSpend ?? 0}
            unpricedContractCount={summary.portfolioAllocation.unpricedContractCount ?? 0}
          />
        )}

        {!isLoading && summary && currentPage === 'goals' && (
          <GoalsPage contributionPeriods={summary.contributionPeriods ?? []} goalPlan={summary.goalPlan ?? null} balance={summary.balance} currency={summary.currency} />
        )}

        {!isLoading && summary && currentPage === 'trades' && (
          <TradesPage trades={summary.closedTrades ?? []} currency={summary.premiumCurrency ?? summary.currency} pendingGatewayClosures={summary.pendingGatewayClosures} />
        )}

        {!isLoading && summary && currentPage === 'stats' && (
          <StatsPage
            trades={summary.closedTrades ?? []}
            portfolioHistory={summary.portfolioHistory ?? []}
            currency={summary.currency}
          />
        )}
      </main>
    </div>
  )
}

export default App
