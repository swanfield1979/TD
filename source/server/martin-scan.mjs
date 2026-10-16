import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { main, parseSymbols, starterSymbols } from '../scripts/scan-martin.mjs'

// One job per server, independent of the broker. Browser requests never supply file paths.
export async function createMartinScan(directory, run = main) {
  const path = join(directory, 'ui-state.json')
  let state = { state: 'idle', symbols: starterSymbols, checked: 0, total: 0, report: null }
  try {
    const stored = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(stored.symbols) || !['idle', 'running', 'complete', 'partial', 'error', 'interrupted'].includes(stored.state)) throw Error('Invalid state')
    state = { ...state, ...stored, restored: true }
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
  let job = null
  let starting = false
  const snapshot = () => structuredClone(state)
  async function persist() {
    await mkdir(directory, { recursive: true })
    await writeFile(path + '.tmp', JSON.stringify(state))
    await rename(path + '.tmp', path)
  }
  return {
    snapshot,
    async start(input) {
      if (job || starting) return snapshot()
      if (state.storageError) throw Error(state.storageError)
      if (typeof input !== 'string') throw Error('Geef een tickerlijst op.')
      const symbols = parseSymbols(input)
      if (symbols.length > 200) throw Error('Gebruik maximaal 200 aandelen per scan.')
      starting = true
      const previous = state
      state = { state: 'running', symbols, checked: 0, total: symbols.length, report: state.report, startedAt: new Date().toISOString(), showingPrevious: !!state.report }
      // Save before accepting the job. A disk failure must not report a started scan.
      try { await persist() } catch { state = previous; starting = false; throw Error('Scan kon niet worden gestart: serveropslag is niet schrijfbaar.') }
      job = (async () => {
        try {
          const report = await run(['--symbols', symbols.join(','), '--out', directory], { quiet: true, onProgress: progress => Object.assign(state, progress) })
          if (!report?.analyzed) {
            state.state = 'error'
            state.message = 'Geen bruikbare koersreeksen ontvangen. Probeer opnieuw; vorige resultaten blijven zichtbaar.'
            state.failures = report?.failures ?? []
          } else {
            Object.assign(state, { state: report.failures.length ? 'partial' : 'complete', report, showingPrevious: false, message: report.failures.length ? 'Scan afgerond met ontbrekende data.' : 'Scan afgerond.' })
          }
        } catch {
          state.state = 'error'; state.message = 'Martin-scan mislukt. Controleer de databron en serveropslag en probeer opnieuw.'
        } finally {
          state.finishedAt = new Date().toISOString()
          try { await persist() } catch { state.storageError = 'Resultaten konden niet worden opgeslagen. Ze blijven zichtbaar tot de server opnieuw start.' }
          job = null
        }
      })()
      starting = false
      return snapshot()
    },
    async wait() { await job },
  }
}
