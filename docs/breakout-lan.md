# Breakout 0.30.0 — starten en API-contract

De Nederlandse scanner gebruikt een gezamenlijke origin voor React en FastAPI. Er is geen permissieve CORS-configuratie. Productie bindt standaard aan `0.0.0.0:8000`; het startcommando print de gevonden lokale LAN-URL's. Gebruik uitsluitend het eigen LAN en configureer geen publieke portforwarding. De bestaande Nginx-server op 192.168.1.22 blijft een alternatief op poort 80.

## Linux-installatie en één startcommando

Voer alle commando's vanuit `source/` uit. Vereist Node 22.12+, 24 of 26+ en Python 3.12+ met venv/pip:

```bash
npm ci
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
cp .env.example .env
```

Pas `.env` aan voor de werkelijk ingestelde TWS/Gateway-poort. Het voorbeeld gebruikt paper TWS op 7497; zonder `.env` is paper Gateway op 4002 standaard. IBKR moet zelf draaien met API-toegang en read-only ingeschakeld. Er worden geen credentials gevraagd. `IBKR_READ_ONLY=false` wordt afgewezen. Bestaande opgeslagen brokerinstellingen hebben voorrang op initiële defaults.

Ontwikkeling, één commando:

```bash
npm run dev:lan
```

React/Vite bindt aan 0.0.0.0:5173 en proxyt de APIs naar localhost. Productie, één commando, inclusief build:

```bash
npm run serve:lan
```

FastAPI serveert de productiebuild en scanner-API op `APP_HOST`/`APP_PORT`. De bestaande portefeuille-API start op localhost:8787 en wordt via dezelfde origin doorgegeven. De launcher stopt de subprocessen bij afsluiten. Houd poorten 8787, 8788 en 5173 vrij voor ontwikkeling, 8787 en APP_PORT voor productie. Node- en Python-startfouten stoppen de gezamenlijke run.

Windows: installeer de venv met `py -3.12 -m venv backend/.venv` en `backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-lock.txt`; dezelfde npm-startcommando's werken daarna. `BREAKOUT_PYTHON_BIN` kan een ander expliciet Python-pad aanwijzen.

## Instellingen en herkomst

[`source/.env.example`](../source/.env.example) bevat niet-geheime IBKR_HOST, IBKR_PORT, IBKR_CLIENT_ID, IBKR_READ_ONLY, DATABASE_URL, APP_HOST, APP_PORT, DEFAULT_CURRENCY en DEFAULT_EXCHANGE. `DATABASE_URL` accepteert uitsluitend een lokale SQLite-URL; relatieve paden worden vanuit source opgelost. Pacing gebruikt BREAKOUT_REQUEST_INTERVAL, BREAKOUT_REQUEST_LIMIT en BREAKOUT_PACING_WINDOW. `.env` en private databases staan buiten Git.

De bestaande portefeuilleverbinding heeft een ander client-ID: launcherdefaults 77 op poort 4001, instelbaar met PORTFOLIO_IBKR_CLIENT_ID/PORTFOLIO_IBKR_PORT. Zo delen scanner en portefeuille geen client-ID. Brokerconcurrency blijft bewust **1** om cachewrites, annulering en IBKR-pacing voorspelbaar te houden; hogere waarden worden gevalideerd afgewezen. `PUT /api/settings` configureert pacing, filters, analyse en broker; pacing wordt na herstart hersteld.

Dagcandles worden opgeslagen en daarom altijd **Cached IBKR** genoemd, ook met een verbonden broker. De exacte laatste data-opslagtijd, berekentijd, peildatum en laatste volledig geslaagde sync zijn afzonderlijk zichtbaar. Een mislukte of gedeeltelijke sync vervangt de laatste succesvolle synctijd niet. De brokerstatus geeft de verbinding en aanvraag voor vertraagde data aan; dit is geen bewijs dat historische bars live of vertraagd geleverd zijn. Deze EOD-app claimt geen live ticks. Datumvelden zijn exchange/sessiondatums; opslag- en berekentimestamps zijn UTC ISO 8601. De interface gebruikt Nederlandse lokale tijd met het exacte UTC-timestamp erbij.

Optionele ontwikkeling met testdata:

```bash
npm run dev:demo
```

Dit start uitsluitend `tests.smoke_server`, met een tijdelijke database en een geïnjecteerde testbroker. Status en stockdetails dragen expliciet **DEMO — testdata, geen IBKR-data**. Productiestart weigert de demovlag. De productie-app kiest nooit automatisch demo bij verbindingverlies. Een CSV met TEST,NASDAQ,USD kan in deze ontwikkelomgeving worden gebruikt; de candles zijn fixtures en geen onderzoeksdata.

## Aanvullende endpoints

