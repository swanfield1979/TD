import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const execute = promisify(execFile)
export const updateUnit = 'trading-monitor-update.service'
export const activeUpdate = state => ['queued', 'checking', 'downloading', 'testing', 'building', 'publishing', 'restarting'].includes(state)
export async function writeUpdate(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path + '.tmp', JSON.stringify(data), { mode: 0o600 })
  await rename(path + '.tmp', path)
}
export function newerVersion(candidate, installed) {
  if (![candidate, installed].every(value => /^\d+\.\d+\.\d+$/.test(value))) throw Error('Alleen stabiele versies met drie versienummers worden ondersteund.')
  const a = candidate.split('.').map(Number), b = installed.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}
export function createAppUpdater({ path, sourceRoot, installedVersion, busy = () => false,
  marker = '/etc/trading-monitor/app-updater.json', platform = process.platform, disabled = process.env.APP_UPDATER_DISABLED === '1',
  run = execute, now = () => new Date() }) {
  let starting = false, cached = { state: 'idle' }
  const configured = async () => {
    if (platform !== 'linux' || disabled) return false
    try {
      const setup = JSON.parse(await readFile(marker, 'utf8'))
      return setup.sourceRoot === resolve(sourceRoot) && setup.statePath === resolve(path)
    } catch { return false }
  }
  const snapshot = async () => {
    let storageError
    try { cached = JSON.parse(await readFile(path, 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') storageError = 'Updatestatus is onleesbaar. Controleer het statusbestand op de server.' }
    // A killed worker or server reboot must not leave the update permanently busy.
    if (activeUpdate(cached.state) && Date.now() - Date.parse(cached.updatedAt) > 45 * 60 * 1000) {
      cached = { ...cached, state: 'error', message: 'Update onderbroken of langer dan 45 minuten bezig. Controleer de updateservice op de server.' }
    }
    const enabled = await configured()
    if (enabled && activeUpdate(cached.state) && Date.now() - Date.parse(cached.updatedAt) > 15000) {
      try {
        const unit = await run('/usr/bin/systemctl', ['show', updateUnit, '-p', 'ActiveState', '--value'], { timeout: 3000, maxBuffer: 16384 })
        if (['inactive', 'failed'].includes(String(unit.stdout).trim())) {
          const latest = JSON.parse(await readFile(path, 'utf8'))
          cached = latest
          if (activeUpdate(latest.state) && Date.now() - Date.parse(latest.updatedAt) > 15000) {
            cached = { ...latest, state: 'error', message: 'De updateservice is gestopt voordat de update klaar was. Controleer het updateservice-log op de server.' }
            await writeUpdate(path, cached)
          }
        }
      } catch { /* A temporary systemctl failure is not proof that the worker stopped. */ }
    }
    return { ...cached, installedVersion, configured: enabled, busy: starting || activeUpdate(cached.state), blocked: busy(), storageError }
  }
  return {
    snapshot,
    isBusy: () => starting || activeUpdate(cached.state),
    async start(action) {
      if (!['check', 'install'].includes(action)) throw Error('Kies controleren of installeren.')
      if (starting) throw Error('Er loopt al een updateactie.')
      starting = true
      try {
        const state = await snapshot()
        if (state.storageError) throw Error(state.storageError)
        if (!state.configured) throw Error('De updateservice is nog niet geïnstalleerd. Volg de eenmalige installatiehandleiding.')
        if (activeUpdate(state.state)) throw Error('Er loopt al een updateactie.')
        if (busy()) throw Error('Wacht tot scans en het vernieuwen van IBKR klaar zijn, of stop de scans eerst.')
        if (action === 'install' && (!state.available || !/^[a-f0-9]{40}$/.test(state.targetRevision || '') || !newerVersion(state.latestVersion, installedVersion))) throw Error('Controleer eerst of er een nieuwe versie beschikbaar is.')
        const next = { state: 'queued', action, currentVersion: installedVersion,
          targetRevision: action === 'install' ? state.targetRevision : undefined,
          latestVersion: action === 'install' ? state.latestVersion : undefined,
          startedAt: now().toISOString(), updatedAt: now().toISOString(),
          message: action === 'check' ? 'Nieuwe versie controleren…' : 'Update wordt gestart…' }
        await writeUpdate(path, next); cached = next
        try {
          await run('/usr/bin/sudo', ['-n', '/usr/bin/systemctl', 'start', '--no-block', updateUnit], { timeout: 10000, maxBuffer: 16384 })
        } catch {
          cached = { ...next, state: 'error', message: 'De updateservice kon niet starten. Controleer de installatie en serverrechten.', updatedAt: now().toISOString() }
          await writeUpdate(path, cached)
        }
        return snapshot()
      } finally { starting = false }
    },
  }
}
