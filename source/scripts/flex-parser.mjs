import { mergeOptionEvents, realizedResults, premiumSummary, tradingResult, closedOptionTrades } from './realized-results.mjs'
import { assignOptionStrategies } from '../shared/option-strategy.mjs'
import { portfolioAllocation as buildPortfolioAllocation } from '../shared/portfolio-risk.mjs'

const MONTHS_IN_YEAR = 12
const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const GOAL_GROWTH_PERCENTAGE = 30
const GOAL_ANNUAL_CONTRIBUTION = 12000
const GOAL_PLANNING_YEARS = 5

function decodeXml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

export function parseAttributes(fragment) {
  const attributes = {}
  const pattern = /([\w:-]+)\s*=\s*(["'])(.*?)\2/gs
  for (const match of fragment.matchAll(pattern)) attributes[match[1]] = decodeXml(match[3])
  return attributes
}

export function extractTags(xml, tagName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)\\/?>(?:<\\/${tagName}>)?`, 'g')
  return [...xml.matchAll(pattern)].map((match) => parseAttributes(match[1]))
}

function metric(value, fromDate, toDate) {
  return {
    value: Number(value.toFixed(2)),
    ...(fromDate ? { fromDate } : {}),
    toDate,
    direction: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
  }
}

function lastBefore(rows, date) { return rows.filter((row) => row.date < date).at(-1) }
function firstOnOrAfter(rows, date) { return rows.find((row) => row.date >= date) }
function dateAtMonthStart(value) { return `${value.slice(0, 7)}-01` }

function shiftMonth(value, amount) {
  const date = new Date(`${dateAtMonthStart(value)}T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return date.toISOString().slice(0, 10)
}

function elapsedMonthCount(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00Z`)
  const end = new Date(`${endDate}T12:00:00Z`)
  return Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * MONTHS_IN_YEAR + end.getUTCMonth() - start.getUTCMonth())
}

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals))
}

function normalizeOptionTrades(trades) {
  return trades
    .filter((trade) => trade.assetCategory === 'OPT')
    .map((trade) => ({
      conid: trade.conid,
      dateTime: trade.dateTime,
      quantity: Number(trade.quantity),
      tradePrice: Number(trade.tradePrice),
      commission: Number(trade.ibCommission),
      realizedPnl: Number(trade.fifoPnlRealized),
      openClose: trade.openCloseIndicator,
      symbol: trade.underlyingSymbol || trade.symbol,
      name: trade.description || trade.underlyingSymbol || trade.symbol,
      expiry: trade.expiry,
      optionRight: trade.putCall || trade.subCategory,
      strike: Number(trade.strike),
    }))
    .filter((trade) => trade.conid && trade.dateTime && Number.isFinite(trade.quantity) && Number.isFinite(trade.tradePrice))
}

function optionHoldingsSummary(optionTrades) {
  const tradesByContract = Map.groupBy(optionTrades, (trade) => trade.conid)
  const holdings = []

  for (const [conid, contractTrades] of tradesByContract) {
    const lots = []

    for (const trade of contractTrades) {
      if (trade.openClose === 'O' && Math.abs(trade.quantity) >= 0.000_001) {
        lots.push({
          quantity: Math.abs(trade.quantity),
          direction: Math.sign(trade.quantity),
          openedAt: trade.dateTime.slice(0, 10),
          tradePrice: trade.tradePrice,
        })
        continue
      }

      if (trade.openClose !== 'C' || Math.abs(trade.quantity) < 0.000_001) continue
      let quantityToClose = Math.abs(trade.quantity)
      const directionToClose = -Math.sign(trade.quantity)

      for (const lot of lots) {
        if (quantityToClose <= 0 || lot.direction !== directionToClose || lot.quantity <= 0) continue
        const closedQuantity = Math.min(quantityToClose, lot.quantity)
        lot.quantity -= closedQuantity
        quantityToClose -= closedQuantity
      }
    }

    const remainingLots = lots.filter((lot) => lot.quantity >= 0.000_001)
    if (remainingLots.length === 0) continue
    const quantity = remainingLots.reduce((sum, lot) => sum + lot.quantity * lot.direction, 0)
    if (Math.abs(quantity) < 0.000_001) continue

    const absoluteQuantity = remainingLots.reduce((sum, lot) => sum + lot.quantity, 0)
    const metadata = contractTrades.at(-1)
    const expiry = metadata.expiry || null
    const chosenDte = expiry
      ? round(remainingLots.reduce((sum, lot) => sum + calendarDaysBetween(lot.openedAt, expiry) * lot.quantity, 0) / absoluteQuantity)
      : null

    holdings.push({
      conid,
      symbol: metadata.symbol || conid,
      name: metadata.name || metadata.symbol || conid,
      quantity: round(quantity, 4),
      optionRight: metadata.optionRight || null,
      strike: Number.isFinite(metadata.strike) ? metadata.strike : null,
      expiry,
      openedAt: remainingLots.map((lot) => lot.openedAt).sort()[0],
      chosenDte,
      averageOpenPrice: round(remainingLots.reduce((sum, lot) => sum + lot.tradePrice * lot.quantity, 0) / absoluteQuantity, 4),
      currentPrice: null,
      currentValue: null,
      difference: null,
      differencePercentage: null,
    })
  }

  return assignOptionStrategies(holdings)
    .sort((left, right) => `${left.expiry || ''}${left.symbol}${left.strike}`.localeCompare(`${right.expiry || ''}${right.symbol}${right.strike}`))
}

function monthlyTradingResult(results, month, fromDate, toDate) {
  const result = tradingResult(results, month)
  return { ...metric(result.value, fromDate, toDate), premium: result.premium,
    stockSales: result.stockSales }
}

function calendarDaysBetween(startDateTime, endDateTime) {
  const start = new Date(`${startDateTime.slice(0, 10)}T00:00:00Z`)
  const end = new Date(`${endDateTime.slice(0, 10)}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function tradingActivitySummary(results, closedTrades, openTrades, year) {
  const tradesInYear = results.filter((trade) => trade.closedAt.startsWith(`${year}-`))
  const closedInYear = closedTrades.filter((trade) => trade.closedAt.startsWith(`${year}-`))
  const closedDurations = closedInYear
    .map((trade) => trade.daysHeld)
    .filter((days) => days !== null)
  const premium = premiumSummary(tradesInYear)
  const averageDaysHeld = closedDurations.length
    ? closedDurations.reduce((sum, days) => sum + days, 0) / closedDurations.length
    : 0

  return {
    totalTrades: closedInYear.length + openTrades,
    closedTrades: closedInYear.length,
    openTrades,
    premiumCapturePercentage: premium.received ? round((premium.net / premium.received) * 100, 1) : 0,
    grossPremium: premium.received,
    netPremium: premium.net,
    averageDaysHeld: round(averageDaysHeld, 1),
    minimumDaysHeld: closedDurations.length ? Math.min(...closedDurations) : 0,
    maximumDaysHeld: closedDurations.length ? Math.max(...closedDurations) : 0,
    measuredClosedTrades: closedDurations.length,
  }
}

function stockHoldingsSummary(trades) {
  const stockTrades = trades
    .filter((trade) => trade.assetCategory === 'STK')
    .map((trade) => ({
      conid: trade.conid,
      symbol: trade.underlyingSymbol,
      name: trade.description,
      dateTime: trade.dateTime,
      quantity: Number(trade.quantity),
      tradePrice: Number(trade.tradePrice),
      commission: Number(trade.ibCommission),
      openClose: trade.openCloseIndicator,
    }))
    .filter((trade) => trade.conid && trade.dateTime && Number.isFinite(trade.quantity) && Number.isFinite(trade.tradePrice))

  const lotsByContract = Map.groupBy(stockTrades, (trade) => trade.conid)
  const holdings = []

  for (const [conid, contractTrades] of lotsByContract) {
    const lots = []

    for (const trade of contractTrades) {
      if (trade.openClose === 'O' && trade.quantity > 0) {
        const commissionPerShare = Number.isFinite(trade.commission)
          ? Math.abs(trade.commission) / trade.quantity
          : 0
        lots.push({ quantity: trade.quantity, unitCost: trade.tradePrice + commissionPerShare })
        continue
      }

      if (trade.openClose !== 'C' || trade.quantity >= 0) continue
      let quantityToClose = Math.abs(trade.quantity)

      while (quantityToClose > 0 && lots.length > 0) {
        const lot = lots[0]
        const closedQuantity = Math.min(quantityToClose, lot.quantity)
        lot.quantity -= closedQuantity
        quantityToClose -= closedQuantity
        if (lot.quantity <= 0.000_001) lots.shift()
      }
    }

    const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0)
    if (quantity <= 0.000_001) continue

    const purchaseValue = lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0)
    const metadata = contractTrades.at(-1)
    holdings.push({
      conid,
      symbol: metadata.symbol || metadata.name || conid,
      name: metadata.name || metadata.symbol || conid,
      quantity: round(quantity, 4),
      averagePurchasePrice: round(purchaseValue / quantity, 4),
      purchaseValue: round(purchaseValue),
      currentPrice: null,
      currentValue: null,
      difference: null,
      differencePercentage: null,
      dailyChangePercentage: null,
    })
  }

  return holdings.sort((left, right) => left.symbol.localeCompare(right.symbol))
}

