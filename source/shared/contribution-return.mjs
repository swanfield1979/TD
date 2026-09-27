// Simple return on net contributed capital; not an annualised or time-weighted return.
export function contributionReturn(balance, startingBalance, netContributions) {
  if (![balance, startingBalance, netContributions].every((value) => typeof value === 'number' && Number.isFinite(value))) return null
  const capital = startingBalance + netContributions
  const profit = balance - capital
  return { capital, profit, percentage: capital > 0 ? profit / capital : null }
}

export function contributionsSince(periods, startDate, endDate) {
  if (!startDate?.endsWith('-12-31') || !endDate) return null
  const firstYear = Number(startDate.slice(0, 4)) + 1
  const lastYear = Number(endDate.slice(0, 4))
  const selected = []
  for (let year = firstYear; year <= lastYear; year++) {
    const period = periods.find((row) => row.year === year)
    if (!period || period.fromDate !== `${year}-01-01` || (year < lastYear && period.toDate !== `${year}-12-31`)) return null
    selected.push(period)
  }
  if (!selected.length) return null
  return { net: selected.reduce((sum, period) => sum + period.net, 0), toDate: selected.at(-1).toDate,
    datesDiffer: selected.at(-1).toDate !== endDate }
}
