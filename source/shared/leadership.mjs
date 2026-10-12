// Percentages are percentage points; durations are completed trading sessions.
export const DEFAULT_CONFIG = Object.freeze({
  periods: [21, 63, 126],
  weights: [0.4, 0.35, 0.25],
  moveMinSessions: 5,
  moveMaxSessions: 30,
  moveLookback: 63,
  moveMinPct: 30,
  baseMinSessions: 10,
  baseMaxSessions: 42,
  maxDepthPct: 25,
  maxBaseAdvancePct: 5,
  slopeSessions: 5,
  minSlopePct: 0,
  maxMaDistancePct: 12,
  requireMa50: false,
  swingRadius: 2,
  lowerLowTolerancePct: 2,
  contractionSessions: 5,
  maxRangeRatio: 0.85,
  maxVolatilityRatio: 0.95,
  readyDistancePct: 5,
  expansionRatio: 1.3,
  requireVolume: false,
  volumeRatio: 1.2,
  failureMa20Pct: 8,
})

export function validateConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Configuratie moet een object zijn.')
  if (Object.keys(input).some((key) => !Object.hasOwn(DEFAULT_CONFIG, key)))
    throw new Error('Onbekende configuratiesleutel.')
  const c = { ...DEFAULT_CONFIG, ...input }
  for (const key of ['periods', 'weights']) {
    if (
      !Array.isArray(c[key]) ||
      c[key].length !== 3 ||
      c[key].some((v) => !Number.isFinite(v) || v <= 0)
    )
      throw new Error(`${key}: drie positieve getallen vereist.`)
  }
  if (
    c.periods.some((v) => !Number.isInteger(v) || v > 500) ||
    c.periods.some((v, i) => i && v <= c.periods[i - 1])
  )
    throw new Error(
      'Momentumperioden moeten oplopende gehele sessies zijn (maximaal 500).',
    )
  if (Math.abs(c.weights.reduce((a, b) => a + b, 0) - 1) > 0.0001)
    throw new Error('Gewichten moeten samen 1 zijn.')
  for (const [key, value] of Object.entries(c)) {
    if (['periods', 'weights'].includes(key)) continue
    if (['requireMa50', 'requireVolume'].includes(key)) {
      if (typeof value !== 'boolean')
        throw new Error(`${key}: boolean vereist.`)
      continue
    }
    if (!Number.isFinite(value) || value < 0 || value > 1000)
      throw new Error(`${key}: ongeldig getal.`)
  }
  for (const key of [
    'moveMinSessions',
    'moveMaxSessions',
    'moveLookback',
    'baseMinSessions',
    'baseMaxSessions',
    'slopeSessions',
    'swingRadius',
    'contractionSessions',
  ]) {
    if (!Number.isInteger(c[key]) || c[key] < 1 || c[key] > 250)
      throw new Error(`${key}: 1–250 gehele sessies vereist.`)
  }
  if (
    c.moveMinSessions > c.moveMaxSessions ||
    c.baseMinSessions > c.baseMaxSessions ||
    c.baseMinSessions < c.contractionSessions * 2
  )
    throw new Error('Ongeldige impuls-/consolidatievensters.')
  return c
}

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length
const pct = (a, b) => (a / b - 1) * 100
const span = (bars) =>
  Math.max(...bars.map((b) => b.high)) - Math.min(...bars.map((b) => b.low))