function portfolioAllocation(stockHoldings, optionHoldings, latest) {
  const stocks = round(stockHoldings.reduce((sum, holding) => sum + holding.purchaseValue, 0))
  const options = round(-Math.abs(latest.totalShort))
  const cashOther = round(latest.total - stocks - options)
  return buildPortfolioAllocation({
    balance: latest.total,
    stockValue: stocks,
    optionValue: options,
    cashValue: cashOther,
    optionHoldings,
    isEstimated: true,
  })
}

function monthlyBalanceChangesForYear(rows, year) {
  const yearStartDate = `${year}-01-01`
  const yearRows = rows.filter((row) => row.date.startsWith(`${year}-`))
  let previous = lastBefore(rows, yearStartDate) ?? yearRows[0]

  return MONTH_LABELS.map((label, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    const monthRows = rows.filter((row) => row.date.startsWith(month))
    const monthEnd = monthRows.at(-1)

    if (!previous || !monthEnd) {
      return { month, label, value: null, balance: null, direction: null }
    }

    const value = monthEnd.total - previous.total
    const result = {
      month,
      label,
      value: Number(value.toFixed(2)),
      balance: Number(monthEnd.total.toFixed(2)),
      fromDate: previous.date,
      toDate: monthEnd.date,
      direction: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
    }
    previous = monthEnd
    return result
  })
}

