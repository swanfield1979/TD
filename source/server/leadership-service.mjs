import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  DEFAULT_CONFIG,
  validateConfig,
  analyzeStock,
  rankStocks,
} from '../shared/leadership.mjs'
import { connectHistory } from './leadership-provider.mjs'

export function parseSymbols(text) {
  if (typeof text !== 'string') throw new Error('Universum moet tekst zijn.')
  const symbols = [
    ...new Set(
      text
        .toUpperCase()
        .split(/[\s,;]+/)
        .filter(Boolean),
    ),
  ]
  if (
    !symbols.length ||
    symbols.length > 5000 ||
    symbols.some((s) => !/^[A-Z][A-Z0-9.\-]{0,14}$/.test(s))
  )
    throw new Error(
      'Gebruik 1–5000 geldige USD-aandelentickers, gescheiden met komma’s of regels.',
    )
  return symbols
}

export function createLeadershipService(
  gateway,
  { path, provider = connectHistory, fetcher = fetch, pacingMs = 1100 } = {},
) {
  let state = {
    state: 'idle',
    rows: [],
    warnings: [],
    progress: 0,
    total: 0,
    config: { ...DEFAULT_CONFIG },
    universe: 'sp500',
    symbols: '',
  }
  let cancelled = false,
    active = null
  const ready = (async () => {
    if (path)
      try {
        const saved = JSON.parse(await readFile(path, 'utf8'))
        validateConfig(saved.config)
        state = {
          ...saved,
          state: saved.state === 'running' ? 'interrupted' : saved.state,
        }
      } catch (error) {
        if (error.code !== 'ENOENT')
          state.warnings.push('Opgeslagen scan kon niet worden geladen.')
      }
  })()
  async function persist() {
    if (!path) return
    await mkdir(dirname(path), { recursive: true })
    await writeFile(`${path}.tmp`, JSON.stringify(state), { mode: 0o600 })
    await rename(`${path}.tmp`, path)
  }
  async function run() {
    let connection
    try {
      let symbols
      if (state.universe === 'custom') symbols = parseSymbols(state.symbols)
      else {
        const response = await fetcher(
          'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv',
          { signal: AbortSignal.timeout(15000) },
        )
        if (!response.ok)
          throw new Error(
            'S&P 500-universum niet bereikbaar; kies een eigen universum.',
          )
        symbols = parseSymbols(
          (await response.text())
            .split(/\r?\n/)
            .slice(1)
            .map((line) => line.split(',')[0])
            .join(','),
        )
        if (symbols.length < 400)
          throw new Error('S&P 500-ledenlijst is onvolledig.')
      }
      state.total = symbols.length
      state.universeUpdatedAt = new Date().toISOString()
      connection = await provider(gateway)
      for (const symbol of symbols) {
        if (cancelled) break
        state.currentSymbol = symbol
        try {
          state.rows.push(
            analyzeStock(
              symbol,
              await connection.history(symbol),
              state.config,
            ),
          )
        } catch (error) {
          state.warnings.push(`${symbol}: ${error.message}`)
        }
        state.progress++
        if (!cancelled && state.progress < state.total)
          await new Promise((r) => setTimeout(r, pacingMs))
      }
      // A single common observation date prevents comparing stale stocks with current leaders.
      const asOf = state.rows.reduce(
        (max, r) => (r.asOf > max ? r.asOf : max),
        '',
      )
      const current = state.rows.filter((r) => r.asOf === asOf)
      state.staleSymbols = state.rows
        .filter((r) => r.asOf !== asOf)
        .map((r) => r.symbol)
      if (state.staleSymbols.length)
        state.warnings.push(
          `${state.staleSymbols.length} aandelen met afwijkende peildatum uitgesloten van rangschikking.`,
        )
      state.rows = rankStocks(current, state.config)
      state.asOf = asOf || null
      state.state = cancelled
        ? 'cancelled'
        : state.warnings.length
          ? 'partial'
          : 'complete'
      if (!state.rows.length && !cancelled) {
        state.state = 'error'
        state.message =
          'Geen bruikbare IBKR-historie ontvangen. Controleer Gateway en marktdatarechten.'
      }
    } catch (error) {
      state.state = cancelled ? 'cancelled' : 'error'
      state.message = error.message
    } finally {
      connection?.close()
      state.currentSymbol = null
      state.finishedAt = new Date().toISOString()
      try {
        await persist()
      } catch (error) {
        state.warnings.push(`Opslaan mislukt: ${error.message}`)
      }
    }
  }
  return {
    ready,
    getState: () => state,
    async start(input = {}) {
      await ready
      if (state.state === 'running') return state
      if (!['sp500', 'custom'].includes(input.universe ?? 'sp500'))
        throw new Error('Onbekend universum.')
      const config = validateConfig(input.config ?? state.config),
        universe = input.universe ?? 'sp500',
        symbols = input.symbols ?? ''
      if (universe === 'custom') parseSymbols(symbols)
      cancelled = false
      state = {
        state: 'running',
        rows: [],
        warnings: [],
        progress: 0,
        total: 0,
        startedAt: new Date().toISOString(),
        config,
        universe,
        symbols,
        source: 'IBKR ADJUSTED_LAST · afgesloten RTH-dagcandles',
      }
      active = run()
      return state
    },
    cancel() {
      cancelled = true
      return state
    },
    async wait() {
      await active
      return state
    },
  }
}
