# Martin-selectiescanner

Lokale scanner v1.0, 16 oktober 2026. Gebaseerd op het aangeleverde interview **283% Gain in 1 Year – The Story of the 22-Year-Old Swing Trader**, met Martin Luke. Dit is een zelfstandige onderzoeksscan binnen Trading Monitor; de appversie blijft 0.31.6. Geen automatische orders of wijziging aan de navigatie.

## Starten

Node.js 22.12+ vereist; geen extra dependencies of API-sleutel. Voer uit vanuit `source/`:

```powershell
node scripts/scan-martin.mjs
node scripts/scan-martin.mjs --symbols NVDA,AMD,IONQ,RKLB,SOFI
node scripts/scan-martin.mjs --universe data/private/tickers.txt --top 30
```

De standaardlijst bevat 29 bestaande onderzoekstickers, zonder de context-ETF URA. Dit is geen beursbreed universum. Voor marktbrede ontdekking lever je zelf een actueel universum aan. `tickers.txt` bevat tickers gescheiden door komma's, spaties of nieuwe regels, zonder kopregel; gebruik Yahoo-symbolen zoals `BRK-B`, geen beursvoorvoegsels. Maximaal drie tickers worden tegelijk opgehaald. Dagdata komen uit dezelfde experimentele Yahoo-chartbron als de bestaande breakoutscan. Deze bron kan vertraging, blokkades of correcties hebben; er is geen gegarandeerde beschikbaarheid. Er wordt geen brokerverbinding gebruikt.

Open daarna `source/data/private/martin/watchlist.md`. Uitvoer:

| Bestand | Inhoud |
| --- | --- |
| `watchlist.md` | Leesbaar rapport met focus, drie scans, thema's, redenen en uitval |
| `watchlist.csv` | Alle beoordeelde aandelen met meetwaarden |
| `focus-tradingview.txt` | Kandidaten die ook trend, compactheid en stopcontrole doorstaan |
| `potent-tradingview.txt` | Sterkste laatste afgesloten handelsdag |
| `leaders-tradingview.txt` | Sterkste afgelopen 21 sessies |
| `premarket-tradingview.txt` | Actuele positieve gaps met voldoende premarketvolume |
| `scan.json` | Volledige diagnose, filters, peildata, bron en datadekking |
| `bars.json` | Gebruikte OHLCV en eventueel premarketsnapshot voor hercontrole |

Elke run vervangt de uitvoer in de gekozen map; gebruik `--out data/private/martin-archief` om apart te bewaren. De standaarduitvoer is privé en uitgesloten van Git. TradingView-import: kies de overeenkomstige txt-lijst via de importfunctie van je watchlist en controleer de beursmapping. Een lege focuslijst wordt bewust leeg geëxporteerd.

## Bronregels en gekozen benaderingen

| Onderdeel | Implementatie | Herkomst |
| --- | --- | --- |
| Potent | Positief dagrendement, aflopend; maximaal 20 | Scanner uit interview 91:30; aantal 20 is ontwerpkeuze |
| Leaders | Positief rendement over 21 sessies, aflopend | Interview 93:03; 21 sessies als maandbenadering |
| Premarket | Gap ≥ 3%, cumulatief volume ≥ 100.000 aandelen | Interview 90:38; getallen zijn instelbare ontwerpkeuzes |
| ADR | Gemiddelde `(high/low − 1) × 100` over 20 sessies > 5% | Interview 26:32; formule en periode zijn ontwerpkeuzes |
| Liquiditeit | Minimaal $10 miljoen gemiddelde `slot × volume` over 20 sessies | Instelbare ontwerpkeuze |
| Premier | Gemiddelde dollaromzet > $100 miljoen | Interview 100:03; periode 20 sessies is ontwerpkeuze |
| Trend | EMA9 > EMA21 > EMA50 en slot > EMA9 | EMA-volgorde uit 95:35; slotvoorwaarde is ontwerpkeuze |
| Compactheid | Inside day of breedte laatste 3 dagen ≤ 65% van breedte laatste 10 | Inside day uit 36:47; contractiemaat is ontwerpkeuze |
| Stopcontrole | Afstand tot referentiestop < min(5%, ADR/2) | Interview 26:00; daghigh/daglow als volgende-sessiereferentie |
| Thema's | Twee of meer kandidaten met hetzelfde aangeleverde themalabel | Interview 92:11; geen automatische classificatie |