export function normalizeBars(bars) {
  const seen = new Set()
  return [...bars]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((bar) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date) || seen.has(bar.date))
        throw new Error('Ongeldige of dubbele handelsdatum.')
      seen.add(bar.date)
      for (const key of ['open', 'high', 'low', 'close'])
        if (!Number.isFinite(bar[key]) || bar[key] <= 0)
          throw new Error('Ongeldige OHLC-koers.')
      if (
        bar.high < Math.max(bar.open, bar.close, bar.low) ||
        bar.low > Math.min(bar.open, bar.close)
      )
        throw new Error('Inconsistente OHLC-candle.')
      return {
        ...bar,
        volume:
          Number.isFinite(bar.volume) && bar.volume >= 0 ? bar.volume : null,
      }
    })
}
export function analyzeStock(symbol, input, config = DEFAULT_CONFIG) {
  const c = validateConfig(config),
    bars = normalizeBars(input),
    n = bars.length,
    last = bars.at(-1)
  const required =
    Math.max(
      ...c.periods,
      50 + c.slopeSessions,
      c.moveMaxSessions + c.baseMinSessions,
    ) + 1
  const result = {
    symbol,
    asOf: last?.date ?? null,
    close: last?.close ?? null,
    sessions: n,
    returns: c.periods.map((p) =>
      n > p ? pct(last.close, bars[n - 1 - p].close) : null,
    ),
    status: 'insufficient_data',
    reasons: [],
    move: null,
    base: null,
    indicators: null,
    chart: bars.slice(-150),
  }
  if (n < required) {
    result.reasons.push(`Minimaal ${required} sessies nodig; ${n} beschikbaar.`)
    return result
  }
  const ma = (p, end) =>
    mean(bars.slice(end - p + 1, end + 1).map((b) => b.close))
  const tr = bars.map((b, i) =>
    i
      ? Math.max(
          b.high - b.low,
          Math.abs(b.high - bars[i - 1].close),
          Math.abs(b.low - bars[i - 1].close),
        )
      : b.high - b.low,
  )
  const atr = mean(tr.slice(n - 21, n - 1)) // exclude candidate breakout bar
  const indicators = {
    atr20: atr,
    trueRange: tr.at(-1),
    rangeExpansion: tr.at(-1) / atr,
    volumeConfirmation:
      last.volume === null ||
      bars.slice(n - 21, n - 1).some((b) => b.volume === null)
        ? null
        : last.volume / mean(bars.slice(n - 21, n - 1).map((b) => b.volume)) >=
          c.volumeRatio,
  }
  for (const p of [10, 20, 50]) {
    indicators[`ma${p}`] = ma(p, n - 1)
    indicators[`slope${p}`] = pct(ma(p, n - 2), ma(p, n - 2 - c.slopeSessions))
    indicators[`distance${p}`] = pct(last.close, indicators[`ma${p}`])
  }
  result.indicators = indicators
  // Enumerate rolling impulses, each followed by a contiguous base ending BEFORE latest bar.
  const candidates = []
  for (
    let end = Math.max(c.moveMaxSessions, n - 1 - c.moveLookback);
    end <= n - 3;
    end++
  ) {
    const duration = n - 2 - end
    if (duration < 1 || duration > c.baseMaxSessions) continue
    for (
      let length = c.moveMinSessions;
      length <= c.moveMaxSessions && end - length >= 0;
      length++
    ) {
      const gain = pct(bars[end].close, bars[end - length].close)
      if (gain < c.moveMinPct) continue
      // End of impulse must be its closing high, preventing a later rebound from hiding a breakdown.
      if (bars.slice(end - length, end).some((b) => b.close > bars[end].close))
        continue
      const baseBars = bars.slice(end + 1, n - 1),
        high = Math.max(bars[end].high, ...baseBars.map((b) => b.high)),
        low = Math.min(...baseBars.map((b) => b.low))
      const depth = ((high - low) / high) * 100,
        k = c.contractionSessions
      const advancePct = pct(high, bars[end].high)
      const rangeRatio =
        duration >= 2 * k
          ? span(baseBars.slice(-k)) /
            Math.max(span(baseBars.slice(0, k)), 0.000001)
          : null
      const volatilityRatio =
        duration >= 2 * k
          ? mean(tr.slice(n - 1 - k, n - 1)) /
            mean(tr.slice(end + 1, end + 1 + k))
          : null
      const swingLows = baseBars
        .filter(
          (b, i) =>
            i >= c.swingRadius &&
            i < duration - c.swingRadius &&
            baseBars
              .slice(i - c.swingRadius, i + c.swingRadius + 1)
              .every((x) => x.low >= b.low),
        )
        .map((b) => b.low)
      const higherLows =
        swingLows.length >= 2
          ? swingLows.every(
              (v, i) =>
                !i ||
                v >= swingLows[i - 1] * (1 - c.lowerLowTolerancePct / 100),
            )
          : null
      const edgeLows =
        duration >= 2 * k &&
        Math.min(...baseBars.slice(-k).map((b) => b.low)) >=
          Math.min(...baseBars.slice(0, k).map((b) => b.low)) *
            (1 - c.lowerLowTolerancePct / 100)
      const orderlyLows =
        higherLows === true || (higherLows === null && edgeLows)
      const tighteningRange =
        rangeRatio !== null && rangeRatio <= c.maxRangeRatio
      const maPeriods = c.requireMa50 ? [10, 20, 50] : [10, 20]
      const surfing = maPeriods.every(
        (p) =>
          indicators[`slope${p}`] >= c.minSlopePct &&
          Math.abs(pct(bars[n - 2].close, ma(p, n - 2))) <= c.maxMaDistancePct,
      )
      const reasons = []
      const failed =
        depth > c.maxDepthPct ||
        higherLows === false ||
        last.close < low ||
        pct(last.close, indicators.ma20) < -c.failureMa20Pct
      if (depth > c.maxDepthPct) reasons.push('Consolidatie te diep.')
      if (!orderlyLows) reasons.push('Hogere bodems nog niet bevestigd.')
      if (!tighteningRange) reasons.push('Range nog niet voldoende vernauwd.')
      if (
        !(volatilityRatio <= c.maxVolatilityRatio) ||
        volatilityRatio === null
      )
        reasons.push('Volatiliteit nog niet voldoende afgenomen.')
      if (!surfing) reasons.push('Steun op stijgende gemiddelden ontbreekt.')
      if (advancePct > c.maxBaseAdvancePct)
        reasons.push(
          'Te veel nieuwe stijging binnen de veronderstelde consolidatie.',
        )
      if (
        last.close < low ||
        pct(last.close, indicators.ma20) < -c.failureMa20Pct
      )
        reasons.push('Actuele koers schendt de risicogrens.')
      const valid =
        duration >= c.baseMinSessions &&
        advancePct <= c.maxBaseAdvancePct &&
        !failed &&
        orderlyLows &&
        tighteningRange &&
        volatilityRatio !== null &&
        volatilityRatio <= c.maxVolatilityRatio &&
        surfing
      const breakout =
        valid &&
        last.close > high &&
        indicators.rangeExpansion >= c.expansionRatio &&
        (!c.requireVolume || indicators.volumeConfirmation === true)
      const ready =
        valid &&
        last.close <= high &&
        ((high - last.close) / high) * 100 <= c.readyDistancePct
      const status = failed
        ? 'failed'
        : breakout
          ? 'breakout'
          : ready
            ? 'ready'
            : 'forming'
      if (last.close > high && !breakout)
        reasons.push('Uitbraak zonder alle vereiste bevestigingen.')
      candidates.push({
        status,
        reasons,
        move: {
          pct: gain,
          start: bars[end - length].date,
          end: bars[end].date,
          sessions: length,
        },
        base: {
          start: baseBars[0].date,
          end: baseBars.at(-1).date,
          sessions: duration,
          weeks: duration / 5,
          high,
          low,
          depthPct: depth,
          advancePct,
          rangeRatio,
          volatilityRatio,
          higherLows,
          orderlyLows,
          tighteningRange,
          distanceToHighPct: ((high - last.close) / high) * 100,
        },
      })
    }
  }
  // Strongest valid setup first; ties prefer the longest base, then strongest impulse.
  const priority = { breakout: 3, ready: 2, forming: 1, failed: 0 }
  candidates.sort(
    (a, b) =>
      priority[b.status] - priority[a.status] ||
      b.base.sessions - a.base.sessions ||
      b.move.pct - a.move.pct,
  )
  if (candidates.length) Object.assign(result, candidates[0])
  else {
    result.status = 'forming'
    result.reasons = [
      'Geen kwalificerende voorafgaande impuls met recente consolidatie.',
    ]
  }
  return result
}

