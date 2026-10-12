# Breakout-scanner

Trading Monitor 0.28.0 voegt de pagina **Breakout** toe: `http://192.168.1.22/#breakout` (ook `/breakout`). De bestaande portefeuillefuncties blijven aanwezig. De visuele richting volgt het bestaande prototype op `192.168.1.214:8000/leader-scan.html`: donkere achtergrond, lime-accent, Nederlandse tekst en een sorteerbare leiderschapstabel. Productiecode is verdeeld over React, een Node-API, een IBKR-provider en een afzonderlijke detectie-engine.

## Gebruik

1. Verbind de bestaande IBKR-koppeling; bevestig zo nodig IB Key.
2. Kies bij **Instellingen** S&P 500 of een eigen universum van USD-aandelentickers. Een eigen universum wordt als eigen selectie gerangschikt, niet als de gehele markt.
3. Pas desgewenst de JSON-configuratie aan en klik **Scan starten**. De criteria worden op de server gevalideerd. Er zijn geen orders of automatische transacties.
4. Volg de voortgang. Een S&P 500-scan omvat alle leden en duurt minimaal circa tien minuten, langer bij trage antwoorden/time-outs. **Scan stoppen** voltooit hoogstens de lopende historieaanvraag (maximaal 30 seconden).
5. Kies 1M/3M/6M en Top 1%, 2% of 5%. Topselectie gebeurt vóór het setupfilter. Zoek of sorteer vervolgens de tabel. **Volledig universum** toont ook zwakkere aandelen, mislukte structuren en onvoldoende historie.
6. Klik een ticker voor de echte koersgrafiek, consolidatierange, voortschrijdende gemiddelden en alle setupmetingen. **CSV exporteren** exporteert de getoonde selectie inclusief diagnostiek.

Dagcandles van de huidige New York-datum worden conservatief uitgesloten, ook na sluiting; signalen verschijnen vanaf de volgende kalenderdag. Dit is een eindedagscanner, geen intraday scanner. Weekenddagen creëren geen extra candles. Resultaten en peildatum blijven zichtbaar na verversen en een API-herstart. Controleer altijd de getoonde peildatum: opgeslagen data wordt niet als live koers aangeduid.

## Rangschikking

Rendement = `(laatste slotkoers / slotkoers N sessies geleden − 1) × 100`. Default N = 21, 63, 126. Per venster rangschikken we alle aandelen met een meetbaar rendement, aflopend met ticker als stabiele gelijkestandbeslissing. Aantal leiders = `ceil(meetbare aandelen × toppercentage / 100)`. Kleine universums kunnen daarom dezelfde selectie voor meerdere percentages geven. De samengestelde score is de gewogen percentielrang (0–100), geen voorspelde kans en geen ruwe rendementsscore. Deze score bepaalt niet de vensterselectie.

Een scan gebruikt één gemeenschappelijke peildatum: de nieuwste datum die door de historie is geleverd. Aandelen met oudere slotdata worden zichtbaar gemeld en uit de rangschikking uitgesloten. Ontbrekende marktdata of IPO-historie worden niet met nulrendement of fictieve koersen opgevuld. Bij fouten is de scan gedeeltelijk en gelden de percentages alleen voor de meetbare subset; de pagina toont de dekking. De huidige S&P 500-ledenlijst introduceert bij historisch onderzoek survivorship bias; dit product doet actuele selectie, geen universumbacktest.

## Detectie en configuratie

Alle standaardcriteria staan in `source/shared/leadership.mjs`, `DEFAULT_CONFIG`. JSON-wijzigingen worden met de scan opgeslagen in `breakout-scan.json`, naast de bestaande private live-snapshot (aanpasbaar met `IBKR_BREAKOUT_PATH`). Percentages zijn **procentpunten**, ratio's zijn dimensieloos, tijden zijn handelssessies. Dit zijn instelbare selectieheuristieken, geen statistisch bewezen handelsvoordeel.

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
| failed | Structuur mislukt | Te diepe basis, materieel lagere swinglows, koers onder basislow of te ver onder MA20 |
| insufficient_data | Onvoldoende historie | Minder dan het benodigde momentum-/MA-/impulsvenster |

