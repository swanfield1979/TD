import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createYahooOptionClient, yahooSymbol } from '../server/yahoo-option-chains.mjs'
const args = process.argv.slice(2), symbol = args[0]?.toUpperCase()
if (!symbol || args.length > 3) throw Error('Gebruik: npm run scrape:yahoo -- AAPL [minimum-DTE] [maximum-DTE]')
yahooSymbol(symbol)
const directory = resolve('data/private/yahoo-options')
const client = createYahooOptionClient({ directory: resolve(directory, 'cache') })
try {
  const result = await client.scrape(symbol, { minDte: args[1] === undefined ? 40 : Number(args[1]), maxDte: args[2] === undefined ? 100 : Number(args[2]) })
  await mkdir(directory, { recursive: true })
  const path = resolve(directory, yahooSymbol(symbol) + '.json')
  await writeFile(path, JSON.stringify(result, null, 2), { mode: 0o600 })
  console.log(`${symbol}: ${result.chains.length} expiraties, ${result.chains.reduce((sum, chain) => sum + chain.puts.length + chain.calls.length, 0)} contracten, ${result.requests} chainaanvragen, ${result.cacheHits} cachehits, ${result.elapsedMs} ms. Opgeslagen: ${path}`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
