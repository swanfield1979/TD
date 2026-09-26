import { useCallback, useEffect, useState } from 'react'
import {
  DataTrendingRegular,
  DismissRegular,
  HomeRegular,
  NavigationRegular,
} from '@fluentui/react-icons'
import type { MetricDirection, PortfolioMetric, PortfolioSummary } from './types'
import MonthlyBalanceChart from './MonthlyBalanceChart'
import PortfolioAllocationCard from './PortfolioAllocationCard'
import StocksPage from './StocksPage'
import TradingActivityCards from './TradingActivityCards'

const DATA_URL = '/data/portfolio-summary.json'
type Page = 'dashboard' | 'stocks'

const pageFromHash = (): Page => window.location.hash === '#stocks' ? 'stocks' : 'dashboard'

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
    document.title = `${currentPage === 'dashboard' ? 'Dashboard' : 'Stocks'} · Trading Monitor`
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
            className={`nav-item${currentPage === 'stocks' ? ' nav-item--active' : ''}`}
            href="#stocks"
            aria-current={currentPage === 'stocks' ? 'page' : undefined}
          >
            <DataTrendingRegular aria-hidden="true" />
            <span>Stocks</span>
          </a>
        </nav>
        <div className="side-nav__status">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Lokale gegevens</strong>
            <span>IBKR-koppeling volgt later</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>{currentPage === 'dashboard' ? 'Dashboard' : 'Stocks'}</h1>
          </div>
          {summary && (
            <div className="data-freshness" title={`Bronbestand gegenereerd op ${summary.sourceUpdatedAt}`}>
              <span className="data-freshness__pulse" aria-hidden="true" />
              <span>
                <strong>Bijgewerkt t/m {formatDate(summary.balance.toDate)}</strong>
                <small>{summary.sourceCounts.equityDays} handelsdagen verwerkt</small>
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
                label="Winst 2026"
                metric={summary.yearProfit}
                currency={summary.currency}
                context={`Sinds ${formatDate(summary.yearProfit.fromDate!)}`}
              />
              <StatCard
                label="Winst deze maand"
                metric={summary.currentMonthProfit}
                currency={summary.currency}
                context={`${formatDate(summary.currentMonthProfit.fromDate!)} – ${formatDate(summary.currentMonthProfit.toDate)}`}
              />
              <StatCard
                label="Winst vorige maand"
                metric={summary.previousMonthProfit}
                currency={summary.currency}
                context={`${formatDate(summary.previousMonthProfit.fromDate!)} – ${formatDate(summary.previousMonthProfit.toDate)}`}
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
      </main>
    </div>
  )
}

export default App
