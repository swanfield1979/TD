# Ontwikkeling

Put-spreaduitbreiding (30 oktober 2026): IV Percentile, historische dag-IV zonder generieke IV-quote, hergebruik in stap 3 en Percentile in tabel/sortering/CSV. Vanuit deze map: `node --test tests/put-spread-percentile.test.mjs`, `npm test`, `npm run test:frontend`, `npm run build`. Browser met Vite op 5197: `npm run test:spreads`. Lokale uitbreiding op 0.42.5; nog niet op de server geïnstalleerd. Zie [handleiding](../docs/put-spreads.md).

Options 0.42.5: putspreads en SYNT krijgen één uitklapbare hoofdregel met netto waarden en ISO-openingsweek. Start Vite op 5197 en voer `node scripts/verify-option-groups-browser.mjs` uit. Berekeningen en splitsing van ongelijke aantallen: `npm run test:frontend`. Zie [optiecombinaties](../docs/optiecombinaties.md).

Stats (vanaf 0.42.4, meegeleverd in 0.42.5): `npm run test:frontend` controleert onder meer de nieuwe resultaatberekeningen. Start Vite op 5197 en voer `node scripts/verify-stats-browser.mjs` uit voor sorteren, zoeken, jaarfilters, lege historie en beide thema's op 375/768/1440 pixels. Zie [Stats en berekeningsregels](../docs/stats.md).

Lokale financiële ontwerpupdate (28 oktober 2026): gedeelde vormgeving in `src/financial-theme.css`, exacte maandtabellen bij de dashboardgrafieken en semantische kleur voor negatief vrij besteedbaar geld. Vanuit deze map: `npm run dev -- --host 127.0.0.1 --port 5197`, vervolgens in een tweede terminal `node scripts/verify-financial-browser.mjs`. Algemene controles: `npm run build`, `npm run test:frontend` en `npm run test:layout`. Zie [ontwerp en validatie](../docs/financieel-ontwerp.md). Uitgebracht als 0.42.3 voor herkenning door Updates; serverinstallatie nog niet uitgevoerd.

