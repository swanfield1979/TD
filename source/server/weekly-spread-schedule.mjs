import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { optionsSession } from './spread-scan.mjs'

const defaults = { enabled: true, stockDay: 0, stockTime: '09:00', timeZone: 'Europe/Amsterdam', ivAtMarketOpen: true }
export function scheduleSettings(input) {
  if (typeof input?.enabled !== 'boolean' || !Number.isInteger(input.stockDay) || input.stockDay < 0 || input.stockDay > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.stockTime) || typeof input.ivAtMarketOpen !== 'boolean') throw Error('Gebruik een geldige weekdag, tijd en planningskeuze.')
  return { enabled: input.enabled, stockDay: input.stockDay, stockTime: input.stockTime, timeZone: 'Europe/Amsterdam', ivAtMarketOpen: input.ivAtMarketOpen }
}
export function localScheduleTime(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(date).map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), time: `${parts.hour}:${parts.minute}` }
}
// The API process owns scheduling. Claims are durable before launching a job,
// preventing duplicate runs after restart or the repeated DST hour.
export async function createWeeklySpreadSchedule(path, { busy, runStock, runIv, now = () => new Date() }) {
  let state = { settings: defaults, state: 'idle' }, active = false, saving = false, storageError
  try {
    const data = JSON.parse(await readFile(path, 'utf8'))
    if (data.version !== 1) throw Error('Ongeldige planning.')
    state = { ...data, settings: scheduleSettings(data.settings) }
    if (state.state === 'running') { state.state = 'interrupted'; state.message = 'Weekscan onderbroken door serverherstart; hervat de betreffende scan handmatig.' }
  } catch (error) { if (error.code !== 'ENOENT') storageError = 'Weekplanning is onleesbaar; controleer put-spread-schedule.json.' }
  const persist = async next => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path + '.tmp', JSON.stringify({ ...next, version: 1 }), { mode: 0o600 }); await rename(path + '.tmp', path)
  }
  const snapshot = () => ({ ...state, settings: { ...state.settings }, running: active, storageError })
  return {
    snapshot,
    isRunning: () => active,
    async configure(input) {
      if (storageError) throw Error(storageError)
      if (active || saving) throw Error('Weekplanning is bezig; wacht tot de scan klaar is.')
      const next = { ...state, settings: scheduleSettings(input) }
      saving = true
      try { await persist(next); state = next } finally { saving = false }
      return snapshot()
    },
    async tick() {
      if (active || saving || storageError || !state.settings.enabled || busy()) return
      const date = now(), local = localScheduleTime(date), session = optionsSession(date), settings = state.settings
      const [hour, minute] = settings.stockTime.split(':').map(Number), [actualHour, actualMinute] = local.time.split(':').map(Number)
      const late = actualHour * 60 + actualMinute - hour * 60 - minute
      let phase
      // Catch up within the scheduled Sunday, provided no job already claimed it.
      if (local.day === settings.stockDay && late >= 0 && state.lastStockDate !== local.date) phase = 'stock'
      else if (settings.ivAtMarketOpen && state.pendingSelectionId && state.ivClaimedSelectionId !== state.pendingSelectionId && session.open && local.date > state.lastStockDate) phase = 'iv'
      if (!phase) return
      active = true
      state = { ...state, state: 'running', phase, message: undefined, startedAt: date.toISOString(), ...(phase === 'stock' ? { lastStockDate: local.date, pendingSelectionId: undefined } : { ivClaimedSelectionId: state.pendingSelectionId }) }
      try {
        await persist(state)
        const result = phase === 'stock' ? await runStock() : await runIv(state.pendingSelectionId)
        if (!['complete', 'partial'].includes(result.state)) throw Error(result.message || 'Weekscan niet afgerond; controleer en hervat handmatig.')
        if (phase === 'stock') state.pendingSelectionId = result.id
        state.state = 'complete'; state.message = phase === 'stock' ? 'Stock Filter opgeslagen; IV Scan wacht op de eerstvolgende beursopening.' : 'IV Scan opgeslagen; Option Scan kan handmatig worden gestart.'
      } catch (error) { state.state = 'error'; state.message = error.message }
      finally {
        state.finishedAt = now().toISOString()
        try { await persist(state) } catch { storageError = 'Weekplanning kon niet worden opgeslagen.' }
        active = false
      }
    },
  }
}
