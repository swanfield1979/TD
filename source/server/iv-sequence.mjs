import { setTimeout as sleep } from 'node:timers/promises'

export const IV_BATCH_PAUSE_MS = 20000
export async function runIvSequence(state, {
  signal, runBatch, checkpoint = async () => {},
  wait = (ms, signal) => sleep(ms, undefined, { signal }), now = () => new Date(),
}) {
  state.automatic = true
  state.batchesCompleted = 0
  try {
    while (true) {
      signal?.throwIfAborted()
      state.state = 'running'
      state.phase = 'scanning'
      delete state.nextBatchAt
      await runBatch()
      state.warnings = [...new Set(state.warnings)]
      if (!['complete', 'partial'].includes(state.state)) break
      state.batchesCompleted++
      if (!(state.remainingSymbols > 0)) break
      state.state = 'running'
      state.phase = 'waiting'
      state.nextBatchAt = new Date(now().getTime() + IV_BATCH_PAUSE_MS).toISOString()
      state.progress = `${state.universeChecked} / ${state.universeCount} aandelen gecontroleerd. Volgend blok van 25 start over 20 seconden.`
      await checkpoint()
      if (state.storageError) throw new Error('Automatische scan gestopt: voortgang kon niet worden opgeslagen. Controleer de privédatamap.')
      await wait(Math.max(0, Date.parse(state.nextBatchAt) - now().getTime()), signal)
    }
  } catch (error) {
    state.state = signal?.aborted ? 'cancelled' : 'error'
    state.message = signal?.aborted ? 'Automatische IV-scan gestopt; resultaten en voortgang zijn bewaard.' : error.message
  } finally {
    delete state.nextBatchAt
    state.phase = state.state
    state.finishedAt = now().toISOString()
    await checkpoint()
  }
}