function monthlyPortfolioHistory(rows) {
  const lastRowByMonth = new Map()
  rows.forEach((row) => lastRowByMonth.set(row.date.slice(0, 7), row))

  return [...lastRowByMonth.entries()].map(([month, row]) => ({
    month,
    date: row.date,
    balance: round(row.total),
  }))
}

function goalPlanSummary(rows, latest, contributions = []) {
  const expectedContribution = (year) => Math.max(GOAL_ANNUAL_CONTRIBUTION, contributions.find((row) => row.year === year)?.net ?? 0)
  const currentYear = Number(latest.date.slice(0, 4))
  const baseYear = currentYear - 1
  const baseYearEnd = rows.filter((row) => row.date.startsWith(`${baseYear}-`)).at(-1)
  if (!baseYearEnd) return null

  const completedStart = rows.filter((row) => row.date.startsWith(`${baseYear - 1}-`)).at(-1)
  const completedGoal = completedStart ? {
    year: baseYear,
    startValue: round(completedStart.total),
    growthValue: round(completedStart.total * (GOAL_GROWTH_PERCENTAGE / 100)),
    contribution: GOAL_ANNUAL_CONTRIBUTION,
    targetValue: round(completedStart.total * (1 + GOAL_GROWTH_PERCENTAGE / 100) + expectedContribution(baseYear)),
    resultValue: round(baseYearEnd.total),
    resultDate: baseYearEnd.date,
    status: 'completed',
  } : null

  let startValue = baseYearEnd.total
  const plannedYears = Array.from({ length: GOAL_PLANNING_YEARS }, (_, index) => {
    const year = currentYear + index
    const growthValue = startValue * (GOAL_GROWTH_PERCENTAGE / 100)
    const targetValue = startValue + growthValue + expectedContribution(year)
    const projection = {
      year,
      startValue: round(startValue),
      growthValue: round(growthValue),
      contribution: GOAL_ANNUAL_CONTRIBUTION,
      targetValue: round(targetValue),
      resultValue: index === 0 ? round(latest.total) : null,
      resultDate: index === 0 ? latest.date : null,
      status: index === 0 ? 'current' : 'planned',
    }
    startValue = targetValue
    return projection
  })

  return {
    baseYear,
    baseYearEndDate: baseYearEnd.date,
    baseYearEndValue: round(baseYearEnd.total),
    annualGrowthPercentage: GOAL_GROWTH_PERCENTAGE,
    annualContribution: GOAL_ANNUAL_CONTRIBUTION,
    years: completedGoal ? [completedGoal, ...plannedYears] : plannedYears,
  }
}

