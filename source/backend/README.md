# Python Breakout-backend

Onderdeel van Trading Monitor 0.29.0; read-only FastAPI-scanner. Python 3.12+, SQLite/SQLAlchemy, Pydantic-settings en ib_async 2.1.0. De bestaande portefeuille-API op 8787 blijft apart.

Voer vanuit `source/` uit:

```bash
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8788
```

Windows: gebruik `backend/.venv/Scripts/python.exe` in plaats van `backend/.venv/bin/python`. De databasemap is standaard `source/data/private/`. Milieuvariabelen hebben prefix `BREAKOUT_`; zie [voorbeeld](../deploy/trading-monitor/breakout.env.example). Paper Gateway 4002 en client-ID 109 zijn standaard. Instellingen in de SQLite-database gaan na opslaan vóór de initiële verbindingsdefaults.

Tests (subapp backend):

```bash
cd backend
.venv/bin/python -m pytest -q
```

OpenAPI: `/api/openapi.json`; interactieve documentatie: `/api/docs`.

Voor de end-to-endtest, start uitsluitend in een testomgeving vanuit deze backendmap:

```bash
.venv/bin/python -m uvicorn tests.smoke_server:app --host 127.0.0.1 --port 8788
```

Dit ASGI-testtarget maakt een tijdelijke database en injecteert een herkenbare testbroker. De productiemodule `app.main` kent geen demo-/testbrokerschakelaar. Start Vite vanuit source en voer `npm run test:e2e` uit met Playwright beschikbaar en `PLAYWRIGHT_CHANNEL` (`msedge` standaard, alternatief `chrome`). De test gebruikt echte HTTP-routes, SQLite, contractcache en Python-analyse, zonder browserroute-interceptie.

Zie [scannerhandleiding](../../docs/breakout-scanner.md) en [Python-architectuur](../../docs/breakout-python.md).
