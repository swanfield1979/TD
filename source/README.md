# Ontwikkeling

Actuele versie: **0.31.6**. IV Scan vervangt Breakout in het menu; Leaps bewaart de handmatige shortlist op de server. Zie [gebruik en serverupdate](../docs/iv-leaps.md). Vanuit deze map: `npm ci`, `npm test`, `npm run test:frontend`, `npm run build`; lokaal `npm run dev:lan` of `npm run serve:lan`. Browsercontrole met expliciete testfixtures: `npm run test:research` na starten van Vite op poort 5199 (`npm run dev -- --port 5199`); installeer hiervoor tijdelijk Playwright zoals beschreven in de handleiding.

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
