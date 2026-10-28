import type { ClosedTrade } from './types'

export function symbolPerformance(trades: ClosedTrade[]) {
  const groups = new Map<string, ClosedTrade[]>()
  for (const trade of trades) {
    const rows = groups.get(trade.symbol) ?? []
    rows.push(trade)
    groups.set(trade.symbol, rows)
  }
  return [...groups].map(([symbol, rows]) => {
    const durations = rows.flatMap(row => row.daysHeld !== null && row.daysHeld >= 0 ? [row.daysHeld] : [])
    const returns = rows.flatMap(row => row.profitPercentage !== null && Number.isFinite(row.profitPercentage) ? [row.profitPercentage] : [])
    const profit = rows.reduce((sum, row) => sum + row.profit, 0)
    return {
      symbol, name: rows[0].name, profit, count: rows.length,
      winRate: rows.filter(row => row.profit > 0).length / rows.length * 100,
      averageProfit: profit / rows.length,
      averageDays: durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null,
      measuredDays: durations.length,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      measuredReturns: returns.length,
      shortPuts: rows.filter(row => row.direction === 'short' && row.optionRight === 'P').length,
      shortCalls: rows.filter(row => row.direction === 'short' && row.optionRight === 'C').length,
      longOptions: rows.filter(row => row.direction === 'long').length,
    }
  }).sort((a, b) => b.profit - a.profit || a.symbol.localeCompare(b.symbol))
}

export function realizedPerformance(trades: ClosedTrade[]) {
  const daily = new Map<string, number>()
  for (const trade of trades) daily.set(trade.closedAt, (daily.get(trade.closedAt) ?? 0) + trade.profit)
  let cumulative = 0, peak = 0, maxDrawdown = 0
  const points = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, profit]) => {
    cumulative += profit
    peak = Math.max(peak, cumulative)
    const drawdown = cumulative - peak
    maxDrawdown = Math.min(maxDrawdown, drawdown)
    return { date, profit, cumulative, drawdown }
  })
  const wins = trades.filter(row => row.profit > 0)
  const losses = trades.filter(row => row.profit < 0)
  const totalWins = wins.reduce((sum, row) => sum + row.profit, 0)
  const totalLosses = losses.reduce((sum, row) => sum + row.profit, 0)
  return {
    points, total: cumulative, maxDrawdown, totalWins, totalLosses,
    best: trades.length ? Math.max(...trades.map(row => row.profit)) : null,
    worst: trades.length ? Math.min(...trades.map(row => row.profit)) : null,
    averageWin: wins.length ? totalWins / wins.length : null,
    averageLoss: losses.length ? totalLosses / losses.length : null,
    payoff: wins.length && losses.length ? (totalWins / wins.length) / Math.abs(totalLosses / losses.length) : null,
    categories: [
      { label: 'Short puts', rows: trades.filter(row => row.direction === 'short' && row.optionRight === 'P') },
      { label: 'Short calls', rows: trades.filter(row => row.direction === 'short' && row.optionRight === 'C') },
      { label: 'Long opties', rows: trades.filter(row => row.direction === 'long') },
      { label: 'Overige opties', rows: trades.filter(row => row.direction === 'short' && !['P', 'C'].includes(row.optionRight ?? '')) },
    ].map(({ label, rows }) => ({ label, count: rows.length, profit: rows.reduce((sum, row) => sum + row.profit, 0) })),
  }
}