export function rankStocks(rows, config = DEFAULT_CONFIG) {
  const ranked = rows.map((r) => ({
    ...r,
    ranks: [null, null, null],
    percentiles: [null, null, null],
    score: null,
  }))
  for (let p = 0; p < 3; p++) {
    const eligible = ranked
      .filter((r) => Number.isFinite(r.returns[p]))
      .sort(
        (a, b) =>
          b.returns[p] - a.returns[p] || a.symbol.localeCompare(b.symbol),
      )
    eligible.forEach((r, i) => {
      r.ranks[p] = i + 1
      r.percentiles[p] =
        eligible.length === 1 ? 100 : (1 - i / (eligible.length - 1)) * 100
    })
  }
  for (const r of ranked)
    if (r.percentiles.every(Number.isFinite))
      r.score = r.percentiles.reduce(
        (sum, v, i) => sum + v * config.weights[i],
        0,
      )
  return ranked.sort(
    (a, b) =>
      (b.score ?? -1) - (a.score ?? -1) || a.symbol.localeCompare(b.symbol),
  )
}

export function selectLeaders(rows, topPct = 2, period = 0) {
  if (![1, 2, 5].includes(topPct) || ![0, 1, 2].includes(period))
    throw new Error('Ongeldige leiderschapsselectie.')
  const eligible = rows
    .filter((r) => Number.isFinite(r.returns[period]))
    .sort(
      (a, b) =>
        b.returns[period] - a.returns[period] ||
        a.symbol.localeCompare(b.symbol),
    )
  return eligible.slice(0, Math.ceil((eligible.length * topPct) / 100))
}
