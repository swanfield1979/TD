import { assignOptionStrategies } from '../shared/option-strategy.mjs'

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
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
}

function closedTradesSummary(optionTrades) {
  const tradesByContract = Map.groupBy(optionTrades, (trade) => trade.conid)
  const closedTrades = []

  for (const [conid, contractTrades] of tradesByContract) {
    let position = 0
    let cycleIndex = 0
    let cycle = null
    let priorPeriodCycle = null

    for (const trade of contractTrades) {
      const commission = Number.isFinite(trade.commission) ? trade.commission : 0

      if (trade.openClose === 'O') {
        if (priorPeriodCycle) {
          closedTrades.push(priorPeriodCycle)
          priorPeriodCycle = null
        }
        if (!cycle || Math.abs(position) < 0.000_001) {
          cycleIndex += 1
          cycle = {
            id: `${conid}-${cycleIndex}`,
            conid,
            symbol: trade.symbol || conid,
            name: trade.name || trade.symbol || conid,
            optionRight: trade.optionRight || null,
            strike: Number.isFinite(trade.strike) ? trade.strike : null,
            expiry: trade.expiry || null,
            direction: trade.quantity < 0 ? 'short' : 'long',
            quantity: 0,
            openedAt: trade.dateTime.slice(0, 10),
            closedAt: null,
            daysHeld: null,
            openingValue: 0,
            profit: 0,
            profitPercentage: null,
            annualizedPercentage: null,
            cashFlow: 0,
          }
          position = 0
        }
        cycle.quantity += Math.abs(trade.quantity)
        cycle.openingValue += Math.abs(trade.quantity * trade.tradePrice * 100)
        cycle.cashFlow += -trade.quantity * trade.tradePrice * 100 + commission
        position += trade.quantity
        continue
      }

      if (trade.openClose !== 'C') continue
      if (!cycle || Math.abs(position) < 0.000_001) {
        const realizedPnl = Number.isFinite(trade.realizedPnl) ? trade.realizedPnl : 0
        if (!priorPeriodCycle) {
          cycleIndex += 1
          priorPeriodCycle = {
            id: `${conid}-prior-${cycleIndex}`,
            conid,
            symbol: trade.symbol || conid,
            name: trade.name || trade.symbol || conid,
            optionRight: trade.optionRight || null,
            strike: Number.isFinite(trade.strike) ? trade.strike : null,
            expiry: trade.expiry || null,
            direction: trade.quantity > 0 ? 'short' : 'long',
            quantity: 0,
            openedAt: null,
            closedAt: trade.dateTime.slice(0, 10),
            daysHeld: null,
            openingValue: null,
            profit: 0,
            profitPercentage: null,
            annualizedPercentage: null,
          }
        }
        priorPeriodCycle.quantity += Math.abs(trade.quantity)
        priorPeriodCycle.closedAt = trade.dateTime.slice(0, 10)
        priorPeriodCycle.profit += realizedPnl + commission
        continue
      }

      cycle.cashFlow += -trade.quantity * trade.tradePrice * 100 + commission
      position += trade.quantity
      if (Math.abs(position) >= 0.000_001) continue

      cycle.closedAt = trade.dateTime.slice(0, 10)
      cycle.daysHeld = calendarDaysBetween(cycle.openedAt, cycle.closedAt)
      cycle.profit = round(cycle.cashFlow)
      cycle.openingValue = round(cycle.openingValue)
      cycle.profitPercentage = cycle.openingValue ? round((cycle.profit / cycle.openingValue) * 100, 1) : null
      cycle.annualizedPercentage = cycle.profitPercentage === null
        ? null
        : round(cycle.profitPercentage * (365 / Math.max(1, cycle.daysHeld)), 1)
      delete cycle.cashFlow
      closedTrades.push(cycle)
      cycle = null
      position = 0
    }

    if (priorPeriodCycle) {
      priorPeriodCycle.profit = round(priorPeriodCycle.profit)
      closedTrades.push(priorPeriodCycle)
    }
  }

  return closedTrades.sort((left, right) =>
    `${right.closedAt}${right.id}`.localeCompare(`${left.closedAt}${left.id}`),
  )
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

function premiumSummary(optionTrades) {
  const received = optionTrades
    .filter((trade) => trade.openClose === 'O' && trade.quantity < 0)
    .reduce((sum, trade) => sum + -trade.quantity * trade.tradePrice * 100, 0)
  const buyback = optionTrades
    .filter((trade) => trade.openClose === 'C' && trade.quantity > 0)
    .reduce((sum, trade) => sum + trade.quantity * trade.tradePrice * 100, 0)
  const rawCommission = optionTrades.reduce(
    (sum, trade) => sum + (Number.isFinite(trade.commission) ? trade.commission : 0),
    0,
  )

  return {
    received: round(received),
    buyback: round(buyback),
    commission: round(Math.abs(rawCommission)),
    net: round(received - buyback + rawCommission),
  }
}

function calendarDaysBetween(startDateTime, endDateTime) {
  const start = new Date(`${startDateTime.slice(0, 10)}T00:00:00Z`)
  const end = new Date(`${endDateTime.slice(0, 10)}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function tradingActivitySummary(optionTrades) {
  const tradesByContract = Map.groupBy(optionTrades, (trade) => trade.conid)
  const closedDurations = []
  let closedTrades = 0
  let openTrades = 0

  for (const contractTrades of tradesByContract.values()) {
    let position = 0
    let openedAt
    let hasPriorPeriodClose = false

    for (const trade of contractTrades) {
      if (trade.openClose === 'O') {
        if (Math.abs(position) < 0.000_001) openedAt = trade.dateTime
        position += trade.quantity
        continue
      }

      if (trade.openClose !== 'C') continue
      if (Math.abs(position) < 0.000_001) {
        hasPriorPeriodClose = true
        continue
      }

      position += trade.quantity
      if (Math.abs(position) < 0.000_001) {
        closedTrades += 1
        if (openedAt) closedDurations.push(calendarDaysBetween(openedAt, trade.dateTime))
        position = 0
        openedAt = undefined
      }
    }

    if (hasPriorPeriodClose) closedTrades += 1
    if (Math.abs(position) >= 0.000_001) openTrades += 1
  }

  const premium = premiumSummary(optionTrades)
  const averageDaysHeld = closedDurations.length
    ? closedDurations.reduce((sum, days) => sum + days, 0) / closedDurations.length
    : 0

  return {
    totalTrades: closedTrades + openTrades,
    closedTrades,
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
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime))

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

function portfolioAllocation(stockHoldings, latest) {
  const stocks = round(stockHoldings.reduce((sum, holding) => sum + holding.purchaseValue, 0))
  const options = round(Math.abs(latest.totalShort))
  const cashOther = round(Math.max(0, latest.total - stocks + options))
  const grossTotal = stocks + options + cashOther
  const category = (key, label, value) => ({
    key,
    label,
    value,
    percentage: grossTotal ? round((value / grossTotal) * 100, 1) : 0,
  })

  return {
    isEstimated: true,
    categories: [
      category('stocks', 'Aandelen', stocks),
      category('options', 'Opties', options),
      category('cash', 'Geld / overig', cashOther),
    ],
  }
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

function goalPlanSummary(rows, latest) {
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
    targetValue: round(completedStart.total * (1 + GOAL_GROWTH_PERCENTAGE / 100) + GOAL_ANNUAL_CONTRIBUTION),
    resultValue: round(baseYearEnd.total),
    resultDate: baseYearEnd.date,
    status: 'completed',
  } : null

  let startValue = baseYearEnd.total
  const plannedYears = Array.from({ length: GOAL_PLANNING_YEARS }, (_, index) => {
    const year = currentYear + index
    const growthValue = startValue * (GOAL_GROWTH_PERCENTAGE / 100)
    const targetValue = startValue + growthValue + GOAL_ANNUAL_CONTRIBUTION
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

export function createPortfolioSummary({ equityXml, tradesXml, optionXml, currency = 'USD', premiumCurrency = 'USD', generatedAt = new Date().toISOString() }) {
  const statements = extractTags(`${equityXml}\n${tradesXml}\n${optionXml}`, 'FlexStatement')
  const statement = statements
    .filter(({ whenGenerated }) => whenGenerated)
    .sort((left, right) => left.whenGenerated.localeCompare(right.whenGenerated))
    .at(-1)
  const seenExecutionIds = new Set()
  const trades = extractTags(tradesXml, 'Trade').filter((trade) => {
    if (!trade.ibExecID) return true
    if (seenExecutionIds.has(trade.ibExecID)) return false
    seenExecutionIds.add(trade.ibExecID)
    return true
  })
  const optionTrades = normalizeOptionTrades(trades)
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
  const yearStartDate = `${latest.date.slice(0, 4)}-01-01`
  const start = lastBefore(rows, yearStartDate) ?? firstOnOrAfter(rows, yearStartDate)
  const currentMonthStart = dateAtMonthStart(latest.date)
  const previousMonthStart = shiftMonth(currentMonthStart, -1)
  const currentMonthBase = lastBefore(rows, currentMonthStart)
  const previousMonthBase = lastBefore(rows, previousMonthStart)

  if (!start || !currentMonthBase || !previousMonthBase) throw new Error('Onvoldoende dagsaldi om alle periodes te berekenen.')

  const yearProfit = latest.total - start.total
  const monthCount = elapsedMonthCount(start.date, latest.date)
  const currentMonth = latest.date.slice(0, 7)
  const previousMonth = shiftMonth(`${currentMonth}-01`, -1).slice(0, 7)
  const stockHoldings = stockHoldingsSummary(trades)
  const optionHoldings = optionHoldingsSummary(optionTrades)
  const closedTrades = closedTradesSummary(optionTrades)
  const premiumForMonth = (month) => ({
    month,
    ...premiumSummary(optionTrades.filter((trade) => trade.dateTime.startsWith(month))),
  })

  return {
    generatedAt,
    sourceUpdatedAt: statement?.whenGenerated ?? latest.date,
    currency,
    premiumCurrency,
    sourceCounts: {
      equityDays: rows.length,
      trades: trades.length,
      optionEvents: extractTags(optionXml, 'OptionEAE').length,
    },
    balance: metric(latest.total, undefined, latest.date),
    dailyProfit: metric(latest.total - rows.at(-2).total, rows.at(-2).date, latest.date),
    yearProfit: metric(yearProfit, start.date, latest.date),
    currentMonthProfit: metric(latest.total - currentMonthBase.total, currentMonthBase.date, latest.date),
    previousMonthProfit: metric(currentMonthBase.total - previousMonthBase.total, previousMonthBase.date, currentMonthBase.date),
    averageMonthlyProfit: { ...metric(yearProfit / monthCount, start.date, latest.date), monthCount },
    monthlyBalanceChanges: monthlyBalanceChangesForYear(rows, latest.date.slice(0, 4)),
    previousYearMonthlyBalanceChanges: monthlyBalanceChangesForYear(
      rows,
      String(Number(latest.date.slice(0, 4)) - 1),
    ),
    portfolioHistory: monthlyPortfolioHistory(rows),
    tradingActivity: tradingActivitySummary(optionTrades),
    stockHoldings,
    optionHoldings,
    closedTrades,
    goalPlan: goalPlanSummary(rows, latest),
    portfolioAllocation: portfolioAllocation(stockHoldings, latest),
    premiumPeriods: {
      currentMonth: premiumForMonth(currentMonth),
      previousMonth: premiumForMonth(previousMonth),
    },
  }
}
