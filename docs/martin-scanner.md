# Martin-selectiescanner

Trading Monitor **0.31.8**, 16 oktober 2026. De scanner gebruikt standaard een breed universum van Amerikaanse beursnoteringen en stelt automatisch Potent, Leaders, Premarket en Focus samen. Gebaseerd op het aangeleverde interview met Martin Luke. Geen orderuitvoering.

## Bediening

Open **Martin-scan** (`/#martin`), laat **Universum** op **Amerikaanse beurzen · automatisch** staan en kies **Scan starten**. Geen tickers, IBKR-login of Flex-import nodig. Bij een nieuwe ronde worden beide officiële beurslijsten opgehaald. Bij bronuitval volgt een foutmelding; er is geen terugval naar de oude lijst van 29 aandelen.

De eerste scan kan geruime tijd duren. Maximaal drie downloads tegelijk, minimaal 0,5 seconde tussen netwerkblokken. De voortgang toont universum, dagdata en premarket. De scan loopt op de server door bij navigatie. Dubbele starts gebruiken de lopende job.

**Scan stoppen** bewaart voortgang en voorlopige watchlists. **Scan hervatten** vervolgt de ronde binnen dezelfde New York-datum en slotperiode, ook na serverherstart. Bij HTTP 403/429/5xx stopt de scanner met aanvragen; wacht en hervat later. Niet-verwerkte namen blijven openstaan. Na een nieuwe beursdatum of overgang naar afgesloten dagdata (16:15 ET) moet een nieuwe ronde starten. **Scan starten** begint opnieuw met hergebruik van geldige koerscache.

Tijdens dagverwerking wordt ten minste iedere 25 namen en bij stoppen een checkpoint geschreven. Na een harde crash kunnen de namen sinds het laatste checkpoint opnieuw worden beoordeeld; hun koerscache blijft bruikbaar. Geen automatische hervatting na serverherstart.

**Eigen tickerlijst** blijft optioneel voor maximaal 200 namen. De brede modus heeft die limiet niet. Oude opgeslagen shortlists worden bij de upgrade niet opnieuw als standaard ingesteld; eerdere resultaten blijven herkenbaar als oude eigen lijst.

## Universum en herkomst

De scanner combineert en ontdubbelt de officiële [Nasdaq-listed](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt) en [Other-exchange listed](https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt) lijsten. De tweede bevat onder meer NYSE en NYSE American. Zie de [officiële velddefinities](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs).

Kopregels en footer zijn verplicht. De parser gebruikt Test Issue, ETF, NextShares en Security Name: gewone aandelen, ordinary shares en ADR/ADS blijven over; ETF’s, testnoteringen, warrants, rechten, units en herkenbare preferente effecten vallen uit. Class shares worden vertaald naar Yahoo, bijvoorbeeld `BRK.B` naar `BRK-B`. De koersprovider controleert daarna USD en instrumenttype EQUITY.

Op 16 oktober 2026 leverden de lijsten **5.613** unieke namen: 3.321 Nasdaq en 2.292 overige. Aantallen veranderen met de bron. Het betreft Amerikaanse **beursnoteringen**, ook buitenlandse ondernemingen/ADR’s, geen uitsluitend Amerikaanse vestigingslanden en geen OTC-universum. Tekstfilters kunnen ongewone effectnamen missen; dit is geen garantie op iedere aandelenklasse.

Rapporten tonen universumnaam, ophaaltijd, bronlinks en aantallen. JSON bewaart ook beurscodes, originele symbolen, bedrijfsnamen en file-creation-timestamps. Dekking vergelijkt succesvol beoordeelde reeksen met alle namen in de ronde. Onvoldoende/ongeldige historie telt als data-uitval. Onvoltooide rondes worden als voorlopig gemarkeerd.

## Selectie en watchlists