**KLAARZETTEN** vereist ADR/liquiditeit, sterke trend, compactheid en passende stopreferentie. **VOLGEN** voldoet aan ADR/liquiditeit, maar mist nog een of meer focuscriteria. **AFGEWEZEN** faalt op ADR/liquiditeit. Focus bevat alleen namen uit minimaal een van de drie kandidatenlijsten; eerst premier, daarna maandrendement. Er is geen winstkansscore.

De trigger is laatste daghigh + $0,01 en de stopreferentie laatste daglow − $0,01. Dat is een plan voor de volgende sessie, geen actuele intradaytrigger, definitieve instap of simulatie van Martins vijfminutenstop. Een brede referentiestop kan later intraday alsnog een goede setup worden. EMA's zijn recursief met eerste beschikbare slot als beginwaarde; minimaal 60 candles, bij online ophalen tot een jaar historie.

Instelbare keuzes:

```powershell
node scripts/scan-martin.mjs --top 30 --adr-min 5 --min-volume 10000000 --gap-min 3 --premarket-volume 100000
node scripts/scan-martin.mjs --help
```

## Premarket en thema's

Tijdens 04:00–09:30 New York haalt de scanner automatisch vijfminutencandles inclusief extended hours op. Alleen afgesloten premarketcandles van vandaag tellen; volume wordt opgeteld en de laatste slotkoers vormt de snapshot. De snapshot moet maximaal 15 minuten oud zijn. Buiten dat venster ontstaat geen actueel premarketsignaal. Datadekking staat apart in het rapport; ontbrekende data gelden niet als nul matches op complete dekking. De vijfminutencandles zijn vertraagde brondata, geen live ticks. Er is geen controle of het volume uitzonderlijk is tegenover historische premarketsessies.

Optioneel: `--premarket data/private/premarket.json` overschrijft automatisch opgehaalde snapshots. Formaat (tijd alleen als voorbeeld; vervangen door actuele brondata):

```json
{"NVDA":{"asOf":"2026-10-16T12:55:00Z","price":180.25,"volume":1250000}}
```

`price` is de waargenomen USD-koers; `volume` is cumulatief aantal verhandelde aandelen sinds 04:00 ET, geen dollaromzet of dagvolume. De gap wordt berekend tegenover het laatste afgesloten dagslot. Ontbrekende, oude of toekomstige quotes vallen uit.

Voor themaclusters: `--themes data/private/themes.json`, bijvoorbeeld `{"IONQ":"Quantum","RGTI":"Quantum"}`. Lever classificaties zelf aan; de scanner leidt geen thema af uit een tickernaam. Clusters tonen aantallen kandidaten binnen dit universum en bewijzen geen geldinstroom of sectoroutperformance.

## Lokale databron en verificatie

Voor eigen dagelijkse OHLCV kun je `--input data/private/eigen-bars.json` gebruiken. Formaat:

```json
{"results":[{"symbol":"NVDA","source":"Eigen provider, reguliere sessie, USD-aandeel","bars":[{"date":"2026-10-15","open":100,"high":103,"low":99,"close":102,"volume":1000000}]}]}
```

Het voorbeeld toont één candle; minimaal 60 zijn nodig. Geef uitsluitend USD-aandelen met reguliere dagcandles en consistente corporate-actionbehandeling op. Lokale import controleert de instrumentsoort niet bij een provider. Volume nul wordt behouden; ontbrekende of ongeldige OHLCV en dubbele datums sluiten de volledige reeks uit zodat rendementvensters niet ongemerkt verschuiven. Een peildatum ouder dan vijf kalenderdagen valt uit. Een open dag wordt uitgesloten tot 16:15 New York; op dagen met vroege sluiting is dat bewust conservatief. De scanner heeft geen kalendercontrole voor ontbrekende sessies of beursfeestdagen. Vergelijk peildata vóór gebruik, vooral bij reeksen met ontbrekende handelsdagen.

```powershell
node --test tests/martin-selection.test.mjs
node scripts/scan-martin.mjs --input data/private/martin/bars.json --out data/private/martin-hercontrole
```

Handmatig blijven: earnings en nieuws, splits/corporate actions, weekbasis, relatieve sterkte tegenover indices, marktweerstand, spreads, intraday opening range en echte stop. Hiervoor ontbreken voldoende data in deze eerste versie. De scanner reproduceert een deel van het selectieproces, geen bewezen handelsrendement.

CLI-argumenten gebruiken de standaard [Node.js parseArgs-API](https://nodejs.org/api/util.html#utilparseargsconfig).