export function cashContributionPeriods(xml, currency = 'USD') {
  const reports = new Map()
  const iso = (value) => /^\d{8}$/.test(value || '') ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value
  for (const match of xml.matchAll(/<FlexStatement\b([^>]*)>([\s\S]*?)<\/FlexStatement>/g)) {
    const statement = parseAttributes(match[1])
    const fromDate = iso(statement.fromDate)
    const toDate = iso(statement.toDate)
    if (!fromDate || !toDate || fromDate.slice(0, 4) !== toDate.slice(0, 4)) throw new Error('Stortingsrapport moet één kalenderjaar bevatten.')
    const rows = extractTags(match[2], 'CashReportCurrency')
    // These supplied Flex exports omit the currency column. IBKR lists the
    // consolidated base-currency summary first, followed by currency breakouts.
    const base = rows.find((row) => row.currency === 'BASE_SUMMARY') ?? (!rows[0]?.currency ? rows[0] : null)
    if (!base || base.depositWithdrawals === undefined || !Number.isFinite(Number(base.depositWithdrawals))) throw new Error('Basistotaal stortingen/opnames ontbreekt in Cash Report.')
    const byCurrency = new Map()
    for (const transaction of extractTags(match[2], 'CashTransaction').filter((row) => row.type === 'Deposits/Withdrawals')) {
      const amount = Number(transaction.amount)
      if (!transaction.currency || !Number.isFinite(amount)) throw new Error('Ongeldige storting/opname.')
      const totals = byCurrency.get(transaction.currency) ?? { currency: transaction.currency, deposits: 0, withdrawals: 0, net: 0 }
      totals.deposits += Math.max(0, amount)
      totals.withdrawals += Math.max(0, -amount)
      totals.net += amount
      byCurrency.set(transaction.currency, totals)
    }
    const report = { year: Number(fromDate.slice(0, 4)), fromDate, toDate, currency,
      net: Math.sign(Number(base.depositWithdrawals)) * Math.round(Math.abs(Number(base.depositWithdrawals)) * 100) / 100, currencyInferred: !base.currency,
      currencies: [...byCurrency.values()].map((row) => ({ ...row, deposits: round(row.deposits), withdrawals: round(row.withdrawals), net: round(row.net) })) }
    const key = `${statement.accountId || ''}|${report.year}`
    const previous = reports.get(key)
    if (previous && previous.fromDate !== fromDate) throw new Error('Overlappende stortingsrapporten met verschillende begindatums; gebruik één cumulatief rapport per jaar.')
    if (previous?.toDate === toDate && previous.net !== report.net) throw new Error('Tegenstrijdige stortingsrapporten voor dezelfde periode.')
    if (!previous || toDate >= previous.toDate) reports.set(key, report)
  }
  const periods = [...reports.values()].sort((a, b) => a.fromDate.localeCompare(b.fromDate))
  if (new Set(periods.map((period) => period.year)).size !== periods.length) throw new Error('Stortingen van meerdere rekeningen kunnen niet met één portefeuillesaldo worden vergeleken.')
  return periods
}

