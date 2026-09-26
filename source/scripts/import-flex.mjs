import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPortfolioSummary } from './flex-parser.mjs'

const privateDataDirectory = resolve('data/private')
const outputDirectory = resolve('public/data')
const outputPath = resolve(outputDirectory, 'portfolio-summary.json')

const [equityXml, tradesXml, optionXml] = await Promise.all([
  readFile(resolve(privateDataDirectory, 'flex_net_liq_into_db.xml'), 'utf8'),
  readFile(resolve(privateDataDirectory, 'flex_trades_into_db.xml'), 'utf8'),
  readFile(resolve(privateDataDirectory, 'flex_optionEAE_into_db.xml'), 'utf8'),
])

const summary = createPortfolioSummary({ equityXml, tradesXml, optionXml })
await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

console.log(`Portfolio-overzicht geschreven naar ${outputPath}`)
console.log(`Saldo: $ ${summary.balance.value.toFixed(2)} (${summary.balance.toDate})`)
