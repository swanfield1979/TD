const MONTHS_IN_YEAR = 12
const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

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
      openClose: trade.openCloseIndicator,
    }))
    .filter((trade) => trade.conid && trade.dateTime && Number.isFinite(trade.quantity) && Number.isFinite(trade.tradePrice))
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
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

function monthlyBalanceChanges(rows, start, latest) {
  const year = latest.date.slice(0, 4)
  let previous = start

  return MONTH_LABELS.map((label, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    const monthRows = rows.filter((row) => row.date.startsWith(month))
    const monthEnd = monthRows.at(-1)

    if (!monthEnd || month > latest.date.slice(0, 7)) {
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

export function createPortfolioSummary({ equityXml, tradesXml, optionXml, currency = 'EUR', premiumCurrency = 'USD', generatedAt = new Date().toISOString() }) {
  const statement = extractTags(equityXml, 'FlexStatement')[0]
  const trades = extractTags(tradesXml, 'Trade')
  const optionTrades = normalizeOptionTrades(trades)
  const rows = extractTags(equityXml, 'EquitySummaryByReportDateInBase')
    .map((attributes) => ({ date: attributes.reportDate, total: Number(attributes.total) }))
    .filter((row) => row.date && Number.isFinite(row.total))
    .sort((left, right) => left.date.localeCompare(right.date))

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
    yearProfit: metric(yearProfit, start.date, latest.date),
    currentMonthProfit: metric(latest.total - currentMonthBase.total, currentMonthBase.date, latest.date),
    previousMonthProfit: metric(currentMonthBase.total - previousMonthBase.total, previousMonthBase.date, currentMonthBase.date),
    averageMonthlyProfit: { ...metric(yearProfit / monthCount, start.date, latest.date), monthCount },
    monthlyBalanceChanges: monthlyBalanceChanges(rows, start, latest),
    tradingActivity: tradingActivitySummary(optionTrades),
    premiumPeriods: {
      currentMonth: premiumForMonth(currentMonth),
      previousMonth: premiumForMonth(previousMonth),
    },
  }
}
