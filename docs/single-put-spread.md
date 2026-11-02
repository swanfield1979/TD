# Single Put Spread

Vanaf Trading Monitor **0.43.0** (2 november 2026). Open **Single Put Spread** direct onder Put spreads in het menu, of gebruik `/#single-put-spread` (ook `/single-put-spread`). Serverinstallatie nog niet uitgevoerd.

## Gebruik

1. Vul één Amerikaanse aandelenticker in, bijvoorbeeld `AAPL`. Kleine letters en spaties rondom worden genormaliseerd; aandelenklassen zoals `BRK.B` worden voor IBKR als `BRK B` verwerkt. Lijsten met meerdere tickers worden afgewezen.
2. Standaard staat de bron op **IBKR**. Desgewenst kun je **Yahoo + IBKR-controle** kiezen; die bron selecteert maximaal twintig spreadparen en kan daardoor andere combinaties missen.
3. Open zo nodig **Scancriteria aanpassen**. Standaard: 30–60 DTE, minimale maximale winst $15, maximaal verlies $1.000, minimale OTM-proxy 70% en maximaal bied-laatverschil $1 per put. Minimum koers 0, maximum koers $1.000.000 en minimum koersbuffer 0%; IV-rank, IV Percentile en gemiddeld optievolume hebben minimum 0 (uitgeschakeld). Deze brede begininstellingen zijn aanpasbaar en vormen geen handelsadvies.
4. Klik **Optiescan starten**. De scan controleert uitsluitend de opgegeven ticker, zonder de voorafgaande Stock Filter of IV-selectie. Onderliggende koers, IV-jaarhistorie, contracten en quotes worden met dezelfde bestaande scanlogica gecontroleerd. Voor nieuwe quotes is een verbonden IBKR Gateway met geschikte datarechten nodig.
5. Alle gevonden spreads voor deze ticker staan onder elkaar, met maximaal vijftig per pagina. Sorteer op R/R, winst, verlies, IV, buffer of looptijd. Open het pijltje voor bied-/laatprijzen en quotedatums. CSV bevat alle gevonden spreads voor de ticker.

De R/R-groentinten gebruiken dezelfde [kleurregels](put-spreads.md#groentinten-voor-rendement-op-risico-0429). Kleur geeft de verhouding maximale winst/maximaal verlies aan, geen exacte winstkans of gegarandeerd rendement. Er worden geen orders geplaatst.

## Voortgang, fouten en opslag

Status, ticker, aantal gecontroleerde contracten, voortgang, waarschuwingen en eventuele redenen voor geen resultaat staan boven de resultaten. De laatst gescande ticker blijft bij die resultaten staan als je het invoerveld alvast wijzigt. **Scan stoppen** bewaart de voortgang. **Scan hervatten** gebruikt de oorspronkelijke ticker en vereist dezelfde criteria en bron; na een serverherstart wordt een lopende scan als onderbroken hersteld.

De browser bewaart ticker, criteria en bron apart onder `tm-single-put-spread-filters`. De server bewaart de scan apart als `singleSpreads` in het bestaande private `scan-results.json`. Resultaten van de gewone Put-spreadscan worden niet vervangen. Optiechain-, liquiditeits- en IV-caches, de IBKR-aanvraaglimieten en Geblokkeerde Stocks worden gedeeld. Een geblokkeerde ticker geeft een melding met de instructie om het aandeel eerst via **Put spreads → Geblokkeerde Stocks** te deblokkeren. Het rode kruis bij een resultaat blokkeert het hele aandeel, zoals bij Put spreads.

Er kan één optiescan tegelijk actief zijn. Een lopende bulk-, IV-, Leaps- of weekscan kan een nieuwe Single Put Spread-scan tijdelijk blokkeren, en omgekeerd. Buiten de beursuren kan een bestaande opgeslagen chain gebruikt worden, met de oorspronkelijke quotedatums. Een verruimde looptijd of buffer kan buiten de dekking van die cache vallen; de bestaande waarschuwingen blijven zichtbaar.

## Ontwikkeling en installatie

Frontend en Node-API moeten samen naar **0.43.0** worden bijgewerkt. Gebruik de bestaande [updatefunctie](app-updates.md); er is geen afzonderlijk installatiepakket gemaakt.

Vanuit `source/`:

- `npm run build`
- `npm test`
- `npm run test:frontend`
- Start Vite met `npm run dev -- --host 127.0.0.1 --port 5197`; voer in een tweede terminal `npm run test:single-spread` en `npm run test:spreads` uit.

API: `GET/POST /api/single-put-spread` en `POST /api/single-put-spread/stop`. Startbody: `{ "symbol": "AAPL", "chainSource": "ibkr", "filters": { "minDte": 30, "maxDte": 60 } }`. De webapp stuurt alle actuele criteria mee; weggelaten API-filtervelden gebruiken de bestaande algemene spreaddefaults. Dezelfde Origin- en `X-Requested-With: trading-monitor`-controle geldt als bij andere scans. Voor hervatten: dezelfde ticker, bron en filters met `resume: true`. Stock- en IV-selectie-ID’s zijn voor deze route niet nodig.

Validatie: build, frontendtests, Node-tests en browsercontroles met fictieve marktdata geslaagd. Geen live brokerproef of serverinstallatie uitgevoerd. Zie [validatie](validatie.md).
