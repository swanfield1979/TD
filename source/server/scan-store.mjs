import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const modes = ['iv', 'leaps', 'csp']
export function serializeScans(scans, round, gateway) {
  const savedAt = new Date().toISOString()
  return JSON.stringify({ version: 1, gateway, savedAt,
    scans: Object.fromEntries(modes.filter(mode => scans[mode]).map(mode => {
      const { puts, ...state } = scans[mode]
      return [mode, { ...state, savedAt }]
    })),
    ivRound: round ? { ...round, matches: [...round.matches.entries()] } : null,
  })
}
export function restoreScans(text, gateway) {
  const saved = JSON.parse(text)
  if (saved.version !== 1 || saved.gateway !== gateway || !saved.scans || typeof saved.scans !== 'object') throw new Error('Ongeldig scanbestand of andere IBKR Gateway.')
  for (const mode of modes) {
    const state = saved.scans[mode]
    if (!state) continue
    if (!Array.isArray(state.warnings) || typeof state.state !== 'string'
      || (mode === 'csp' ? !Array.isArray(state.portfolio) || !Array.isArray(state.market) : !Array.isArray(state.rows))) throw new Error('Ongeldig scanresultaat.')
    state.restoredFromDisk = true
    if (state.state === 'running') {
      state.state = 'interrupted'
      state.phase = 'interrupted'
      delete state.nextBatchAt
      state.progress = 'Scan onderbroken door serverherstart; opgeslagen resultaten zijn teruggezet.'
      state.message = state.progress
    }
  }
  const round = saved.ivRound
  if (round) {
    if (!Array.isArray(round.entries) || !Array.isArray(round.matches) || !Number.isInteger(round.cursor) || round.cursor < 0 || round.cursor > round.entries.length
      || !/^\d{4}-\d{2}-\d{2}$/.test(round.date) || !Array.isArray(round.warnings)) throw new Error('Ongeldige IV-scanvoortgang.')
    round.matches = new Map(round.matches)
  }
  return { scans: saved.scans, round }
}
export function createScanStore(path, gateway) {
  let tail = Promise.resolve()
  return {
    async load() {
      try { return restoreScans(await readFile(path, 'utf8'), gateway) }
      catch (error) { if (error.code === 'ENOENT') return null; throw error }
    },
    save(scans, round) {
      // Freeze the matching result/cursor pair before queuing disk IO.
      const data = serializeScans(scans, round, gateway)
      const operation = tail.then(async () => {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path + '.tmp', data, { mode: 0o600 })
        await rename(path + '.tmp', path)
      })
      tail = operation.catch(() => {})
      return operation
    },
  }
}