export function createPortfolioSummary({ equityXml, tradesXml, optionXml, contributionsXml = '', currency = 'USD', premiumCurrency = 'USD', generatedAt = new Date().toISOString() }) {
  const statements = extractTags(`${equityXml}\n${tradesXml}\n${optionXml}`, 'FlexStatement')
  const statement = statements
    .filter(({ whenGenerated }) => whenGenerated)
    .sort((left, right) => left.whenGenerated.localeCompare(right.whenGenerated))
    .at(-1)
  const seenExecutionIds = new Set()
  const rawTrades = extractTags(tradesXml, 'Trade').filter((trade) => {
    if (!trade.ibExecID) return true
    if (seenExecutionIds.has(trade.ibExecID)) return false
    seenExecutionIds.add(trade.ibExecID)
    return true
  })
  const rowsByDate = new Map(extractTags(equityXml, 'EquitySummaryByReportDateInBase')
    .map((attributes) => ({
      date: attributes.reportDate,
      total: Number(attributes.total),
      totalLong: Number(attributes.totalLong ?? attributes.total),
      totalShort: Number(attributes.totalShort ?? 0),
    }))
    .filter((row) => row.date && Number.isFinite(row.total))
    .map((row) => [row.date, row]))
  const rows = [...rowsByDate.values()].sort((left, right) => left.date.localeCompare(right.date))

  if (rows.length === 0) throw new Error('Geen dagsaldi gevonden in het Flex-rapport.')

  const latest = rows.at(-1)
  const contributionPeriods = cashContributionPeriods(contributionsXml, currency)
  const startingBalance = rows.find((row) => row.date === '2024-12-31')
    ?? rows.find((row) => row.date.startsWith('2025-'))
  const trades = mergeOptionEvents(rawTrades, extractTags(optionXml, 'OptionEAE'))
    .filter((trade) => trade.dateTime?.slice(0, 10) <= latest.date)
  const tradesThroughDate = rawTrades
    .map((trade) => trade.dateTime?.slice(0, 10))
    .filter((date) => date && date <= latest.date)
    .sort()
    .at(-1)
  const optionTrades = normalizeOptionTrades(trades)
  const results = realizedResults(trades)
  const yearStartDate = `${latest.date.slice(0, 4)}-01-01`
  const start = lastBefore(rows, yearStartDate) ?? firstOnOrAfter(rows, yearStartDate)
  const currentMonthStart = dateAtMonthStart(latest.date)
  const previousMonthStart = shiftMonth(currentMonthStart, -1)
  const currentMonthBase = lastBefore(rows, currentMonthStart)
  const previousMonthBase = lastBefore(rows, previousMonthStart)

  if (!start || !currentMonthBase || !previousMonthBase) throw new Error('Onvoldoende dagsaldi om alle periodes te berekenen.')

  const yearProfit = tradingResult(results, latest.date.slice(0, 4)).value
  const monthCount = elapsedMonthCount(start.date, latest.date)
  const currentMonth = latest.date.slice(0, 7)
  const previousMonth = shiftMonth(`${currentMonth}-01`, -1).slice(0, 7)
  const stockHoldings = stockHoldingsSummary(trades)
  const optionHoldings = optionHoldingsSummary(optionTrades)
  const closedTrades = closedOptionTrades(results)
  const premiumForMonth = (month) => ({
    month,
    ...premiumSummary(results.filter((trade) => trade.closedAt.startsWith(month))),
  })

  return {
    generatedAt,
    // The statement end date can be a day without executions. Using it as the
    // overlap boundary would discard Gateway mutations made on that day.
    tradesThroughDate: tradesThroughDate || latest.date,
    sourceUpdatedAt: statement?.whenGenerated ?? latest.date,
    currency,
    premiumCurrency,
    sourceCounts: {
      equityDays: rows.length,
      trades: rawTrades.length,
      optionEvents: extractTags(optionXml, 'OptionEAE').length,
    },
    balance: metric(latest.total, undefined, latest.date),
    startingBalance: startingBalance ? { value: round(startingBalance.total), date: startingBalance.date } : null,
    contributionPeriods,
    dailyProfit: metric(latest.total - rows.at(-2).total, rows.at(-2).date, latest.date),
    yearProfit: metric(yearProfit, start.date, latest.date),
    currentMonthProfit: monthlyTradingResult(results, currentMonth, currentMonthBase.date, latest.date),
    previousMonthProfit: monthlyTradingResult(results, previousMonth, previousMonthBase.date, currentMonthBase.date),
    averageMonthlyProfit: { ...metric(yearProfit / monthCount, start.date, latest.date), monthCount },
    monthlyTradingResults: Array.from({ length: Number(latest.date.slice(5, 7)) }, (_, index) => {
      const month = `${latest.date.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`
      const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), index + 1, 0)).toISOString().slice(0, 10)
      return { month, ...monthlyTradingResult(results, month, `${month}-01`, month === currentMonth ? latest.date : monthEnd) }
    }),
    monthlyBalanceChanges: monthlyBalanceChangesForYear(rows, latest.date.slice(0, 4)),
    previousYearMonthlyBalanceChanges: monthlyBalanceChangesForYear(
      rows,
      String(Number(latest.date.slice(0, 4)) - 1),
    ),
    portfolioHistory: monthlyPortfolioHistory(rows),
    tradingActivity: tradingActivitySummary(results, closedTrades, optionHoldings.length, latest.date.slice(0, 4)),
    stockHoldings,
    optionHoldings,
    closedTrades,
    goalPlan: goalPlanSummary(rows, latest, contributionPeriods),
    portfolioAllocation: portfolioAllocation(stockHoldings, optionHoldings, latest),
    premiumPeriods: {
      currentMonth: premiumForMonth(currentMonth),
      previousMonth: premiumForMonth(previousMonth),
    },
  }
}
