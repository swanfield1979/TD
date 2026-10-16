import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { download, downloadPremarket } from '../shared/martin-data.mjs'
import { analyzeMartin, completedBars, defaults, makeLists, nyTime, premarketSignal } from '../shared/martin-selection.mjs'
import { loadUsUniverse } from './martin-universe.mjs'

export function dailyCacheKey(now) {
  const time = nyTime(now)
  return `${time.date}-${time.minutes >= 975 ? 'after-close' : 'before-close'}`
}
const limited = error => /HTTP (429|403|5\d\d)/.test(error?.message ?? '')
async function atomic(path, data) {
  await writeFile(path + '.tmp', JSON.stringify(data)); await rename(path + '.tmp', path)
}
export async function scanMarket(options, dependencies = {}) {
  const deps = { download, downloadPremarket, loadUsUniverse, now: Date.now, wait: ms => sleep(ms), ...dependencies }
  const { directory, signal, resume = false, customSymbols, themes = {}, onProgress = () => {} } = options
  const config = { ...defaults, ...options.config }, key = dailyCacheKey(deps.now())
  const path = join(directory, 'market-round.json'), cache = join(directory, 'daily-cache')
  await mkdir(cache, { recursive: true })
  let round
  if (resume) {
    round = JSON.parse(await readFile(path, 'utf8'))
    if (round.key !== key || round.complete || JSON.stringify(round.config) !== JSON.stringify(config) || JSON.stringify(round.customSymbols) !== JSON.stringify(customSymbols ?? null)) throw Error('Geen passende hervatbare scan voor deze beursdatum. Start een nieuwe scan.')
  } else {
    onProgress({ phase: 'universe', checked: 0, total: 0 })
    const universe = customSymbols ? { kind: 'custom', name: 'Eigen tickerlijst', entries: customSymbols.map(symbol => ({ symbol })), sources: [], updatedAt: new Date(deps.now()).toISOString() } : await deps.loadUsUniverse(signal)
    round = { key, complete: false, customSymbols: customSymbols ?? null, config, universe, rows: {}, failures: {}, startedAt: new Date(deps.now()).toISOString() }
  }
  const entries = round.universe.entries, pending = entries.filter(e => !(e.symbol in round.rows) && !(e.symbol in round.failures))
  let cacheHits = 0, requests = 0, stopReason = null, sinceCheckpoint = 0
  const checkpoint = async () => { await atomic(path, round); sinceCheckpoint = 0 }
  const progress = phase => onProgress({ phase, checked: Object.keys(round.rows).length + Object.keys(round.failures).length, total: entries.length, cacheHits, requests, universe: { ...round.universe, entries: undefined }, canResume: true })
  await checkpoint(); progress('daily')
  for (let i = 0; i < pending.length; i += 3) {
    if (signal?.aborted) { stopReason = 'Scan gestopt.'; break }
    if (dailyCacheKey(deps.now()) !== key) { stopReason = 'Nieuwe beursdatum of slotperiode; start een nieuwe scan.'; break }
    const batch = pending.slice(i, i + 3)
    const requestsBefore = requests
    const results = await Promise.allSettled(batch.map(async entry => {
      const filename = join(cache, encodeURIComponent(entry.symbol) + '.json')
      let data
      try { const saved = JSON.parse(await readFile(filename, 'utf8')); if (saved.key === key && Array.isArray(saved.data?.bars)) { data = saved.data; cacheHits++ } } catch { /* A missing or corrupt per-symbol cache is downloaded again. */ }
      const now = deps.now()
      if (!data) { requests++; data = await deps.download(entry.symbol, now, { signal, premarket: false }) }
      const bars = completedBars(data.bars, now), analysis = analyzeMartin(bars, config)
      if (now - Date.parse(`${analysis.date}T00:00:00Z`) > 5 * 86400000) throw Error('Laatste dagcandle ouder dan vijf kalenderdagen')
      await atomic(filename, { key, data: { ...data, bars } })
      return { ...entry, ...analysis, source: data.source, analyzedAt: new Date(now).toISOString(), theme: themes[entry.symbol] ?? null, premarket: { status: 'ONTBREEKT' } }
    }))
    for (let j = 0; j < results.length; j++) {
      const result = results[j], symbol = batch[j].symbol
      if (result.status === 'fulfilled') round.rows[symbol] = result.value
      else if (signal?.aborted) stopReason = 'Scan gestopt.'
      else if (limited(result.reason)) stopReason = 'Databron begrenst aanvragen of is tijdelijk niet beschikbaar. Wacht en hervat de scan.'
      else round.failures[symbol] = { symbol, error: result.reason.message }
    }
    sinceCheckpoint += batch.length
    if (sinceCheckpoint >= 25 || stopReason) await checkpoint()
    progress('daily')
    if (stopReason) break
    // No sleep for cache-only batches. At most three network requests per 500ms batch.
    if (i + 3 < pending.length && requests > requestsBefore) await deps.wait(500)
  }
  // Fetch fresh premarket data after daily screening, only for ADR/liquidity candidates.
  // This avoids thousands of intraday downloads for stocks which cannot qualify.
  const eligible = Object.values(round.rows).filter(r => r.eligible)
  let premarketChecked = 0
  if (!stopReason && !options.snapshots) for (let i = 0; i < eligible.length; i += 3) {
    const time = nyTime(deps.now())
    if (signal?.aborted) { stopReason = 'Scan gestopt.'; break }
    if (time.minutes < 240 || time.minutes >= 570) break
    const batch = eligible.slice(i, i + 3)
    const results = await Promise.allSettled(batch.map(row => deps.downloadPremarket(row.symbol, deps.now(), { signal })))
    for (let j = 0; j < results.length; j++) {
      const result = results[j], row = batch[j]
      if (result.status === 'fulfilled') {
        row.premarketSnapshot = result.value.premarket; row.premarketError = result.value.premarketError
        if (limited({ message: row.premarketError })) stopReason = 'Premarketbron begrenst aanvragen. Wacht en hervat de scan.'
      } else if (signal?.aborted) stopReason = 'Scan gestopt.'
      else row.premarketError = result.reason.message
    }
    premarketChecked += batch.length
    onProgress({ phase: 'premarket', premarketChecked, premarketTotal: eligible.length })
    if (stopReason) break
    if (i + 3 < eligible.length) await deps.wait(500)
  }
  const now = deps.now()
  if (signal?.aborted && !stopReason) stopReason = 'Scan gestopt.'
  if (options.snapshots) for (const row of Object.values(round.rows)) row.premarketSnapshot = options.snapshots[row.symbol]
  for (const row of Object.values(round.rows)) row.premarket = premarketSignal(row.premarketSnapshot, row, now, config)
  round.complete = !stopReason && !signal?.aborted
  await checkpoint()
  const rows = Object.values(round.rows).sort((a, b) => a.symbol.localeCompare(b.symbol)).map(({ premarketSnapshot, ...row }) => row)
  const checked = rows.length + Object.keys(round.failures).length
  return { generatedAt: new Date(now).toISOString(), startedAt: round.startedAt, mode: 'Yahoo Finance (experimenteel)', universe: { ...round.universe, entries: undefined }, requested: entries.length, analyzed: rows.length, checked, pending: entries.length - checked, complete: round.complete, canResume: !round.complete && dailyCacheKey(now) === key, stopReason, config, cacheHits, requests, rows, lists: makeLists(rows, config), failures: Object.values(round.failures) }
}
