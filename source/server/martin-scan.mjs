import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { main, parseSymbols } from '../scripts/scan-martin.mjs'
import { dailyCacheKey } from './martin-market-scan.mjs'

// One job per server, independent of the broker. Browser requests never supply file paths.
export async function createMartinScan(directory, run = main) {
  const path = join(directory, 'ui-state.json')
  let state = { state: 'idle', symbols: [], universeMode: 'us', checked: 0, total: 0, report: null }
  try {
    const stored = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(stored.symbols) || !['idle', 'running', 'complete', 'partial', 'error', 'interrupted'].includes(stored.state)) throw Error('Invalid state')
    state = { ...state, ...stored, restored: true }
    // Old versions had a fixed shortlist; an upgrade always defaults to the broad universe.
    if (!stored.universeMode) { state.universeMode = 'us'; state.symbols = [] }
    if (state.state === 'running') state = { ...state, state: 'interrupted', message: 'De server is herstart tijdens de scan. Start opnieuw; vorige resultaten blijven zichtbaar.' }
  } catch (error) {
    if (error.code !== 'ENOENT') state.storageError = 'Opgeslagen Martin-scan kon niet worden gelezen. Controleer ui-state.json; dit bestand wordt niet overschreven.'
    else {
      try {
        const report = JSON.parse(await readFile(join(directory, 'scan.json'), 'utf8'))
        if (Array.isArray(report.rows) && report.lists && report.analyzed > 0) state = { ...state, report, state: report.failures?.length ? 'partial' : 'complete', restored: true }
      } catch { /* No prior CLI report is required. */ }
    }
  }
  if (state.report && !state.report.universe) state.report.universe = { kind: 'legacy', name: 'Eerdere eigen tickerlijst (oude scanner)', updatedAt: state.report.generatedAt, sources: [] }
  try {
    const round = JSON.parse(await readFile(join(directory, 'market-round.json'), 'utf8'))
    state.canResume = !round.complete && round.key === dailyCacheKey(Date.now())
  } catch { state.canResume = false }
  let job = null
  let starting = false
  let controller
  const snapshot = reportVersion => {
    const reportUnchanged = !!state.report && reportVersion === state.report.generatedAt
    return structuredClone({ ...state, report: reportUnchanged ? null : state.report, reportUnchanged })
  }
  async function persist() {
    await mkdir(directory, { recursive: true })
    await writeFile(path + '.tmp', JSON.stringify(state))
    await rename(path + '.tmp', path)
  }
  return {
    snapshot,
    async start(input, options = {}) {
      if (job || starting) return snapshot()
      if (state.storageError) throw Error(state.storageError)
      const universeMode = options.universeMode ?? (input === undefined ? 'us' : 'custom')
      if (!['us', 'custom'].includes(universeMode)) throw Error('Ongeldig universum.')
      if (universeMode === 'custom' && typeof input !== 'string') throw Error('Geef een tickerlijst op.')
      const symbols = universeMode === 'custom' ? parseSymbols(input) : []
      if (symbols.length > 200) throw Error('Gebruik maximaal 200 aandelen voor een eigen lijst.')
      if (options.resume && !state.canResume) throw Error('Geen hervatbare scan beschikbaar; start opnieuw.')
      starting = true
      const previous = state
      state = { state: 'running', universeMode, symbols, checked: 0, total: symbols.length, report: state.report, startedAt: new Date().toISOString(), showingPrevious: !!state.report, phase: 'universe', canResume: false }
      // Save before accepting the job. A disk failure must not report a started scan.
      try { await persist() } catch { state = previous; starting = false; throw Error('Scan kon niet worden gestart: serveropslag is niet schrijfbaar.') }
      job = (async () => {
        try {
          controller = new AbortController()
          const args = ['--out', directory, ...(universeMode === 'custom' ? ['--symbols', symbols.join(',')] : []), ...(options.resume ? ['--resume'] : [])]
          const report = await run(args, { quiet: true, signal: controller.signal, onProgress: progress => Object.assign(state, progress) })
          Object.assign(state, { canResume: !!report?.canResume, checked: report?.checked ?? state.checked })
          if (!report?.analyzed) {
            state.state = 'error'
            state.message = report?.stopReason || 'Geen bruikbare koersreeksen ontvangen. Probeer opnieuw; vorige resultaten blijven zichtbaar.'
            state.failures = report?.failures ?? []
          } else {
            Object.assign(state, { state: report.complete === false ? 'interrupted' : report.failures.length ? 'partial' : 'complete', report, showingPrevious: false, message: report.stopReason || (report.failures.length ? 'Scan afgerond met ontbrekende data.' : 'Scan afgerond.') })
          }
        } catch {
          state.state = controller?.signal.aborted ? 'interrupted' : 'error'
          state.message = controller?.signal.aborted ? 'Scan gestopt. Start opnieuw of hervat de beschikbare ronde.' : 'Martin-scan mislukt. Controleer de databron en serveropslag en probeer opnieuw.'
        } finally {
          state.finishedAt = new Date().toISOString()
          try { await persist() } catch { state.storageError = 'Resultaten konden niet worden opgeslagen. Ze blijven zichtbaar tot de server opnieuw start.' }
          job = null
        }
      })()
      starting = false
      return snapshot()
    },
    stop() { controller?.abort(); return snapshot() },
    async wait() { await job },
  }
}