| Onderdeel | Regel | Herkomst |
| --- | --- | --- |
| Potent | Positieve dagslotprestatie, aflopend; beste 20 ADR/liquiditeitskandidaten | Interview 91:30; aantal 20 is ontwerpkeuze |
| Leaders | Positief rendement over 21 sessies, aflopend; beste 20 kandidaten | Interview 93:03; maandbenadering |
| Premarket | Gap ≥ 3%, cumulatief volume ≥ 100.000 aandelen | Interview 90:38; getallen zijn ontwerpkeuzes |
| ADR | Gemiddelde `(high/low − 1) × 100` over 20 sessies > 5% | Interview 26:32; formule/periode zijn ontwerpkeuzes |
| Liquiditeit | Gemiddelde `slot × volume` over 20 sessies ≥ $10 miljoen | Ontwerpkeuze |
| Premier | Gemiddelde dollaromzet > $100 miljoen | Interview 100:03; periode is ontwerpkeuze |
| Trend | EMA9 > EMA21 > EMA50 en slot boven EMA9 | Interview 95:35; slotvoorwaarde is ontwerpkeuze |
| Compactheid | Inside day of laatste 3 dagen range ≤ 65% van laatste 10 dagen range | Interview 36:47; contractiemaat is ontwerpkeuze |
| Stopcontrole | Afstand tot referentiestop < min(5%, ADR/2) | Interview 26:00 |

**Focus** vereist een plek in minimaal één kandidatenlijst plus trend, compactheid en stopcontrole; eerst premier, dan maandrendement. **KLAARZETTEN** is een kandidaat voor beoordeling, **VOLGEN** mist focuscriteria, **AFGEWEZEN** faalt op ADR/liquiditeit. Geen winstkansscore. Trigger = laatste daghigh + $0,01, stopreferentie = laatste daglow − $0,01: volgende-sessiereferenties, geen actuele intradayorder.

Kies Focus, Potent, Leaders, Premarket of Alle aandelen. Zoek op ticker en sorteer ADR, dag- of maandrendement via kolomknoppen. Grote lijsten hebben pagina’s van 50 rijen. CSV/TradingView-downloads bevatten de volledige gefilterde lijst, over alle pagina’s.

## Data en cache

Yahoo-chartdata zijn experimenteel, zonder beschikbaarheidsgarantie. Per aandeel worden gevalideerde dagdata privé gecachet. Cache is geldig binnen dezelfde New York-datum en vóór/na-slotperiode. Na 16:15 ET of op een nieuwe datum worden nieuwe dagreeksen opgehaald. Cachedata worden opnieuw gevalideerd; corrupte cache wordt opnieuw gedownload.

Een open dag telt niet mee tot 16:15 ET, ook op vroege sluitingsdagen. Minimaal 60 candles nodig. Ontbrekende/ongeldige OHLCV of dubbele datums sluiten de hele reeks uit; nulvolume blijft behouden. Reeksen ouder dan vijf kalenderdagen vallen uit. Geen volledige beurskalendercontrole op ontbrekende sessies. EMA’s starten bij het eerste beschikbare slot; online maximaal een jaar historie.

Na de dagselectie worden alleen ADR/liquiditeitskandidaten op premarket gecontroleerd, tussen 04:00–09:30 ET. Alleen afgesloten vijfminutencandles vanaf 04:00 vandaag tellen. Volume wordt opgeteld; de laatste slotkoers vormt de snapshot. Quotes ouder dan 15 minuten of buiten het venster worden bij het eindrapport uitgesloten. Een ronde die pas na 09:30 ET klaar is heeft dus geen actuele premarketmatches; een volgende ronde met warme dagcache kan veel sneller zijn. Dekking wordt apart vermeld. Geen vergelijking met historisch premarketvolume.

Rapporten behouden hun scanmoment; na 24 uur verschijnt een ouderdomsmelding. Een mislukte run zonder bruikbare data behoudt het vorige rapport. Sectoren/thema’s worden niet geraden: alleen optioneel aangeleverde metadata geeft clusters. Earnings, nieuws, splits, weekbasis, marktcontext, spreads en de werkelijke intradayinstap/-stop blijven handmatige controles. Geen bewezen handelsrendement geclaimd.

## CLI en eigen data

Node.js 22.12+; geen extra dependencies of API-sleutel. Vanuit `source/`:

```powershell
node scripts/scan-martin.mjs
node scripts/scan-martin.mjs --resume
node scripts/scan-martin.mjs --symbols NVDA,AMD,IONQ
node scripts/scan-martin.mjs --universe data/private/tickers.txt --top 30
node scripts/scan-martin.mjs --help
```

