import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPortfolioSummary } from './flex-parser.mjs'

const privateDataDirectory = resolve('data/private')
const outputDirectory = resolve('public/data')
const outputPath = resolve(outputDirectory, 'portfolio-summary.json')

async function readFlexSources(prefix, required = true) {
  const filenames = (await readdir(privateDataDirectory))
    .filter((filename) => filename.startsWith(prefix) && filename.endsWith('.xml'))
    .sort()

  if (required && filenames.length === 0) throw new Error(`Geen Flex-bronnen gevonden voor ${prefix}*.xml`)

  const contents = await Promise.all(
    filenames.map((filename) => readFile(resolve(privateDataDirectory, filename), 'utf8')),
  )
  return { filenames, xml: contents.join('\n') }
}

const [equitySources, tradesSources, optionSources, contributionSources] = await Promise.all([
  readFlexSources('flex_net_liq_into_db'),
  readFlexSources('flex_trades_into_db'),
  readFlexSources('flex_optionEAE_into_db'),
  readFlexSources('Storting_', false),
])

const summary = createPortfolioSummary({
  equityXml: equitySources.xml,
  tradesXml: tradesSources.xml,
  optionXml: optionSources.xml,
  contributionsXml: contributionSources.xml,
})
await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

console.log(`Portfolio-overzicht geschreven naar ${outputPath}`)
console.log(`Bronnen: ${[...equitySources.filenames, ...tradesSources.filenames, ...optionSources.filenames, ...contributionSources.filenames].join(', ')}`)
console.log(`Saldo: $ ${summary.balance.value.toFixed(2)} (${summary.balance.toDate})`)
