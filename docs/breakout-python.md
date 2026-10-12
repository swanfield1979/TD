# Python-scanner 0.29.0

Breakout gebruikt Python 3.12+, FastAPI, Pydantic-settings, SQLAlchemy en SQLite, naast de bestaande Node-portefeuillebackend. Alle broncode en afhankelijkheden staan onder `source/`. Dit is uitsluitend marktdata-analyse: **Read-only — geen orderuitvoering**. De scanner bevat geen orderroutes, orderobjecten of automatische simulatie van transacties.

## Modules en opslag

| Onderdeel onder source | Verantwoordelijkheid |
| --- | --- |
| backend/app/api | HTTP-routes, validatie en OpenAPI |
| backend/app/broker | Read-only IBKR-adapter, pacing, retries en annulering |
| backend/app/core | Pydantic-milieuinstellingen en NYSE-kalender |
| backend/app/schemas | Gevalideerde analyseconfiguratie, candles en syncaanvragen |
| backend/app/models en db | SQLAlchemy-tabellen en transactionele SQLite-opslag |
| backend/app/services | CSV-universum, incrementele synchronisatie en voortgang |
| backend/app/analysis | Zuivere momentum-, percentiel- en setupberekeningen |
| src/pages, components, api, types en utils | React/TypeScript-interface en Lightweight Charts |

SQLite bewaart universumleden, symbol/exchange/currency, bedrijfsnaam, optionele sector, contract-ID en contractmetadata, OHLCV, symbolfouten, instellingen en laatste resultaten. Bars zijn uniek per instrument, `whatToShow` en handelsdatum. WAL en transacties voorkomen gedeeltelijke writes. Universum vervangen deactiveert oude leden; het verwijdert hun historie niet. De standaard lokale database is `source/data/private/breakout.sqlite`; productie gebruikt `/var/lib/trading-monitor/breakout.sqlite`, buiten Git. Instellingen en cached candles blijven na herstart beschikbaar.

## IBKR-keuze en verbinding