Ctrl+C stopt met checkpoint en voorlopig rapport. Gebruik een eigen `--out`-map om gelijktijdig schrijven door CLI en web te vermijden. Een tickerbestand bevat komma’s/spaties/nieuwe regels zonder kopregel. Instelbaar: `--top`, `--adr-min`, `--min-volume` (dollars), `--gap-min`, `--premarket-volume` (aandelen). Hervatten vereist dezelfde configuratie en eigen lijst.

`--themes data/private/themes.json`: bijvoorbeeld `{"IONQ":"Quantum","RGTI":"Quantum"}`. Twee of meer kandidaten met hetzelfde label vormen een cluster, geen bewijs van geldinstroom. `--premarket data/private/quotes.json` overschrijft automatische snapshots: `{"IONQ":{"asOf":"2026-10-16T12:55:00Z","price":40,"volume":1250000}}`. Gebruik actuele tijden; volume is cumulatief sinds 04:00 ET.

`--input data/private/eigen-bars.json` accepteert lokale dagelijkse OHLCV met minimaal 60 candles per ticker. Formaat (één voorbeeldcandle, geen volledige reeks):

```json
{"results":[{"symbol":"NVDA","source":"Eigen provider, USD, reguliere sessie","bars":[{"date":"2026-10-15","open":100,"high":103,"low":99,"close":102,"volume":1000000}]}]}
```

Bij lokale input controleert de scanner instrumentsoort/valuta niet bij een provider.

## Opslag

CLI standaard: `source/data/private/martin/`. Web: `martin/` naast `IBKR_SNAPSHOT_PATH`, optioneel `MARTIN_SCAN_DIR`, buiten de webroot en Git. UI-status en ronde worden via tijdelijke bestanden en atomische rename geschreven. Corrupte UI-status wordt gemeld en niet overschreven. Ongebruikte cachebestanden worden niet automatisch verwijderd.

| Bestand | Inhoud |
| --- | --- |
| `watchlist.md`, `scan.json` | Rapport, diagnose en herkomst |
| `watchlist.csv` | Alle beoordeelde aandelen |
| `focus-tradingview.txt`, `potent-tradingview.txt`, `leaders-tradingview.txt`, `premarket-tradingview.txt` | Vier tickerlijsten |
| `daily-cache/<ticker>.json` | Dagdata en cacheperiode |
| `market-round.json` | Bevroren universum, resultaten, hervatvoortgang |
| `ui-state.json` | Laatste webstatus en rapport |
| `bars.json` | Online: cachemanifest; lokale input: gebruikte reeksen |

Vanaf 0.31.8 bevat online `bars.json` geen bulk-OHLCV meer; gebruik de per-aandeelcache voor hercontrole. Afzonderlijk bewaarde oude bulkbestanden blijven bestaan.

<a id="serverupdate"></a>

## Serverupdate en verificatie

Op de bestaande Linux-server vanuit de repository-root:

```bash
git pull --ff-only
cd source
bash deploy/update-options.sh
```

Publiceer frontend en Node-API samen; het script herstart ook de aanwezige Python-service voor de LAN-proxy. Open `/#martin` en vernieuw met Ctrl+F5. Bij `npm run serve:lan`: stop, pull, `npm ci`, opnieuw starten. Lokale tests publiceren niets op de bestaande server.

API: `GET /api/martin-scan`; POST met `{"universeMode":"us"}` voor breed of `{"universeMode":"custom","symbols":"NVDA,AMD"}` voor eigen tickers. Voeg `"resume":true` toe voor hervatten. `POST /api/martin-scan/stop` stopt. Mutaties vereisen de toegestane Origin en `X-Requested-With: trading-monitor`. Geen browserbestandspaden. Vite, Nginx en FastAPI sturen de route naar Node op 8787.

Vanuit `source/`: `npm test`, `npm run test:frontend`, `npm run build`. Browserfixtures: start `npm run dev -- --port 5198`, daarna `npm run test:martin`. Zo nodig tijdelijk `npm install --no-save --package-lock=false playwright`; Edge is standaard. Screenshots: `data/private/martin-ui-validation/`. Marktenginetests controleren 1.001 fictieve aandelen buiten de oude shortlist, stoppen/hervatten, cache, bronbegrenzing en data-uitval; geen bewijs van handelsedge.
