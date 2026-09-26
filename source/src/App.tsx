import { useCallback, useEffect, useState } from 'react'
import {
  ArrowSwapRegular,
  DataTrendingRegular,
  DismissRegular,
  HomeRegular,
  HistoryRegular,
  NavigationRegular,
  TargetArrowRegular,
} from '@fluentui/react-icons'
import type { MetricDirection, PortfolioMetric, PortfolioSummary } from './types'
import MonthlyBalanceChart from './MonthlyBalanceChart'
import PortfolioAllocationCard from './PortfolioAllocationCard'
import StocksPage from './StocksPage'
import OptionsPage from './OptionsPage'
import GoalsPage from './GoalsPage'
import TradesPage from './TradesPage'
import TradingActivityCards from './TradingActivityCards'
import IbkrConnectionControl from './IbkrConnectionControl'
import { mergeLiveSnapshot } from './ibkr'

const DATA_URL = '/data/portfolio-summary.json'
type Page = 'dashboard' | 'stocks' | 'options' | 'goals' | 'trades'

const pageFromHash = (): Page => {
  if (window.location.hash === '#stocks') return 'stocks'
  if (window.location.hash === '#options') return 'options'
  if (window.location.hash === '#goals') return 'goals'
  if (window.location.hash === '#trades') return 'trades'
  return 'dashboard'
}

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  stocks: 'Stocks',
  options: 'Options',
  goals: 'Goals',
  trades: 'Trades',
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
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>(pageFromHash)
  const [hasLiveSnapshot, setHasLiveSnapshot] = useState(false)

  const handleLiveSnapshot = useCallback((snapshot: Parameters<typeof mergeLiveSnapshot>[1]) => {
    setSummary((current) => current ? mergeLiveSnapshot(current, snapshot) : current)
    setHasLiveSnapshot(true)
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
          <img src="/assets/trading-monitor-logo.png" alt="Trading Monitor" />
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
            className={`nav-item${currentPage === 'options' ? ' nav-item--active' : ''}`}
            href="#options"
            aria-current={currentPage === 'options' ? 'page' : undefined}
          >
            <ArrowSwapRegular aria-hidden="true" />
            <span>Options</span>
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
            className={`nav-item${currentPage === 'stocks' ? ' nav-item--active' : ''}`}
            href="#stocks"
            aria-current={currentPage === 'stocks' ? 'page' : undefined}
          >
            <DataTrendingRegular aria-hidden="true" />
            <span>Stocks</span>
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
        <IbkrConnectionControl onSnapshot={handleLiveSnapshot} />
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>{pageTitles[currentPage]}</h1>
          </div>
          {summary && (
            <div className="data-freshness" title={hasLiveSnapshot ? `IBKR-snapshot opgehaald op ${summary.sourceUpdatedAt}` : `Bronbestand gegenereerd op ${summary.sourceUpdatedAt}`}>
              <span className="data-freshness__pulse" aria-hidden="true" />
              <span>
                <strong>Bijgewerkt t/m {formatDate(summary.balance.toDate)}</strong>
                <small>{hasLiveSnapshot ? 'Actuele IBKR-positiegegevens' : `${summary.sourceCounts.equityDays} handelsdagen verwerkt`}</small>
              </span>
            </div>
          )}
        </header>

        {isLoading && <LoadingDashboard />}

        {!isLoading && error && (
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
            <section className="portfolio-summary" aria-label="Saldo en portefeuilleverdeling">
              <StatCard
                label="Saldo"
                metric={summary.balance}
                currency={summary.currency}
                context={`Netto liquidatiewaarde op ${formatDate(summary.balance.toDate)}`}
                prominent
              />
              <PortfolioAllocationCard
                allocation={summary.portfolioAllocation}
                balance={summary.balance}
                dailyProfit={summary.dailyProfit}
                currency={summary.currency}
              />
            </section>
            <section className="dashboard-grid dashboard-grid--performance" aria-label="Portfoliostatistieken">
              <StatCard
                label="Nettoresultaat 2026"
                metric={summary.yearProfit}
                currency={summary.currency}
                context={`Mutatie netto liquidatiewaarde sinds ${formatDate(summary.yearProfit.fromDate!)}`}
              />
              <StatCard
                label="Nettoresultaat deze maand"
                metric={summary.currentMonthProfit}
                currency={summary.currency}
                context={`Netto liquidatiewaarde · ${formatDate(summary.currentMonthProfit.fromDate!)} – ${formatDate(summary.currentMonthProfit.toDate)}`}
              />
              <StatCard
                label="Nettoresultaat vorige maand"
                metric={summary.previousMonthProfit}
                currency={summary.currency}
                context={`Netto liquidatiewaarde · ${formatDate(summary.previousMonthProfit.fromDate!)} – ${formatDate(summary.previousMonthProfit.toDate)}`}
              />
              <StatCard
                label="Gemiddeld per maand"
                metric={summary.averageMonthlyProfit}
                currency={summary.currency}
                context={`Gemiddelde over ${summary.averageMonthlyProfit.monthCount} kalendermaanden`}
              />
            </section>
            {summary.tradingActivity && summary.premiumPeriods && (
              <TradingActivityCards
                activity={summary.tradingActivity}
                currentPremium={summary.premiumPeriods.currentMonth}
                previousPremium={summary.premiumPeriods.previousMonth}
                premiumCurrency={summary.premiumCurrency ?? 'USD'}
              />
            )}
            <MonthlyBalanceChart
              data={summary.monthlyBalanceChanges ?? []}
              currency={summary.currency}
              year={summary.balance.toDate.slice(0, 4)}
            />
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
          />
        )}

        {!isLoading && summary && currentPage === 'goals' && (
          <GoalsPage goalPlan={summary.goalPlan ?? null} balance={summary.balance} currency={summary.currency} />
        )}

        {!isLoading && summary && currentPage === 'trades' && (
          <TradesPage trades={summary.closedTrades ?? []} currency={summary.premiumCurrency ?? summary.currency} />
        )}
      </main>
    </div>
  )
}

export default App
