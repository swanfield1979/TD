const MONTHS_IN_YEAR = 12

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

export function createPortfolioSummary({ equityXml, tradesXml, optionXml, currency = 'EUR', generatedAt = new Date().toISOString() }) {
  const statement = extractTags(equityXml, 'FlexStatement')[0]
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

  return {
    generatedAt,
    sourceUpdatedAt: statement?.whenGenerated ?? latest.date,
    currency,
    sourceCounts: {
      equityDays: rows.length,
      trades: extractTags(tradesXml, 'Trade').length,
      optionEvents: extractTags(optionXml, 'OptionEAE').length,
    },
    balance: metric(latest.total, undefined, latest.date),
    yearProfit: metric(yearProfit, start.date, latest.date),
    currentMonthProfit: metric(latest.total - currentMonthBase.total, currentMonthBase.date, latest.date),
    previousMonthProfit: metric(currentMonthBase.total - previousMonthBase.total, previousMonthBase.date, currentMonthBase.date),
    averageMonthlyProfit: { ...metric(yearProfit / monthCount, start.date, latest.date), monthCount },
  }
}
