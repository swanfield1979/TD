# Ontwikkeling

De webapp staat volledig in deze map. Voer alle ontwikkel- en bouwcommando's vanuit `source/` uit.

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

## Breakout-scanner 0.29.0

Vanuit deze source-map: `npm ci`, `npm run dev` en voor de bestaande portefeuille `npm run start:api` in een tweede terminal. Start de nieuwe Python-subapp in een derde terminal:

```bash
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8788
```

Windows: vervang het venv-pad door `backend/.venv/Scripts/python.exe`. Open `http://127.0.0.1:5173/#breakout`. Standaard Paper Gateway 4002, read-only; configureer TWS/Gateway in de pagina. De lokale database staat in data/private. Node: 22.12+, 24 of 26+; Python: 3.12+.

Controles vanuit source: `npm test`, `npm run test:frontend`, `npm run build`. Backendtests: subapp backend, `cd backend` en `.venv/bin/python -m pytest -q`. Playwright: `npm run test:e2e` met de expliciete testbackend, zie [backendcommando's](backend/README.md). GitHub-serverupdate: `bash deploy/update-breakout.sh`. Zie [handleiding](../docs/breakout-scanner.md) en [architectuur/API](../docs/breakout-python.md).
