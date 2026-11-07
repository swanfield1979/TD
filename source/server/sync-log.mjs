import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export const syncSources = ['manual', 'scheduled', 'startup', 'background']
export const syncMessages = {
  started: 'Synchronisatiesessie gestart.',
  gateway_start: 'Start van IB Gateway aangevraagd; dit kan een IB Key-verzoek veroorzaken.',
  awaiting_mfa: 'Gateway-start geaccepteerd; wachten op verbinding en eventuele IB Key-bevestiging.',
  completed: 'IBKR-gegevens opgehaald en opgeslagen.',
  offline: 'Bestaande Gateway-verbinding niet beschikbaar; geen aanmelding gestart.',
  failed: 'Synchronisatie mislukt; controleer de lokale Gateway- en servicelogging.',
  timed_out: 'Wachten op Gateway-verbinding of IB Key-bevestiging verlopen.',
  skipped: 'Verzoek overgeslagen omdat synchronisatie of een app-update bezig is.',
  interrupted: 'Sessie onderbroken door een API-herstart; resultaat niet vastgesteld.',
}

// Only fixed messages and validated metadata enter this private log: never broker errors/accounts.
export async function createSyncLog({ path, limit = 5000, now = () => new Date() }) {
  let entries = [], storageError = null, queue = Promise.resolve(), readFailed = false
  try {
    const saved = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(saved) || saved.some(e => !e || !syncSources.includes(e.source) || !syncMessages[e.event]
      || typeof e.sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(e.sessionId) || !Number.isFinite(Date.parse(e.at)))) throw Error('Invalid sync log')
    entries = saved.slice(-limit).map(({ sessionId, source, event, at }) => ({ sessionId, source, event, at, message: syncMessages[event] }))
  } catch (error) {
    if (error.code !== 'ENOENT') { readFailed = true; storageError = 'Logbestand kon niet worden gelezen. Het bestaande bestand wordt niet overschreven; controleer de serveropslag.' }
  }
  function record(sessionId, source, event) {
    if (!syncSources.includes(source) || !syncMessages[event]) throw Error('Invalid sync event')
    const entry = { sessionId, source, event, at: now().toISOString(), message: syncMessages[event] }
    entries.push(entry); entries = entries.slice(-limit)
    // Fixed metadata is also available in the service journal, including storage failures.
    console.info(`IBKR-sync ${JSON.stringify(entry)}`)
    queue = queue.then(async () => {
      if (readFailed) return
      try {
        await mkdir(dirname(path), { recursive: true, mode: 0o700 })
        await writeFile(`${path}.tmp`, JSON.stringify(entries), { mode: 0o600 })
        await rename(`${path}.tmp`, path)
        storageError = null
      } catch {
        storageError = 'Synchronisatielog kon niet worden opgeslagen. Nieuwe regels staan tijdelijk alleen in het geheugen en het servicejournal; controleer de serveropslag.'
        console.error('IBKR-sync: logopslag mislukt.')
      }
    })
    return queue
  }
  const latest = new Map(entries.map(e => [e.sessionId, e]))
  for (const entry of latest.values()) {
    if (['started', 'gateway_start', 'awaiting_mfa'].includes(entry.event)) await record(entry.sessionId, entry.source, 'interrupted')
  }
  return {
    begin(source) { const sessionId = randomUUID(); return { sessionId, saved: record(sessionId, source, 'started') } },
    record,
    async snapshot() { await queue; return { entries: entries.slice(-500).reverse(), retained: entries.length, limit, storageError } },
  }
}
