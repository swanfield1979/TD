import { setTimeout as sleep } from 'node:timers/promises'

export function createIbkrSynchronizer({ log, config, runtime, collectSnapshot, saveSnapshot,
  startGatewayService, setStatus, updateBusy, delay = (ms, signal) => sleep(ms, undefined, { signal }), now = Date.now }) {
  let active = null
  async function synchronize(source) {
    // Set the lock before the first await so two HTTP/timer calls cannot start sessions together.
    const blocked = runtime.isBusy || updateBusy()
    if (blocked && ['background', 'startup'].includes(source)) return
    if (!blocked) runtime.isBusy = true
    const { sessionId, saved } = log.begin(source)
    const record = event => log.record(sessionId, source, event)
    let job, finish
    if (!blocked) {
      job = { sessionId, source, controller: new AbortController(), cancellable: true, done: new Promise(resolve => { finish = resolve }) }
      active = job
    }
    const check = () => job.controller.signal.throwIfAborted()
    try {
      await saved
      if (blocked) { await record('skipped'); return }
      check()
      const sessionConfig = { ...config, signal: job.controller.signal }
      setStatus('refreshing', 'Alle actuele gegevens worden bij IBKR opgehaald.', { isBusy: true })
      let snapshot
      try { snapshot = await collectSnapshot(sessionConfig) }
      catch {
        check()
        if (['startup', 'background'].includes(source)) {
          job.cancellable = false
          await record('offline')
          setStatus('offline', 'IBKR Gateway is niet verbonden.', { isBusy: false })
          return
        }
        await record('gateway_start')
        check()
        await startGatewayService(job.controller.signal)
        check()
        await record('awaiting_mfa')
        check()
        setStatus('awaiting_mfa', 'Bevestig zo nodig de aanmelding in IBKR Mobile.', { isBusy: true })
        const deadline = now() + config.mfaTimeoutMs
        while (now() < deadline) {
          await delay(5000, job.controller.signal)
          check()
          try { snapshot = await collectSnapshot(sessionConfig, 10000); break } catch { check() }
        }
        if (!snapshot) {
          check()
          job.cancellable = false
          await record('timed_out')
          setStatus('error', 'De Gateway-verbinding of IBKR Mobile-bevestiging is verlopen. Klik op Opnieuw proberen.', { isBusy: false })
          return
        }
      }
      check()
      // An atomic snapshot commit cannot be undone: disable cancellation at this boundary.
      job.cancellable = false
      await saveSnapshot(snapshot)
      await record('completed')
      setStatus('connected', 'Alle actuele IBKR-gegevens zijn bijgewerkt.', { lastUpdatedAt: snapshot.generatedAt, isBusy: false })
    } catch {
      if (job) job.cancellable = false
      if (job?.controller.signal.aborted) {
        await record('cancelled')
        setStatus('stopped', 'Lopende synchronisatie gestopt. Gateway en automatische planning blijven actief.', { isBusy: false })
      } else {
        await record('failed')
        setStatus('error', 'De IBKR-synchronisatie is mislukt. Controleer Logboek en de lokale Gateway-service.', { isBusy: false })
      }
    } finally {
      if (!blocked) { runtime.isBusy = false; if (active === job) active = null; finish() }
    }
  }
  synchronize.canStop = () => !!active?.cancellable && !active.controller.signal.aborted
  synchronize.stop = async () => {
    const job = active
    if (!job) return { stopped: false, reason: 'idle' }
    if (job.controller.signal.aborted) { await job.done; return { stopped: true } }
    if (!job.cancellable) return { stopped: false, reason: 'finishing' }
    if (!job.controller.signal.aborted) {
      // Record once, before abort listeners can complete the session.
      void log.record(job.sessionId, job.source, 'stop_requested')
      setStatus('stopping', 'Synchronisatie wordt gestopt…', { isBusy: true })
      job.controller.abort()
    }
    await job.done
    return { stopped: true }
  }
  return synchronize
}
