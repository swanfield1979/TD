import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownRegular,
  ArrowTrendingRegular,
  ArrowUpRegular,
  CalendarMonthRegular,
  DataTrendingRegular,
  DismissRegular,
  HomeRegular,
  NavigationRegular,
  WalletRegular,
} from '@fluentui/react-icons'
import type { MetricDirection, PortfolioMetric, PortfolioSummary } from './types'
import MonthlyBalanceChart from './MonthlyBalanceChart'
import TradingActivityCards from './TradingActivityCards'

const DATA_URL = '/data/portfolio-summary.json'

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  icon: React.ReactNode
}

function StatCard({ label, metric, currency, context, prominent = false, icon }: StatCardProps) {
  const DirectionIcon =
    metric.direction === 'positive'
      ? ArrowUpRegular
      : metric.direction === 'negative'
        ? ArrowDownRegular
        : ArrowTrendingRegular

  return (
    <article className={`stat-card${prominent ? ' stat-card--prominent' : ''}`}>
      <div className="stat-card__header">
        <span className="stat-card__icon" aria-hidden="true">{icon}</span>
        <h2>{label}</h2>
      </div>
      <p className={`stat-card__value metric--${metric.direction}`}>
        {currencyFormatter(currency).format(metric.value)}
      </p>
      <div className="stat-card__footer">
        {!prominent && (
          <span className={`direction direction--${metric.direction}`}>
            <DirectionIcon aria-hidden="true" />
            {directionLabel[metric.direction]}
          </span>
        )}
        <span className="stat-card__context">{context}</span>
      </div>
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
          <a className="nav-item nav-item--active" href="/" aria-current="page">
            <HomeRegular aria-hidden="true" />
            <span>Dashboard</span>
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
            <h1>Dashboard</h1>
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

        {!isLoading && summary && (
          <>
            <section className="dashboard-grid" aria-label="Portfoliostatistieken">
              <StatCard
                label="Saldo"
                metric={summary.balance}
                currency={summary.currency}
                context={`Netto liquidatiewaarde op ${formatDate(summary.balance.toDate)}`}
                prominent
                icon={<WalletRegular />}
              />
              <StatCard
                label="Winst 2026"
                metric={summary.yearProfit}
                currency={summary.currency}
                context={`Sinds ${formatDate(summary.yearProfit.fromDate!)}`}
                icon={<DataTrendingRegular />}
              />
              <StatCard
                label="Winst deze maand"
                metric={summary.currentMonthProfit}
                currency={summary.currency}
                context={`${formatDate(summary.currentMonthProfit.fromDate!)} – ${formatDate(summary.currentMonthProfit.toDate)}`}
                icon={<CalendarMonthRegular />}
              />
              <StatCard
                label="Winst vorige maand"
                metric={summary.previousMonthProfit}
                currency={summary.currency}
                context={`${formatDate(summary.previousMonthProfit.fromDate!)} – ${formatDate(summary.previousMonthProfit.toDate)}`}
                icon={<CalendarMonthRegular />}
              />
              <StatCard
                label="Gemiddeld per maand"
                metric={summary.averageMonthlyProfit}
                currency={summary.currency}
                context={`Gemiddelde over ${summary.averageMonthlyProfit.monthCount} kalendermaanden`}
                icon={<ArrowTrendingRegular />}
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
      </main>
    </div>
  )
}

export default App