Bij meerdere mogelijke bases krijgt de sterkste geldige status voorrang, daarna de langste basis en de grootste impuls. Alle datums, duur, high/low, diepte, MA10/20/50, hellingen, ATR20, contracties, MA-afstanden en hogere-lowsresultaten blijven beschikbaar via API en detailpaneel.

## Architectuur en API

- `src/BreakoutPage.tsx` en `src/breakout.css`: React-interface, filtering, sortering, detailgrafiek en CSV.
- `shared/leadership.mjs`: onafhankelijke configureerbare analysekern zonder I/O.
- `server/leadership-provider.mjs`: afzonderlijke read-only IBKR-socket, client-ID `IBKR_CLIENT_ID + 30`; houd dit ID vrij. Gecorrigeerde `ADJUSTED_LAST`, reguliere sessies, 1D-bars, drie jaar historie.
- `server/leadership-service.mjs`: asynchrone volledige universumscan, voortgang, foutisolatie en private opslag. Sequentiële aanvragen met 1,1 seconde tussenpauze; subscriptions worden afgemeld en socket gesloten. Geen koersfeedfallback en geen fictieve productiegegevens. Geen overlap tussen twee Breakout-scans.
- `GET /api/breakout`: configuratie, status, voortgang, resultaten, dekking en waarschuwingen.
- `POST /api/breakout`: `{ "universe": "sp500" | "custom", "symbols": "NVDA,APP", "config": {...} }`.
- `POST /api/breakout/cancel`: lopende scan stoppen.

POST vereist een toegestane Origin en `X-Requested-With: trading-monitor`, dezelfde beveiliging als bestaande API-routes. De backend blijft localhost achter Nginx. Requestbody maximaal 64 KiB; maximaal 5000 eigen tickers. Historie vereist passende IBKR-marktdatarechten. IBKR kan verzoeken vertragen of weigeren; fouten worden gemeld, niet verborgen. Er is geen realtime prijs-/volumeclaim.

Bronnen: [IBKR historische bars en ADJUSTED_LAST](https://interactivebrokers.github.io/tws-api/historical_bars.html), [IBKR historiebeperkingen](https://interactivebrokers.github.io/tws-api/historical_limitations.html). De gebruikte `@stoqey/ib` 1.6.10-adapter beëindigt historie met de `finished`-callback.

## Installatie via GitHub

De update wordt via de bestaande GitHub-repository verspreid. Voer op de Linux-webserver in PuTTY uit:

```bash
cd /home/gerard/TD
git pull --ff-only origin main
cd source
bash deploy/update-breakout.sh
```

Het script controleert tests en productiebuild, maakt een webrootback-up, publiceert de build en herstart de bestaande API. De bestaande servercheckout is de API-installatiebron; het script controleert dit vóór publiceren. Geen nieuwe Flex-import nodig. Voor rollback van API-code moet de checkout naar de eerdere commit worden teruggezet; de scriptuitvoer vermeldt die commit. De back-up bevat privégegevens en blijft op de server.

## Lokale validatie

Vanuit `source/`: `npm test` en `npm run build`. Voor lokale frontend: `npm run dev`; API in tweede terminal: stel `IBKR_ALLOWED_ORIGINS=http://127.0.0.1:5173`, een schrijfbaar `IBKR_SNAPSHOT_PATH` en de juiste Gateway-host/poort in, daarna `npm run start:api`.

De tests toetsen setups, failed/ready/forming, sessie-indexering, echte toppercentages, ontbrekend volume, peildatumselectie, uitsluiting van vandaag, geen kandidaatbar in breakoutniveau/ATR, IBKR-callbacks, privéopslag, annuleren, configuratievalidatie en de echte HTTP-API. Tests met vaste OHLC-fixtures zijn testdata en worden nooit automatisch als productiedata getoond. Live marktdata en installatie op `192.168.1.22` moeten na de serverupdate worden gecontroleerd.
