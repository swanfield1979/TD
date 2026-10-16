import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { defaults, analyzeMartin, completedBars, premarketSignal, makeLists } from '../shared/martin-selection.mjs'

import { parseSymbols } from '../shared/martin-data.mjs'
import { scanMarket } from '../server/martin-market-scan.mjs'
export { parseSymbols, download } from '../shared/martin-data.mjs'


const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
export async function main(args = process.argv.slice(2), hooks = {}) {
  const { values: v } = parseArgs({ args, options: { symbols: { type: 'string' }, universe: { type: 'string' }, input: { type: 'string' }, premarket: { type: 'string' }, themes: { type: 'string' }, out: { type: 'string', default: 'data/private/martin' }, top: { type: 'string', default: '20' }, 'adr-min': { type: 'string', default: '5' }, 'min-volume': { type: 'string', default: '10000000' }, 'gap-min': { type: 'string', default: '3' }, 'premarket-volume': { type: 'string', default: '100000' }, resume: { type: 'boolean' }, help: { type: 'boolean' } } })
  if (v.help) { console.log('node scripts/scan-martin.mjs [--resume] [--symbols NVDA,AMD] [--universe tickers.txt] [--input bars.json] [--themes themes.json] [--premarket quotes.json] [--top 20] [--adr-min 5] [--min-volume 10000000] [--gap-min 3] [--premarket-volume 100000] [--out data/private/martin]\nZie docs/martin-scanner.md voor formaten en beperkingen.'); return }
  if (v.symbols && v.universe) throw new Error('Kies --symbols of --universe')
  const config = { ...defaults, top: Number(v.top), adrMin: Number(v['adr-min']), minDollarVolume: Number(v['min-volume']), gapMin: Number(v['gap-min']), premarketVolumeMin: Number(v['premarket-volume']) }
  if (!Number.isInteger(config.top) || config.top < 1 || config.top > 5000 || [config.adrMin, config.minDollarVolume, config.gapMin, config.premarketVolumeMin].some(x => !Number.isFinite(x) || x < 0)) throw new Error('Ongeldige numerieke filterinstelling')
  const now = Date.now(), raw = []
  let failures = [], rows = [], report
  const json = async file => file ? JSON.parse(await readFile(file, 'utf8')) : {}
  const snapshots = await json(v.premarket), themes = await json(v.themes)
  let entries
  if (v.input) {
    if (v.symbols || v.universe) throw new Error('--input bevat zelf het universum')
    entries = (await json(v.input)).results
    if (!Array.isArray(entries)) throw new Error('Input vereist results: [{symbol,bars,source}]')
    parseSymbols(entries.map(r => r.symbol).join(','))
    if (new Set(entries.map(r => r.symbol)).size !== entries.length) throw new Error('Dubbele ticker in input')
  } else {
    const customSymbols = v.universe ? parseSymbols(await readFile(v.universe, 'utf8')) : v.symbols ? parseSymbols(v.symbols) : undefined
    report = await scanMarket({ directory: v.out, config, customSymbols, resume: !!v.resume, signal: hooks.signal, themes, snapshots: v.premarket ? snapshots : undefined, onProgress: hooks.onProgress })
    rows = report.rows; failures = report.failures; entries = []
  }
  for (const entry of entries) {
    try {
      const bars = completedBars(entry.bars, now), analysis = analyzeMartin(bars, config)
      if (now - Date.parse(`${analysis.date}T00:00:00Z`) > 5 * 86400000) throw new Error('Laatste dagcandle ouder dan vijf kalenderdagen')
      const row = { symbol: entry.symbol, theme: typeof themes[entry.symbol] === 'string' ? themes[entry.symbol] : null, ...analysis, source: entry.source ?? 'Lokale import' }
      row.premarket = premarketSignal(v.premarket ? snapshots[entry.symbol] : entry.premarket, row, now, config)
      row.premarketError = entry.premarketError ?? null
      rows.push(row); raw.push({ ...entry, bars })
    } catch (e) { failures.push({ symbol: entry.symbol, error: e.message }) }
  }
  const lists = report?.lists ?? makeLists(rows, config)
  report ??= { generatedAt: new Date(now).toISOString(), mode: v.input ? 'lokale import' : 'Yahoo Finance (experimenteel)', requested: entries.length + failures.filter(f => !entries.some(e => e.symbol === f.symbol)).length, analyzed: rows.length, config, rows, lists, failures }
  await mkdir(v.out, { recursive: true })
  await writeFile(`${v.out}/scan.json`, JSON.stringify(report, null, 2))
  await writeFile(`${v.out}/bars.json`, JSON.stringify(v.input ? { results: raw } : { mode: 'per-symbol-cache', directory: 'daily-cache' }, null, 2))
  const columns = ['symbol', 'date', 'status', 'close', 'adr', 'dollarVolume', 'dayReturn', 'monthReturn', 'premier', 'insideDay', 'tight', 'trigger', 'stopReference', 'stopPct', 'maxStopPct', 'theme']
  await writeFile(`${v.out}/watchlist.csv`, [columns.join(','), ...rows.map(r => columns.map(k => csvCell(r[k])).join(','))].join('\n'))
  for (const name of ['focus', 'potent', 'leaders', 'premarket']) await writeFile(`${v.out}/${name}-tradingview.txt`, lists[name].map(r => r.symbol).join(',') + '\n')
  const f = n => Number(n).toFixed(2)
  const table = items => ['| Ticker | Datum | Status | ADR % | $ mln/dag | Dag % | Maand % | Trigger* | Stop* | Redenen |', '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |', ...items.map(r => `| ${r.symbol} | ${r.date} | ${r.status} | ${f(r.adr)} | ${f(r.dollarVolume / 1e6)} | ${f(r.dayReturn)} | ${f(r.monthReturn)} | ${f(r.trigger)} | ${f(r.stopReference)} | ${r.reasons.join('; ') || 'Dagfilters voldoen; grafiek beoordelen'} |`)].join('\n')
  const md = ['# Martin-watchlist', '', `Gegenereerd: ${report.generatedAt}. Bronmodus: ${report.mode}. Dekking: ${rows.length}/${report.requested}.`, '', `Universum: ${report.universe?.name ?? 'Lokale import'}. ${report.complete === false ? 'Scan onvolledig; watchlists zijn voorlopig.' : ''}`, '', 'KLAARZETTEN is een kandidaat voor handmatige beoordeling, geen koop- of live-uitbraaksignaal. Geen orders.', '', '## Focus', table(lists.focus), '', '## Potent: sterkste laatste afgesloten handelsdag', table(lists.potent), '', '## Leaders: sterkste 21 sessies', table(lists.leaders), '', '## Premarket', `${lists.premarket.length} actuele matches; ${rows.filter(r => ['GAPPER', 'GEEN_MATCH'].includes(r.premarket.status)).length}/${rows.length} bruikbare quotes. Automatisch ophalen alleen tussen 04:00 en 09:30 New York. Ontbrekende/oude quotes worden niet gebruikt.`, table(lists.premarket), ...rows.filter(r => r.premarketError).map(r => `- ${r.symbol}: ${r.premarketError}`), '', '## Thematische clusters', ...lists.themes.map(g => `- ${g.theme}: ${g.symbols.join(', ')}`), ...(lists.themes.length ? [] : ['Geen clusters vastgesteld; themametadata kan ontbreken.']), '', '## Alle beoordeelde aandelen', table(rows), '', '## Data-uitval', ...failures.map(r => `- ${r.symbol}: ${r.error}`), '', '* Trigger = laatste daghigh + $0,01; stopreferentie = laatste daglow − $0,01, voor de volgende sessie. Geen actuele daglow of vijfminutenstop. Stopafstand < min(5%, ADR/2). Earnings, splits, spreads, indices en weekbasis handmatig beoordelen. Premier: dollaromzet > $100 miljoen. Extra drempels zijn ontwerpkeuzes; zie docs/martin-scanner.md.', ''].join('\n')
  await writeFile(`${v.out}/watchlist.md`, md)
  if (!hooks.quiet) console.log(JSON.stringify({ report: `${v.out}/watchlist.md`, analyzed: rows.length, requested: report.requested, focus: lists.focus.map(r => r.symbol), failures }, null, 2))
  if (!rows.length && !hooks.quiet) process.exitCode = 1
  return report
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  main(process.argv.slice(2), { signal: controller.signal }).catch(e => { console.error(e.message); process.exitCode = 1 })
}
