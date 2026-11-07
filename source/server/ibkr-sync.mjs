export function createIbkrSynchronizer({ log, config, runtime, collectSnapshot, saveSnapshot,
  startGatewayService, setStatus, updateBusy, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now }) {
  return async function synchronize(source) {
    // Set the lock before the first await so two HTTP/timer calls cannot start sessions together.
    const blocked = runtime.isBusy || updateBusy()
    if (blocked && ['background', 'startup'].includes(source)) return
    if (!blocked) runtime.isBusy = true
    const { sessionId, saved } = log.begin(source)
    const record = event => log.record(sessionId, source, event)
    try {
      await saved
      if (blocked) { await record('skipped'); return }
      setStatus('refreshing', 'Alle actuele gegevens worden bij IBKR opgehaald.', { isBusy: true })
      let snapshot
      try { snapshot = await collectSnapshot(config) }
      catch {
        if (['startup', 'background'].includes(source)) {
          await record('offline')
          setStatus('offline', 'IBKR Gateway is niet verbonden.', { isBusy: false })
          return
        }
        await record('gateway_start')
        await startGatewayService()
        await record('awaiting_mfa')
        setStatus('awaiting_mfa', 'Bevestig zo nodig de aanmelding in IBKR Mobile.', { isBusy: true })
        const deadline = now() + config.mfaTimeoutMs
        while (now() < deadline) {
          await delay(5000)
          try { snapshot = await collectSnapshot(config, 10000); break } catch { /* Wait for the existing login. */ }
        }
        if (!snapshot) {
          await record('timed_out')
          setStatus('error', 'De Gateway-verbinding of IBKR Mobile-bevestiging is verlopen. Klik op Opnieuw proberen.', { isBusy: false })
          return
        }
      }
      await saveSnapshot(snapshot)
      await record('completed')
      setStatus('connected', 'Alle actuele IBKR-gegevens zijn bijgewerkt.', { lastUpdatedAt: snapshot.generatedAt, isBusy: false })
    } catch {
      await record('failed')
      setStatus('error', 'De IBKR-synchronisatie is mislukt. Controleer Logboek en de lokale Gateway-service.', { isBusy: false })
    } finally { if (!blocked) runtime.isBusy = false }
  }
}
