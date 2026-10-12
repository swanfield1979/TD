# Breakout-scanner

Trading Monitor 0.29.0 voegt de pagina **Breakout** toe: `http://192.168.1.22/#breakout` (ook `/breakout`). De bestaande portefeuillefuncties blijven aanwezig. De visuele richting volgt het bestaande prototype op `192.168.1.214:8000/leader-scan.html`: donkere achtergrond, lime-accent, Nederlandse tekst en een sorteerbare leiderschapstabel. Productiecode is verdeeld over React, een Python/FastAPI-API, een read-only IBKR-provider, SQLite-opslag en een afzonderlijke detectie-engine.

## Gebruik

1. Configureer en verbind de afzonderlijke scannerverbinding (standaard Paper Gateway 4002). De bestaande portefeuilleverbinding is hiervan onafhankelijk.
2. Importeer bij **Instellingen** een universum-CSV met symbol/exchange/currency, of kies S&P 500 of eigen USD-tickers. De downloadbare voorbeeld-CSV is geen volledig marktuniversum. Een eigen universum wordt als eigen selectie gerangschikt, niet als de gehele markt.
3. Pas desgewenst de JSON-configuratie aan en klik **Scan starten**. De criteria worden op de server gevalideerd. Er zijn geen orders of automatische transacties.
4. Volg de voortgang en fouten per symbool. Een eerste S&P 500-sync kan uren duren; volgende syncs vragen alleen ontbrekende bars op. **Fouten opnieuw** herhaalt mislukte instrumenten; **Volledige hercontrole** herlaadt drie jaar voor corporate-actioncontrole. **Scan stoppen** annuleert actieve aanvragen en behoudt de cache.
5. Kies 1M/3M/6M en Top 1%, 2% of 5%. Topselectie gebeurt vóór het setupfilter. Zoek of sorteer vervolgens de tabel. **Volledig universum** toont ook zwakkere aandelen, mislukte structuren en onvoldoende historie.
6. Klik een ticker voor de echte koersgrafiek, consolidatierange, voortschrijdende gemiddelden en alle setupmetingen. **CSV exporteren** exporteert de getoonde selectie inclusief diagnostiek.

Dagcandles van de huidige New York-datum worden conservatief uitgesloten, ook na sluiting; signalen verschijnen vanaf de volgende kalenderdag. Dit is een eindedagscanner, geen intraday scanner. Weekenddagen creëren geen extra candles. Resultaten en peildatum blijven zichtbaar na verversen en een API-herstart. Controleer altijd de getoonde peildatum: opgeslagen data wordt niet als live koers aangeduid.

## Rangschikking

Rendement = `(laatste slotkoers / slotkoers N sessies geleden − 1) × 100`. Default N = 21, 63, 126. Per venster rangschikken we alle aandelen met een meetbaar rendement, aflopend met ticker als stabiele gelijkestandbeslissing. Aantal leiders = `ceil(meetbare aandelen × toppercentage / 100)`. Kleine universums kunnen daarom dezelfde selectie voor meerdere percentages geven. De samengestelde score is de gewogen percentielrang (0–100), geen voorspelde kans en geen ruwe rendementsscore. Deze score bepaalt niet de vensterselectie.

Een scan gebruikt één gemeenschappelijke peildatum: de nieuwste datum die door de historie is geleverd. Aandelen met oudere slotdata worden zichtbaar gemeld en uit de rangschikking uitgesloten. Ontbrekende marktdata of IPO-historie worden niet met nulrendement of fictieve koersen opgevuld. Bij fouten is de scan gedeeltelijk en gelden de percentages alleen voor de meetbare subset; de pagina toont de dekking. De huidige S&P 500-ledenlijst introduceert bij historisch onderzoek survivorship bias; dit product doet actuele selectie, geen universumbacktest.

## Detectie en configuratie