De gekozen adapter is [ib_async 2.1.0](https://pypi.org/project/ib_async/2.1.0/), exact gepind. Het [onderhouden project](https://github.com/ib-api-reloaded/ib_async) heeft een asyncio-interface die aansluit op FastAPI, contractkwalificatie en historische requests. Dit vereenvoudigt de integratie ten opzichte van de officiële callback-/thread-SDK. De directe requestlevenscyclus in onze adapter voegt expliciete annulering en opruiming toe. Omdat hiervoor wrappermethoden worden gebruikt, moet een versie-upgrade de adaptertests opnieuw doorlopen. `requirements-lock.txt` pint ook transitieve dependencies; `requirements.txt` benoemt directe dependencies.

Standaard: Paper IB Gateway, localhost, poort 4002, client-ID 109. TWS-paper gebruikt doorgaans 7497; live Gateway 4001 en live TWS 7496. De interface past de gebruikelijke poort aan bij omgevingskeuze; controleer de werkelijk ingestelde API-poort in TWS/Gateway. Verbind met `readonly=True`, zonder order-/uitvoeringsdownloads bij startup. Activeer tevens de read-only API-instelling in TWS/Gateway. Geen wachtwoord of IBKR-sessie wordt naar de frontend gestuurd. Host/poort/client-ID zijn configuratie, geen inloggegevens. Accountgegevens en ruwe brokerfouten verschijnen niet in scannerresponses.

Bij verbindingverlies probeert de adapter opnieuw. Requests hebben standaard maximaal drie pogingen, exponentiële wachttijd vanaf twee seconden, begrensd op dertig seconden. Permanente contract-/subscriptiefouten worden niet eindeloos herhaald. Bewust loskoppelen stopt synchronisatie, actieve historieaanvragen en de socket. Shutdown annuleert achtergrondtaken en sluit database en verbinding.

`reqMarketDataType(3)` vraagt vertraagde data aan indien beschikbaar. Dit garandeert **geen** historische marktdatarechten. Ontbrekende subscriptions krijgen een gerichte Nederlandse melding. De scanner toont uitsluitend werkelijk ontvangen historie en vult fouten nooit met demonstratiekoersen aan.

## Incrementele synchronisatie

1. Importeer UTF-8 CSV met `symbol,exchange,currency` en optioneel `company`/`company_name` en `sector`. Maximaal 1 MB en 5000 regels. [Voorbeeld](../source/data/example-universe.csv) bevat slechts vijf voorbeeldleden.
2. Resolve het aandelencontract één keer en bewaar conId en metadata.
3. Haal bij een leeg instrument circa drie jaar dagelijkse RTH-historie op.
4. Vraag daarna alleen het kalendergat plus twee overlapdagen op. Als de cache de laatste afgesloten sessie bevat, wordt geen historieaanvraag verzonden.
5. Verwerk requests sequentieel. Standaard minimaal 11 seconden tussen requests, maximaal 55 per 600 seconden en minimaal 15 seconden tussen identieke historieaanvragen. Dit is bewust conservatiever dan nodig voor sommige 1D-requests; IBKR kan ook eigen throttling toepassen. Een eerste universumscan kan uren duren. Andere IBKR-clients delen mogelijk brokerlimieten: beperk hun gelijktijdige belasting.
6. Valideer het volledige antwoord vóór opslaan. Bij een fout blijven alle bestaande geldige bars behouden. Voortgang en fouten staan per symbool in de API/UI; **Fouten opnieuw** herhaalt alleen mislukte instrumenten.

Pacing-/retrywaarden staan in `core/settings.py` en zijn met `BREAKOUT_`-variabelen instelbaar. Verbindingsinstellingen en de volledige detectieconfiguratie staan in `/api/settings`; wijzigingen worden in SQLite opgeslagen. Alle setupdrempels staan centraal in `AnalysisConfig`, gedocumenteerd in de [scannerhandleiding](breakout-scanner.md#detectie-en-configuratie).

## Splits, dividenden en peildatum

Default `whatToShow=TRADES`, 1 day, `useRTH=True`. [IBKR beschrijft](https://www.interactivebrokers.com/campus/contributors/retrieving-historical-data-from-ibkr/) TRADES als splitgecorrigeerd, zonder dividendcorrectie; ADJUSTED_LAST corrigeert splits én dividenden. ADJUSTED_LAST kan worden gekozen. Resultaten zijn dus prijsrendement of een brokergecorrigeerde reeks, afhankelijk van deze instelling; geen eigen total-returnberekening. Wij bewaren beide soorten apart en voegen ze nooit samen. Er wordt geen extra split-/dividendfactor op IBKR-koersen toegepast.

Bij een correctie groter dan 5% op een overlap-slotkoers of een nieuwe koerssprong groter dan 45% wordt corporate-actioncontrole gemarkeerd. Zo'n instrument wordt uitgesloten van leidersrangschikking. Dit zijn integriteitsheuristieken, geen volledige corporate-actionfeed; ook kleinere of niet-overlappende correcties kunnen bestaan. **Volledige hercontrole** haalt opnieuw drie jaar op, vervangt uitsluitend na geldige ontvangst de betreffende reeks en wist de reviewmarkering. Een afgekapt antwoord dat onvoldoende momentumhistorie vervangt wordt afgewezen; de cache blijft bestaan. Controleer bij relevante corporate actions de volledige historie voordat rendementen worden gebruikt.

De huidige New York-datum wordt conservatief uitgesloten, ook na de sluiting. Laatste voltooide sessie is de voorgaande werkdag, met de meegeleverde NYSE-feestdagen voor 2026–2028. Voor andere beurskalenders of latere jaren moet deze kalender worden uitgebreid; een buitenlands instrument kan daardoor als verouderd worden gemeld. Geen intraday breakoutclaim. Bars tellen als werkelijke sessies; ontbrekende bars worden niet synthetisch aangevuld.

## Rangschikking en filters

21/63/126-sessierendementen worden cross-sectioneel gerangschikt binnen het actieve aangeleverde universum. Gewichten 40/35/25% zijn instelbaar. Percentielen lopen van 0 tot 100; gelijk rendement krijgt een vaste ticker-volgorde. Top 1/2/5% gebruikt `ceil(N × percentage / 100)` per gekozen periode, vóór status-/prijs-/liquiditeitsfilters. Een instrument kan een kort momentumvenster hebben maar onvoldoende volledige setuphistorie; de status meldt dit expliciet. Score vereist alle drie rendementen. Verouderde of corporate-actionverdachte reeksen tellen niet als leiders mee; **Volledig universum** houdt deze diagnostiek zichtbaar.

Minimumprijs is in de eigen valuta. Gemiddeld dollarvolume is het gemiddelde van slot × volume over twintig candles, uitsluitend voor USD-instrumenten; zonder volume of bij andere valuta is dit onbekend. Er wordt geen fictieve FX-conversie gebruikt. Sectorfilters werken alleen als metadata is aangeleverd. Resultaten hangen af van het universum en de daadwerkelijk beschikbare data. Huidige S&P-leden leveren geen survivorship-vrije historische backtest.

## JSON-API

Swagger staat op `/api/docs`, OpenAPI op `/api/openapi.json`. Nginx routeert deze scanner-API naar localhost:8788; bestaande portefeuille/CSP-routes blijven op 8787.

| Methode en pad | Resultaat |
| --- | --- |
| GET /api/health | Proces/database, versie en readOnly |
| GET /api/broker/status | Verbindingsstatus en geschoonde foutmelding |
| POST /api/broker/connect | Asynchroon verbinding opbouwen, HTTP 202 |
| POST /api/broker/disconnect | Sync en requests annuleren, verbinding sluiten |
| GET /api/settings | Broker-, analyse- en pacinginstellingen |
| PUT /api/settings/broker | Verbinding configureren; daarna opnieuw verbinden |
| PUT /api/settings/analysis | Detectieconfig opslaan en cache herberekenen |
| GET /api/universe | Metadata, conIds en fouten per instrument |
| POST /api/universe/upload?replace=false | Multipart `file`: universum-CSV |
| GET /api/breakout | Scanstatus, voortgang, peildatum en resultaten |
| POST /api/sync of /api/breakout | JSON `{}`; optioneel config, retry_failed, force_refresh, universe, symbols |
| POST /api/sync/cancel of /api/breakout/cancel | Annuleren met behoud van cache |
| GET /api/leaders | top=1/2/5, period=0/1/2, status, min_price, min_dollar_volume, exchange, sector |

Muterende requests vereisen een toegestane `Origin` en `X-Requested-With: trading-monitor`. De toepassing is voor de bestaande interne LAN-server, zonder publieke hostingclaim. De API bindt aan localhost. Zie [installatie](breakout-scanner.md#installatie-via-github) en [ontwikkelcommando's](../source/backend/README.md).

## Validatie

24 pytest-tests, zeven Vitest-tests en 94 bestaande Node-regressietests slagen. De Playwright-smoketest volgt echte React → HTTP → FastAPI → SQLite → Python-analyse, met een expliciet geïnjecteerde testbroker. De test weigert een productiebackend zonder testheader. Desktop en mobiel, CSV-upload/export, configvalidatie, scan, setupdetails, chart en filters zijn gecontroleerd. Fixtures zijn uitsluitend testdata; `app.main` bevat geen productie-demomodus. TypeScript/Vite-build slaagt. Live TWS/Gateway-marktdata en plaatsing op 192.168.1.22 zijn nog niet bevestigd.
