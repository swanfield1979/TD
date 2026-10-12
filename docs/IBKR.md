# Interactive Brokers: read-only marktdata

De scanner gebruikt de gepinde [ib_async 2.1.0](https://pypi.org/project/ib_async/2.1.0/) uit het [onderhouden ib-api-reloaded-project](https://github.com/ib-api-reloaded/ib_async). De asyncio-interface past bij FastAPI en biedt contractkwalificatie en dagelijkse historie. De officiële callback-SDK zou extra thread-/callbackcoördinatie vereisen. Een `MarketDataBroker`-interface scheidt deze adapter van analyse en HTTP; tests en expliciete demo injecteren een fake adapter. Versie-upgrades vereisen opnieuw adaptertests, omdat requestannulering wrapperinternals gebruikt.

## TWS of IB Gateway installeren

Download de Linux-, Windows- of macOS-installatie via de [officiële IBKR-installatiehandleiding](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/?retakeFinal=1). Gebruik de passende installer voor het systeem waarop de broker draait. Op Linux: maak de gedownloade `.sh` uitvoerbaar met `chmod u+x ./bestand.sh` en start `./bestand.sh`. Voltooi de grafische installatie en meld handmatig aan bij **Paper Trading**. De scanner installeert geen broker, beheert geen wachtwoord/MFA en vraagt geen tradingrechten.

Open TWS Global Configuration → API → Settings, of Gateway Configure → Settings. Schakel socketclients in wanneer deze optie aanwezig is; sommige Gateway-versies hebben geen dergelijke checkbox. Laat **Read-Only API** ingeschakeld. Gebruik de werkelijk ingestelde socketpoort: doorgaans paper TWS 7497, paper Gateway 4002, live TWS 7496 en live Gateway 4001. Voor een broker op een andere LAN-host moet diens API het exacte scannerhost-IP vertrouwen. Broker en scanner op dezelfde host gebruiken localhost. Zie de [officiële configuratie-instructies](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/?retakeFinal=1).

Kopieer vanuit `source/` `.env.example` naar `.env` en stel host, poort en een uniek positief client-ID in. Het voorbeeld gebruikt TWS-paper 7497/client 17; zonder overrides gebruikt de scanner Gateway-paper 4002/client 109. Bestaande opgeslagen instellingen hebben voorrang op initiële defaults. `IBKR_READ_ONLY=false` wordt afgewezen. De bestaande portefeuillebackend gebruikt een afzonderlijk client-ID. Verbind daarna met **Verbinden** op de Breakout-pagina. Een gestarte TWS/Gateway en succesvolle login zijn noodzakelijk.

## Marktdata, cache en veiligheid

Historie gebruikt dagelijkse reguliere-sessie OHLCV, standaard `whatToShow=TRADES`; het [correctiebeleid](SETUP_LOGIC.md#datakwaliteit-en-toetsing) beschrijft splits en dividenden. Paper-toegang geeft niet automatisch alle marktdatarechten. Rechten hangen af van instrument, beurs en account. De adapter vraagt vertraagde data met `reqMarketDataType(3)` wanneer beschikbaar; dat bewijst geen recht op historische data.

De EOD-scanner bewaart historie en toont deze als **Cached IBKR**, ook bij een verbonden socket. Laatste datatimestamp, sessiedatum en laatste volledig geslaagde sync blijven afzonderlijk zichtbaar. Verbindingsstatus en verzoek om vertraagde data zijn geen claim van live candles. Deze versie heeft geen live-tickstream en claimt geen bevestigde delayed-historieherkomst. Demo verschijnt uitsluitend via `npm run dev:demo` als **DEMO — testdata, geen IBKR-data**. Productie schakelt nooit automatisch naar demo over.

CSV-import resolveert en cachet contract-ID's. Een eerste request haalt circa drie jaar op; volgende requests alleen ontbrekende dagen plus twee overlapdagen. Standaard concurrency is één, interval 11 seconden, maximaal 55 requests per 600 seconden en 15 seconden tussen identieke requests. Een groot universum kost daardoor tijd. Configuratie omvat pacing, maximaal drie pogingen en exponentiële backoff vanaf twee seconden, begrensd op dertig seconden. Verbindingsverlies activeert reconnect; bewuste disconnect, annulering en shutdown stoppen actieve requests. Per-symbolfouten kunnen apart worden herhaald; bestaande geldige cache blijft behouden.

Er bestaan geen orderroutes of orderplaatsingsfuncties in de scanner. De adapter start read-only zonder orderdownloads. De UI toont **Read-only — geen orderuitvoering**. Inloggegevens en ruwe accountsessie-informatie komen niet in frontend-JavaScript. Beperk toegang tot het eigen LAN; deze lokale toepassing heeft geen internet-authenticatielaag.

## Veelvoorkomende fouten

| Code/symptoom | Controle |
| --- | --- |
| 502 / connection refused | Broker gestart en ingelogd? Host, socketpoort, API en firewall controleren |
| 504 / niet verbonden | Verbinding herstellen voordat historie wordt aangevraagd |
| 326 | Client-ID al bezet; kies een ander ID |
| 200 | Contract ongeldig of ambigu; beurs/valuta/ticker corrigeren |
| 354 | Benodigde marktdatarechten ontbreken |
| 162 | Historiefout; melding onderscheidt onder meer subscriptions, pacing en ontbrekende historie |
| 1100 | IBKR-serververbinding verloren; herstel afwachten |
| 1101 / 1102 | Verbinding hersteld; cached historie en syncstatus controleren |
| 2104 / 2106 / 2107 | Farmstatus/inactiviteit is niet automatisch een aanvraagfout |

De codes komen uit de [officiële IBKR-codeverklaring](https://interactivebrokers.github.io/tws-api/message_codes.html). Zie ook [API-verbinding verifiëren](https://www.interactivebrokers.com/docs/tws-api/doc/connectivity/verify-api-connection). IBKR kan foutmeldingen wijzigen; de adapter vertaalt bekende oorzaken naar Nederlandse meldingen en begrenst retries. Een echte TWS/Gateway-verbinding kon in de ontwikkelomgeving niet worden bevestigd.