Actuele broncodeversie: **0.42.5**, inclusief uitklapbare optiecombinaties, openingsweek en Stats-uitbreiding; serverinstallatie nog niet uitgevoerd. De app is op brede schermen gecentreerd en maximaal 1760 pixels breed, inclusief navigatie. Kleinere schermen gebruiken de beschikbare breedte; grafieken en kaarten rekken niet meer onbeperkt mee. Controle vanuit `source/`: start Vite op 5197 en voer `npm run test:layout` uit. Kruisje vóór het vergrootglas, grotere uitklappijl met klikvlak van 44 × 44 pixels en quotegegevens in een vergelijkingstabel voor verkoopput en koopput. Yahoo-optiechains als snelle voorselectie met aansluitende IBKR-controle; bronkeuze in Option Scan en zelfstandige CLI-scraper. 223 Node-tests, 13 frontendtests en build geslaagd. Live Yahoo-proef kreeg HTTP 429; serverinstallatie nog niet uitgevoerd. Zelfstandig ophalen: `npm run scrape:yahoo -- AAPL 40 100`. Zie [Yahoo-optiechains](../docs/yahoo-optiechains.md). Nieuwe pagina Updates met versiecontrole, installatieknop en zichtbare voortgang. De aparte updateservice test en bouwt vóór publicatie en blijft actief tijdens een API-herstart. Eenmalige serverinstallatie nog nodig. Zie [updatehandleiding](../docs/app-updates.md). Browsercontrole: `npm run test:updates` (Vite op 5197). Versie 0.40.0 voegt compacte optiechainresultaten, Jaar-R/R en extra sorteringen toe. De scanner verwerkt maximaal vier quotes tegelijk met behoud van pacing en filtert ongeschikte benen vóór het combineren. Zie [onderbouwing](../docs/vergelijking-optiechain.md). Option Scan groepeert spreads per aandeel: één kandidaat op basis van de gekozen sorteermaat, met vergrootglas voor uitsluitend de overige alternatieven en een rode X naast de ticker. Het updatescript vereist nu 0.42.5; de tabelkop toont de actieve frontendversie. Overzicht en detail hebben paginering; CSV bevat alle gevonden spreads binnen het zoekfilter of alleen het geopende aandeel. De volledige panelen van stap 1 en 2 zijn onafhankelijk inklapbaar via de knoppen in de kop; de browser onthoudt de keuze en stap 3 blijft toegankelijk. Bevestigde ontbrekende koers-/IV-data blokkeren het aandeel automatisch; reden en stap staan in de persistente blokkeerlijst. Oudere foutmeldingen worden bij API-start verwerkt, met behoud van expliciete deblokkeringen. Scanresultaten linken de tickers naar TradingView-layout `fxY1us9e` met `target=_blank`. Sectoren staan in de drie Put-spreadsoverzichten en CSV. De private cache `stock-sectors.json` wordt zeven dagen hergebruikt; bronuitval verandert geen scancriteria. Stock Filter-resultaten zijn inklapbaar via **Geselecteerde aandelen (aantal)**; de browser onthoudt de keuze. Put spreads combineert **1. Stock Filter**, **2. IV Scan** en **3. Option Scan**. Resultaten, voortgang, blokkeerlijst en weekplanning worden in de privédatamap opgeslagen. Zondag Stock Filter om standaard 09:00 Nederlandse tijd (aanpasbaar), maandag IV vanaf 09:30 New York of de eerstvolgende open beursdag. De Node-API moet blijven draaien; een geopende browser is niet nodig. Option Scan blijft handmatig. Zie [handleiding](../docs/put-spreads.md#drie-stappen-vanaf-0360).

Verificatie vanuit deze map: `npm test`, `npm run test:frontend`, `npm run build`; start Vite op 5197 en gebruik `npm run test:spreads`. Leaps-regressie: `RESEARCH_URL=http://127.0.0.1:5197 npm run test:research` (PowerShell: `$env:RESEARCH_URL='http://127.0.0.1:5197'; npm run test:research`). Tests met een langlevende API kunnen de scheduler uitschakelen met `PUT_SPREAD_SCHEDULE_DISABLED=1`; productie gebruikt de instellingen onder **Weekplanning**.

### Historisch: 0.35.0

Versie 0.35.0 (historisch). Put spreads: eerst **Aandelenfilter starten** (koersgrenzen en dagvolume ≥ 5.000.000 aandelen), daarna expliciet **Optiescan starten**. Yahoo-dagdata worden parallel opgehaald en hergebruikt; IBKR levert ontbrekende dagdata en de latere opties. Selectie en voortgang staan in de privédatamap. Verificatie vanuit deze map: `npm test`, `npm run test:frontend`, `npm run build`; browser: Vite op 5197 en `npm run test:spreads`. Zie [tweedelige scan](../docs/put-spreads.md#historisch-twee-stappen-in-0350).

### Eerdere scanneruitbreidingen (t/m 0.34.1)

Versie 0.34.1 (historisch). Put spreads toont alleen voortgang en passende resultaten; technische uitleg en afgewezen aandelen staan niet meer op de scanpagina. Optievolumevoorfilter (tick 87), laatst ontvangen dagvolume (ticks 29+30), aparte private volumecache en expliciete onbekend-/nulbehandeling. De nieuwe standaardwaarden gelden bij nieuwe voorkeuren of **Criteria herstellen**; eigen opgeslagen waarden blijven bewaard. IV-correctie: één hergebruikte verbinding, persistente daghistorie als fallback, wachtrijpauzes en hervatbare beveiliging na vijf IV-fouten. Put spreads scant standaard het brede Amerikaanse aandelenuniversum met voorselectie op koers/IV, oude chains bij gesloten markt en stoppen/hervatten. **Put spreads** (`#put-spreads`) voegt een lokale bull-put-spreadscanner toe met instelbare criteria, quote-details, CSV en serveropslag. Zie [handleiding](../docs/put-spreads.md). Browsercontrole vanuit deze map: start `npm run dev -- --host 127.0.0.1 --port 5197` en voer `npm run test:spreads` uit. Menu **Martin-scan** (`#martin`) scant standaard automatisch Nasdaq en overige Amerikaanse beursnoteringen. Ondersteunt koerscache, stoppen/hervatten, watchlists en exports; eigen tickers zijn optioneel. Zie [Martin-scan en installatie](../docs/martin-scanner.md). Vanuit deze map: `npm ci`, `npm test`, `npm run test:frontend`, `npm run build`; lokaal `npm run dev:lan` of `npm run serve:lan`. Browsercontrole: start Vite op 5198 (`npm run dev -- --port 5198`) en voer `npm run test:martin` uit.

De webapp staat volledig in deze map. Voer alle ontwikkel- en bouwcommando's vanuit `source/` uit.

Mobiele correctie (14 oktober 2026, nog niet gepubliceerd): de IBKR-bediening staat t/m 700 pixels onder de paginatitel en daarboven in de zijbalk. Verificatie: `npm test`, `npm run test:frontend`, `npm run build` en browsercontrole op 320–1440 pixels; zie [validatie](../docs/validatie.md).

Versie 0.27.2 voegt donkere modus en een read-only CSP-scanner toe. Publiceer `dist/`, `server/` en `shared/` samen en herstart de API; zie [serverupdate](../docs/installatie.md#serverupdate-versie-0270) en [scanarchitectuur](../docs/scans.md). Voor lokaal scannen moet `IBKR_ALLOWED_ORIGINS` ook `http://127.0.0.1:5173` bevatten. Start de API met `npm run start:api` in een tweede terminal.

Live saldoverandering werkt mee met **Vernieuwen**. Publiceer de nieuwe `dist/` en backendbestanden samen en herstart `trading-monitor-api.service` om eerdere dagmetingen te bewaren. Zie [gebruik en berekeningen](../docs/gebruik.md) voor de vergelijkingsbron en terugval bij ontbrekende dagen.

## Vereisten

- Node.js 22 of nieuwer
- npm 10 of nieuwer

## Lokale data klaarzetten

Plaats de IBKR Flex-bestanden in `data/private/`. De importer leest alle XML-bestanden waarvan de naam met een van deze voorvoegsels begint:

- `flex_net_liq_into_db.xml`
- `flex_trades_into_db.xml`
- `flex_optionEAE_into_db.xml`

Voor extra jaren mag een achtervoegsel worden gebruikt, bijvoorbeeld `flex_trades_into_db_2025.xml`. Overlappende saldodagen en trades met dezelfde IBKR-executie-ID worden automatisch één keer verwerkt.

Deze map en de gegenereerde dashboarddata zijn bewust uitgesloten van Git.

## Commando's

Martin-watchlists: `node scripts/scan-martin.mjs`. Eigen universum: `node scripts/scan-martin.mjs --universe data/private/tickers.txt`. Uitvoer: `data/private/martin/watchlist.md`, CSV, JSON en TradingView-txt. Tests: `node --test tests/martin-selection.test.mjs`. Zie [criteria en dataformaten](../docs/martin-scanner.md).

```powershell
npm install
npm run import:flex
npm run dev
```

Open daarna `http://127.0.0.1:5173`.

Validatie en productiebuild:

```powershell
npm test
npm run build
npm run preview
```

## Productie op poort 80

De meegeleverde Nginx-configuratie staat in [`deploy/nginx/trading-monitor.conf`](deploy/nginx/trading-monitor.conf). Volg de Linux-instructies in [`../docs/installatie.md`](../docs/installatie.md) om de build op `http://<intern-ip>/` beschikbaar te maken.

De read-only IBKR-backend kan lokaal worden gestart met `npm run start:api`. Voor de volledige IBC-, MFA-, systemd- en Nginx-installatie staan de opdrachten in de installatiehandleiding.

De resultaatberekening staat in `scripts/realized-results.mjs`. Voer na wijzigingen aan de importer `npm test`, `npm run import:flex` en daarna `npm run build` uit, zodat de productiebuild de opnieuw berekende lokale data bevat. Zie de [berekeningsregels](../docs/gebruik.md).

Stortingen/opnames: plaats optioneel `Storting_YYYY.xml` in `data/private/`. Gebruik per jaar één cumulatief Cash Report vanaf 1 januari (voor het eerste rekeningjaar mag de werkelijke startdatum). Zie [Inleg en rendement](../docs/inleg.md) voor exportvelden en berekeningen.

## Breakout-scanner 0.30.0

Vereist Node 22.12+/24/26+ en Python 3.12+. Vanuit deze source-map:

```bash
npm ci
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
cp .env.example .env
npm run dev:lan
```

Windows: `py -3.12` en `backend/.venv/Scripts/python.exe`; kopieer .env.example met Copy-Item. Productie: één commando `npm run serve:lan`, inclusief build, gezamenlijke origin en LAN-URL op 0.0.0.0:8000. Optionele demo: `npm run dev:demo`, expliciet gemarkeerde testdata en tijdelijke database. Open de geprinte LAN-URL /#breakout; stel eerst TWS/Gateway in. Geen automatische service-installatie.

Controles: `npm test`, `npm run test:frontend`, `npm run build`; subapp backend: `cd backend` en `.venv/bin/python -m pytest -q`. Playwright: `npm run test:e2e` tegen de expliciete testbackend of dev:demo, met Playwright/Edge beschikbaar. [LAN/start/API](../docs/breakout-lan.md), [backendcommando's](backend/README.md) en [detectieconfig](../docs/breakout-scanner.md).

## Scanneracceptatie en handleidingen

43 backendtests en 13 frontendtests geslaagd; deterministische fixtures vereisen geen IBKR. Volledige installatie-, test- en LAN-commando's staan in [DEPLOYMENT.md](../docs/DEPLOYMENT.md); [IBKR.md](../docs/IBKR.md) beschrijft paper/API-instellingen en [SETUP_LOGIC.md](../docs/SETUP_LOGIC.md) alle criteria. Zie [validatie](../docs/validatie.md) voor de daadwerkelijke browser- en productiecontrole.
