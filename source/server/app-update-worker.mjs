import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdir, readFile, rename, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { activeUpdate, newerVersion, writeUpdate } from './app-update.mjs'

const execute = promisify(execFile)
const expectedOrigin = /^(https:\/\/github\.com\/swanfield1979\/TD(?:\.git)?|git@github\.com:swanfield1979\/TD(?:\.git)?)$/
export async function runAppUpdate({ sourceRoot, path, run = execute, fetchHealth = fetch, wait = ms => new Promise(done => setTimeout(done, ms)) }) {
  let job = JSON.parse(await readFile(path, 'utf8')), stage, phase = 'checking', changed = false
  if (job.state !== 'queued' || !['check', 'install'].includes(job.action)) throw Error('Geen geldige updateopdracht klaar gezet.')
  const root = dirname(resolve(sourceRoot))
  const command = async (file, args, cwd = sourceRoot, timeout = 120000) => {
    try {
      const result = await run(file, args, { cwd, timeout, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: '1', APP_UPDATER_DISABLED: '1', PUT_SPREAD_SCHEDULE_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' } })
      return String(result.stdout || '').trim()
    } catch (error) {
      // Detailed tool output stays in the server journal; redact common embedded credentials.
      const log = String(error.stderr || error.stdout || error.message).replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, 'https://[afgeschermd]@').replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, '[afgeschermd]')
      console.error(`Applicatie-update: ${file} mislukt. ${log.slice(-12000)}`)
      throw error
    }
  }
  const git = (...args) => command('git', args, root)
  const progress = async (state, message, extra = {}) => {
    phase = state; job = { ...job, ...extra, state, message, updatedAt: new Date().toISOString() }
    await writeUpdate(path, job)
  }
  try {
    await progress('checking', 'GitHub en lokale installatie controleren…')
    if (!expectedOrigin.test(await git('remote', 'get-url', 'origin'))) throw Error('De Git-origin is niet de verwachte Trading Monitor-repository.')
    if (await git('branch', '--show-current') !== 'main') throw Error('De server staat niet op de main-branch. Werk de server eerst handmatig bij.')
    if (await git('status', '--porcelain')) throw Error('Er staan lokale wijzigingen in de serverrepository. Bewaar of commit die eerst; er wordt niets overschreven.')
    await git('fetch', '--no-tags', 'origin', 'main')
    const target = await git('rev-parse', 'FETCH_HEAD')
    if (!/^[a-f0-9]{40}$/.test(target)) throw Error('Ongeldige GitHub-revisie.')
    await git('merge-base', '--is-ancestor', 'HEAD', target)
    const latest = JSON.parse(await git('show', `${target}:source/package.json`)).version
    const available = newerVersion(latest, job.currentVersion)
    if (job.action === 'check') {
      await progress('complete', available ? `Versie ${latest} is beschikbaar.` : 'Je gebruikt de nieuwste stabiele versie.',
        { available, latestVersion: latest, targetRevision: target, checkedAt: new Date().toISOString() })
      return job
    }
    if (!available || job.targetRevision !== target || job.latestVersion !== latest) throw Error('De beschikbare versie is gewijzigd. Controleer opnieuw voordat je installeert.')
    await progress('downloading', `Versie ${latest} apart voorbereiden…`)
    const stageBase = join(sourceRoot, '.app-updates')
    await mkdir(stageBase, { recursive: true })
    stage = join(stageBase, target)
    // The path is derived solely from a validated Git object ID, never from a request URL.
    await git('worktree', 'add', '--detach', stage, target)
    const candidate = join(stage, 'source')
    // Preserve the private, generated dashboard baseline in the new frontend build.
    try { await stat(join(sourceRoot, 'public/data/portfolio-summary.json')); await mkdir(join(candidate, 'public/data'), { recursive: true }); await cp(join(sourceRoot, 'public/data/portfolio-summary.json'), join(candidate, 'public/data/portfolio-summary.json')) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    await command('npm', ['ci', '--no-audit', '--no-fund'], candidate, 600000)
    await progress('testing', 'Nieuwe versie testen…')
    await command('npm', ['test'], candidate, 600000)
    await command('npm', ['run', 'test:frontend'], candidate, 300000)
    await progress('building', 'Nieuwe webapp bouwen…')
    await command('npm', ['run', 'build'], candidate, 300000)
    if (await git('status', '--porcelain')) throw Error('De serverrepository is tijdens de voorbereiding gewijzigd; installatie afgebroken.')
    await progress('publishing', 'Gecontroleerde versie plaatsen en back-up maken…')
    await git('merge', '--ff-only', target)
    changed = true
    await cp(join(candidate, 'dist'), join(sourceRoot, 'dist'), { recursive: true, force: true })
    // Keep the former dependencies for manual recovery; the running API is restarted below.
    try { await rename(join(sourceRoot, 'node_modules'), join(stageBase, `dependencies-${Date.now()}`)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    await rename(join(candidate, 'node_modules'), join(sourceRoot, 'node_modules'))
    await progress('restarting', 'Back-up maken, webapp publiceren en services herstarten…')
    await command('/usr/bin/sudo', ['-n', '/usr/local/libexec/trading-monitor-publish'], sourceRoot, 120000)
    let healthy = false
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetchHealth('http://127.0.0.1:8787/api/app-update', { signal: AbortSignal.timeout(3000) })
        if (response.ok && (await response.json()).installedVersion === latest) { healthy = true; break }
      } catch { /* A short disconnect during the API restart is expected. */ }
      await wait(2000)
    }
    if (!healthy) throw Error('De nieuwe API-versie kon na de herstart niet worden bevestigd. Controleer de services en de serverback-up.')
    await progress('complete', `Versie ${latest} is geïnstalleerd. Open de nieuwe webapp.`, { available: false, installed: true, finishedAt: new Date().toISOString() })
  } catch (error) {
    // Do not expose npm/git output, remote credentials or arbitrary command text in the browser.
    const explanation = !error.cmd && error.message ? error.message : 'De serveropdracht is mislukt. De beheerder kan het updateservice-log bekijken.'
    await progress('error', `${explanation}${changed ? ' De broncode is al bijgewerkt; controleer de installatie handmatig.' : ' De actieve installatie is niet vervangen.'}`, { failedPhase: phase, available: false, installed: false })
  } finally {
    if (stage) { try { await git('worktree', 'remove', '--force', stage) } catch { /* Keep failed staging output for diagnosis if removal fails. */ } }
  }
  return job
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const result = await runAppUpdate({ sourceRoot, path: process.env.APP_UPDATE_STATE || '/var/lib/trading-monitor/app-update.json' })
  if (result.state === 'error') process.exitCode = 1
}
