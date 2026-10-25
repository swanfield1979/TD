import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

export function stockKey(symbol) {
  const key = String(symbol).trim().toUpperCase().replace(/[. ]/g, '-')
  if (!/^[A-Z][A-Z0-9]*(?:-[A-Z])?$/.test(key) || key.length > 20) throw Error('Gebruik een geldige Amerikaanse aandelenticker.')
  return key
}
export async function createBlockedStocks(path) {
  let entries = [], unblocked = {}, storageError, saving = false
  try {
    const data = JSON.parse(await readFile(path, 'utf8'))
    if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.some(item => stockKey(item.symbol) !== item.symbol || !item.blockedAt)) throw Error('Ongeldige blokkeerlijst.')
    entries = data.entries
    if (data.unblocked && typeof data.unblocked === 'object' && !Array.isArray(data.unblocked)) unblocked = data.unblocked
  } catch (error) { if (error.code !== 'ENOENT') storageError = 'Geblokkeerde Stocks kon niet worden gelezen; controleer blocked-stocks.json.' }
  const assertReadable = () => { if (storageError) throw Error(storageError) }
  return {
    snapshot: () => ({ entries: [...entries], storageError }),
    assertReadable,
    isSaving: () => saving,
    has(symbol) { assertReadable(); return entries.some(item => item.symbol === stockKey(symbol)) },
    async update(symbol, block, metadata = {}) {
      assertReadable()
      if (saving) throw Error('Blokkeerlijst wordt opgeslagen; probeer opnieuw.')
      const key = stockKey(symbol), next = entries.filter(item => item.symbol !== key)
      if (block && metadata.automatic && Date.parse(metadata.observedAt) <= Date.parse(unblocked[key])) return this.snapshot()
      if (block) next.push(entries.find(item => item.symbol === key) || { symbol: key, blockedAt: new Date().toISOString(), ...(metadata.automatic ? { automatic: true, stage: metadata.stage, reason: metadata.reason, observedAt: metadata.observedAt } : {}) })
      const nextUnblocked = { ...unblocked }
      if (block) delete nextUnblocked[key]
      else nextUnblocked[key] = new Date().toISOString()
      next.sort((a, b) => a.symbol.localeCompare(b.symbol))
      saving = true
      try {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path + '.tmp', JSON.stringify({ version: 1, entries: next, unblocked: nextUnblocked }), { mode: 0o600 }); await rename(path + '.tmp', path)
        entries = next; unblocked = nextUnblocked
      } finally { saving = false }
      return this.snapshot()
    },
  }
}
