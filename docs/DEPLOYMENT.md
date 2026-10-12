# Installatie, starten en verificatie

De broncode staat onder `source/`; installatie- en ontwikkelcommando's worden daar uitgevoerd. De scanner bestaat uit React/TypeScript/Vite met Lightweight Charts, FastAPI/Pydantic, zuivere Python-analyse, een read-only brokeradapter en SQLAlchemy/SQLite. De bestaande portefeuille-API blijft afzonderlijk op localhost draaien. In productie serveert FastAPI frontend en API via dezelfde origin zonder permissieve CORS.

## Linux-installatie

Vereist Python 3.12+ met venv/pip en Node 22.12+, 24 of 26+. Gebruik een lokaal checkout van deze GitHub-repository:

```bash
cd source
npm ci
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
cp .env.example .env
```

Windows gebruikt `py -3.12 -m venv backend/.venv` en `backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-lock.txt`. Stel `.env` in volgens [IBKR.md](IBKR.md). Dependencies zijn gepind; `.env` en databases zijn uitgesloten van Git.

Ontwikkeling met één commando:

```bash
npm run dev:lan
```

Productie met één commando, inclusief TypeScript/Vite-build:

```bash
npm run serve:lan
```

De launcher bindt productie standaard aan `0.0.0.0:8000` en print gevonden LAN-URL's. Open `http://localhost:8000/#breakout` of `http://<LAN-IP>:8000/#breakout`. `APP_HOST` en `APP_PORT` zijn configureerbaar. Ontwikkeling gebruikt poort 5173; interne APIs gebruiken 8787/8788. Afsluiten met Ctrl+C sluit de subprocessen en brokerrequests. Configureer geen publieke portforwarding. De firewall moet gekozen LAN-poort toestaan.

De lokaal gecontroleerde adressen zijn [localhost](http://127.0.0.1:8000/#breakout) en [192.168.1.48](http://192.168.1.48:8000/#breakout). De beoogde bestaande server is [192.168.1.22](http://192.168.1.22/#breakout), met Nginx op poort 80. GitHub-publicatie is geen bewijs dat die server is bijgewerkt. Hiervoor zijn de [serverupdate-instructies](breakout-scanner.md#installatie-via-github) en [handmatige optionele systemd-installatie](breakout-lan.md#optionele-systemd-installatie) nodig; de service wordt niet automatisch geïnstalleerd. Het updatescript vereist een reeds aanwezige scanner-service. Verifieer daar `/api/health` na installatie.

## Universum en gebruik

Importeer op de Breakout-pagina UTF-8 CSV met `symbol,exchange,currency`; optioneel `company_name`/`company` en `sector`. [example-universe.csv](../source/data/example-universe.csv) is uitsluitend een klein voorbeeld. Verbind de broker en start synchronisatie. De queue toont voortgang en fouten; **Fouten opnieuw** herhaalt mislukte instrumenten. Cacheheranalyse vereist geen verbinding. Bij disconnect blijven eerder opgeslagen bars met exact timestamp en **Cached** zichtbaar. Zonder cache verschijnt een lege toestand.

Filters omvatten top 1/2/5%, alle leiders, setup, prijs, gemiddeld USD-dollarvolume, beurs, sector en ticker/bedrijf. De tabel is sorteerbaar; details tonen candlesticks, MA's, basisrange, impuls, eerdere breakout-high en checklist. [SETUP_LOGIC.md](SETUP_LOGIC.md) beschrijft alle berekeningen; [breakout-python.md](breakout-python.md) behandelt opslag, incremental sync en API. OpenAPI en Swagger staan op `/api/openapi.json` en `/api/docs`.

## Tests zonder IBKR

Alle onderstaande commando's worden vanuit `source/` uitgevoerd:

```bash
backend/.venv/bin/python -m pytest backend/tests -q
npm run test:frontend
npm test
npm run build
```

Op Windows vervangt `backend/.venv/Scripts/python.exe` het Python-pad. `npm test` draait alle aanwezige Node-testbestanden, inclusief eventuele lokale toevoegingen. De gerapporteerde regressies betreffen de Git-gevolgde suite.

Voor Playwright: installeer de testdependency met `npm install --no-save --package-lock=false playwright`, gebruik een geïnstalleerde Edge-browser (standaard), of installeer Chrome en stel `PLAYWRIGHT_CHANNEL=chrome` in. Start in één terminal:

```bash
npm run dev:demo
```

Voer in een tweede terminal vanuit source uit:

```bash
npm run test:e2e
```

De smoketest vereist expliciet de testbackend-header en weigert productie te wijzigen. Hij controleert echte API/SQLite-integratie, CSV-import, sync, filters, breakoutdetails, chart en desktop/mobiel. De zes deterministische pytest-fixtures gebruiken vaste sessiedatums en een vast klokmoment. Demo gebruikt een tijdelijke database en uitsluitend herkenbare testdata; productiestart accepteert geen demovlag.

## Grenzen

Deze educatieve researchtool is geen financieel advies. Resultaten hangen af van het aangeleverde universum. Concurrency blijft bewust één. Kalenderdekking is NYSE 2026–2028; andere beurzen vragen aanvullende kalenders. Corporate-actioncontrole is een heuristiek; verifieer relevante splits met volledige hercontrole. Geen live-tickstream, volledige marktuniversumfeed of sectorfeed wordt geleverd. Een echte IBKR-login, toegang vanaf een tweede fysiek LAN-apparaat en deployment op 192.168.1.22 zijn nog niet bevestigd.
