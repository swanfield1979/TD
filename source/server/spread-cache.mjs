import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export function createSpreadCache(directory, gateway) {
  const file = symbol => join(directory, createHash('sha256').update(symbol).digest('hex') + '.json')
  return {
    async getIv(symbol) {
      try {
        const data = JSON.parse(await readFile(join(directory, 'iv-' + createHash('sha256').update(symbol).digest('hex') + '.json'), 'utf8'))
        if (data.gateway !== gateway || data.symbol !== symbol || !Array.isArray(data.bars) || !data.day) throw Error('Ongeldige IV-historiecache.')
        return data
      } catch (error) { if (error.code === 'ENOENT') return null; throw error }
    },
    async saveIv(symbol, snapshot) {
      await mkdir(directory, { recursive: true })
      const path = join(directory, 'iv-' + createHash('sha256').update(symbol).digest('hex') + '.json')
      await writeFile(path + '.tmp', JSON.stringify({ ...snapshot, symbol, gateway, savedAt: new Date().toISOString() }), { mode: 0o600 })
      await rename(path + '.tmp', path)
    },
    async get(symbol) {
      try {
        const data = JSON.parse(await readFile(file(symbol), 'utf8'))
        if (data.version !== 1 || data.gateway !== gateway || data.symbol !== symbol || !Array.isArray(data.puts)
          || !Number.isFinite(data.ivr) || !(data.underlyingPrice > 0) || !data.quotedAt) throw Error('Ongeldige opgeslagen optiechain.')
        return data
      } catch (error) { if (error.code === 'ENOENT') return null; throw error }
    },
    async save(symbol, snapshot) {
      await mkdir(directory, { recursive: true })
      const path = file(symbol)
      await writeFile(path + '.tmp', JSON.stringify({ ...snapshot, symbol, version: 1, gateway, savedAt: new Date().toISOString() }), { mode: 0o600 })
      await rename(path + '.tmp', path)
    },
    async universe(loader, signal) {
      const path = join(directory, 'universe.json')
      try {
        const data = await loader(signal)
        await mkdir(directory, { recursive: true })
        await writeFile(path + '.tmp', JSON.stringify(data), { mode: 0o600 }); await rename(path + '.tmp', path)
        return data
      } catch (error) {
        signal?.throwIfAborted()
        try {
          const data = JSON.parse(await readFile(path, 'utf8'))
          if (!Array.isArray(data.entries) || !data.entries.length || !data.updatedAt) throw error
          return { ...data, cached: true, warning: `Universumbron niet bereikbaar; opgeslagen lijst van ${data.updatedAt}.` }
        } catch { throw error }
      }
    },
  }
}