Alle standaardcriteria staan in `source/backend/app/schemas/scanner.py`, `AnalysisConfig`. JSON-wijzigingen worden gevalideerd en in SQLite opgeslagen. Percentages zijn **procentpunten**, ratio's zijn dimensieloos, tijden zijn handelssessies. Dit zijn instelbare selectieheuristieken, geen statistisch bewezen handelsvoordeel.

| Sleutel | Standaard | Betekenis |
| --- | --- | --- |
| periods | [21,63,126] | Oplopende momentumvensters, maximaal 500 sessies |
| weights | [0.4,0.35,0.25] | Gewichten van percentielscore; som 1 |
| moveMinSessions / moveMaxSessions | 5 / 30 | Rolling impulsvensters; slot-tot-slot sessieafstand |
| moveLookback | 63 | Zoekbereik voor einde van voorafgaande impuls |
| moveMinPct | 30 | Minimale stijging; geen bovengrens |
| baseMinSessions / baseMaxSessions | 10 / 42 | Geldige consolidatieduur na impuls |
| maxDepthPct | 25 | Maximale daling van high naar low in de basis |
| maxBaseAdvancePct | 5 | Maximale stijging van basishigh boven impuls-eindhigh; voorkomt dat een doorgaande impuls als consolidatie telt |
| slopeSessions | 5 | Meetafstand voor procentuele MA-helling |
| minSlopePct | 0 | Minimale MA10/MA20-helling vóór de kandidaatbar |
| maxMaDistancePct | 12 | Maximale absolute slotafstand tot steun-MA vóór kandidaatbar |
| requireMa50 | false | Ook MA50-steun en helling verplicht |
| swingRadius | 2 | Pivotlow vergeleken met twee candles links en rechts |
| lowerLowTolerancePct | 2 | Toegestane daling tussen opeenvolgende pivotlows |
| contractionSessions | 5 | Vergelijk eerste en laatste N consolidatiesessies |
| maxRangeRatio | 0.85 | Maximale recente / eerste high-low-range |
| maxVolatilityRatio | 0.95 | Maximale recente / eerste gemiddelde true range |
| readyDistancePct | 5 | Maximale afstand onder breakoutniveau voor gereed |
| expansionRatio | 1.3 | Laatste true range / ATR20 vóór kandidaatbar |
| requireVolume | false | Volumeconfirmatie verplicht voor breakout |
| volumeRatio | 1.2 | Laatste volume / gemiddeld volume van 20 eerdere candles |
| failureMa20Pct | 8 | Maximale koersdaling onder actuele MA20 |

Voor iedere rolling impuls zoeken we een aaneengesloten basis die eindigt vóór de laatste candle. Het impulseinde moet zijn hoogste slotkoers zijn. Basis-high omvat ook de high van de impuls-eindcandle; de kandidaatbar wordt uitgesloten. Basisdiepte is `(high-low)/high × 100`. MA-afstanden zijn `(koers/MA − 1) × 100`; MA-helling is de procentuele verandering over `slopeSessions`. ATR20 is het rekenkundige gemiddelde van 20 eerdere true ranges; true range omvat gaps naar de vorige slotkoers. De breakoutcandle telt niet mee in de ATR-baseline of contractiemetingen.

Hogere bodems worden getoetst aan bevestigde pivots in de basis, uitsluitend met candles vóór de kandidaatbar. Bij minder dan twee pivots toont de interface **Niet toetsbaar** en gebruikt de detectie de laagste koers uit het eerste en laatste consolidatievenster als aanvullende ordelijkheidstoets. Een klaarstaande basis vereist voldoende duur, ordelijke lows, range- en volatiliteitscontractie en MA-steun. Configuratie accepteert gehele vensters van 1–250 sessies; de minimale basis moet minimaal twee contractievensters omvatten.

| Status | Label | Criteria |
| --- | --- | --- |
| forming | Basis in vorming | Geen complete bevestiging of nog geen kwalificerende impuls; redenen zichtbaar |
| ready | Consolidatie gereed | Geldige basis, slot onder high en dichtbij breakoutniveau |
| breakout | Breakout actief | Geldige basis, slot boven voorafgaande high en voldoende range-expansie; volume indien vereist |
| failed | Setup mislukt | Te diepe basis, materieel lagere swinglows, koers onder basislow of te ver onder MA20 |
| insufficient_data | Onvoldoende data | Minder dan het benodigde momentum-/MA-/impulsvenster |