Alle eerdere routes blijven beschikbaar. Volledig OpenAPI: `/api/openapi.json`; Swagger: `/api/docs`. Mutaties vereisen toegestane Origin en `X-Requested-With: trading-monitor`.

| Route | Gebruik |
| --- | --- |
| PUT /api/settings | Gedeeltelijke bundel van broker, analysis, filters en pacing; lege/onbekende invoer afgewezen |
| POST /api/universe/import | Multipart `file` met CSV; optioneel `replace=true` |
| GET /api/universe | Actieve leden, conIds, metadata en fouten |
| POST /api/sync/start | JSON `{}` of retry_failed, force_refresh, config, universe, symbols |
| POST /api/sync/cancel | Annuleren, historie behouden |
| GET /api/sync/status | Voortgang, waarschuwingen, resultaten en sync-/datatijden |
| GET /api/leaders | Cross-sectionele topselectie en status-/liquiditeits-/metadatafilters |
| GET /api/stocks/{symbol} | Metingen, checklist, huidige status en versheid |
| GET /api/stocks/{symbol}/bars | OHLCV; optioneel start/end, limit 1–5000, exchange/currency |
| POST /api/analysis/recalculate | Alle actieve cached reeksen opnieuw analyseren, zonder IBKR-request |

Bij meerdere contracten van dezelfde ticker vereisen detailroutes exchange en currency; anders volgt HTTP 409. Fouten hebben `{detail, error: {code, message}}`; veldvalidatiefouten bevatten ook `error.fields`, zonder ingevoerde waarden of brokercredentials. Gebruikersmeldingen zijn Nederlands. De interface pollt betrouwbaar iedere vijf seconden, met expliciete netwerkfout en automatisch vervolg; verzoeken overlappen niet. Geen WebSocket vereist voor deze sequentiële dagelijkse synchronisatie.

Voorbeeldinstellingen:

```json
{
  "filters": {"minimumPrice": 10, "minimumAverageDollarVolume": 1000000},
  "pacing": {"intervalSeconds": 11, "maxRequests": 55, "windowSeconds": 600, "concurrency": 1}
}
```

Analyseconfig bevat returnperioden, gewichten, impulsen, consolidatieduur/-diepte, MA-regels, hogere-lows-tolerantie, contractie en breakoutdrempels; zie de [volledige drempeltabel](breakout-scanner.md#detectie-en-configuratie). Filterstandaarden kunnen ook in de UI worden bewaard.

## Data-integriteit en interface

De tabel toont rang, ticker/bedrijf, prijs/valuta, 1M/3M/6M, score, setup, impuls, basisduur, MA-steun, breakoutafstand en een kleine grafiek van werkelijke slotkoersen. Details bevatten candlesticks, MA10/20/50, een consolidatie-overlay, impulsmarkeringen, eerdere breakout-high, ATR/expansie, checklist en verklaring. Getoonde range en ATR sluiten de kandidaatbar uit. De optionele volumevoorwaarde blijft herkenbaar als bevestiging, geen verplichte drempel tenzij geconfigureerd.

Ontbrekende verwachte VS-sessies binnen het momentumvenster worden gemeld en het betreffende rendement/rang wordt ongeldig. Er wordt niet geïnterpoleerd. Kalenderdekking blijft NYSE 2026–2028; voor andere beurskalenders zijn aanvullende calendars nodig. De fixturetests zijn geen marktdata. Split-/dividendenbeleid, contractambiguïteit, nulvolume en cache-integriteitscontrole staan in [Python-architectuur](breakout-python.md).

## Optionele systemd-installatie

De servicefile wordt **niet automatisch geïnstalleerd**. Voor een bestaande checkout op `/home/gerard/TD` kan de beheerder na dependency-installatie zelf uitvoeren:

```bash
sudo cp deploy/systemd/trading-monitor-breakout.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now trading-monitor-breakout.service
```

Deze optionele service bindt alleen aan localhost:8788 achter de bestaande Nginx-poort 80. Daarna werkt `bash deploy/update-breakout.sh` voor volgende GitHub-updates; zonder vooraf geïnstalleerde service stopt dat updatescript vóór publiceren en verwijst het naar de handmatige installatie of `npm run serve:lan`. De twee hostingwijzen zijn alternatieven; draai ze niet gelijktijdig op dezelfde poorten.

## Gecontroleerde status

32 pytest-tests, zeven Vitest-tests, 94 bestaande Node-regressietests en de Playwright-smoketest slagen. Productiebuild en echte FastAPI/SQLite-workflow gecontroleerd. Het productiecommando is gestart op 0.0.0.0:8000; HTTP en browser op het lokale LAN-adres werken met de echte `app.main`, correcte Cached-labels en zonder demo. Live IBKR-data, toegang vanaf een tweede fysiek apparaat en plaatsing op 192.168.1.22 zijn nog niet bevestigd.