Bij meerdere mogelijke bases krijgt de sterkste geldige status voorrang, daarna de langste basis en de grootste impuls. Alle datums, duur, high/low, diepte, MA10/20/50, hellingen, ATR20, contracties, MA-afstanden en hogere-lowsresultaten blijven beschikbaar via API en detailpaneel.

## Architectuur en API

De scanner is verdeeld over backend/app/api, broker, core, db, models, schemas, services en analysis; de frontend over src/pages, components, api, types en utils. SQLite bewaart universe, contract-ID's, dagelijkse OHLCV, instellingen en fouten. Default TRADES, optioneel ADJUSTED_LAST, aparte caches. Split-/dividendbehandeling, dataintegriteit, vertraging, pacing, retries en alle JSON-endpoints staan in [Python-architectuur en API](breakout-python.md). Swagger: /api/docs.

De pure JavaScript-analyse in shared/leadership.mjs blijft als eerder geteste referentie beschikbaar; productie gebruikt de Python-analyse. De oude Node-scannerprovider/service zijn verwijderd. De portefeuille/CSP blijft via de bestaande Node-API werken.

## Installatie via GitHub

Voer op de bestaande Linux-webserver uit:

```bash
cd /home/gerard/TD
git pull --ff-only origin main
cd source
bash deploy/update-breakout.sh
```

Vereist Node.js 22.12+, 24 of 26+ (geen Node 25) en Python 3.12+ met venv/pip. Installeer op Ubuntu/Debian waar beschikbaar eerst `sudo apt install python3.12 python3.12-venv`; bij een andere Python-installatie: `BREAKOUT_PYTHON_BIN=/pad/naar/python bash deploy/update-breakout.sh`.

Het script voert Node-/Vitest-/pytest-tests en de productiebuild uit, maakt een webroot- en Nginx-back-up, installeert gepinde Python-dependencies, start de afzonderlijke systemd-scanner op 8788 en routeert de scanner-API via Nginx. De bestaande API blijft op 8787. De checkout moet de bestaande API-installatiemap zijn; dit wordt vóór publicatie gecontroleerd. Geen nieuwe Flex-import vereist. Instellingen: `/etc/trading-monitor/breakout.env` (optioneel; voorbeeld in source/deploy/trading-monitor). Standaard is Paper Gateway op 4002 met client-ID 109. Open `http://192.168.1.22/#breakout`, vernieuw met Ctrl+F5, configureer de werkelijke TWS/Gateway-poort en verbind de scanner. Een live portefeuilleverbinding op 4001 maakt de aparte paperscanner niet automatisch bereikbaar.

Controle: `systemctl status trading-monitor-breakout.service`, `journalctl -u trading-monitor-breakout.service -n 60 --no-pager` en `curl --fail http://127.0.0.1/api/health`. Controleer daarna CSV-import, syncvoortgang en peildatum met echte IBKR-data. Back-ups bevatten mogelijk privédata en blijven op de server. Voor rollback: eerdere Git-commit herstellen, oude webroot/Nginx-back-up terugzetten en relevante services herstarten; behoud de SQLite-database. Live installatie is vanuit deze werkomgeving niet bevestigd.

## Lokale validatie

Vanuit source: `npm test`, `npm run test:frontend`, `npm run build`. Vanuit de subapp source/backend: `.venv/bin/python -m pytest -q`. Start zowel Vite als de Python-API; zie [echte ontwikkelcommando's](../source/backend/README.md). Playwright-smoke: `npm run test:e2e` met expliciete tests.smoke_server-backend; fixtures worden nooit automatisch als productiekoersen getoond. [Validatie en beperkingen](breakout-python.md#validatie).
