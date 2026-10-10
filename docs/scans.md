# CSP-scans

Open **Scans** en kies **Start scan**. Eerst worden unieke onderliggende symbolen van alle open aandelen- en optieposities uit de laatst bewaarde IBKR-snapshot gecontroleerd; bij ontbreken daarvan wordt de lokale Flex-portfoliosamenvatting gebruikt. Een nieuwere Flex-peildatum krijgt voorrang op een oudere snapshot; de gebruikte portfoliodatum wordt getoond. Daarna volgt een marktverkenning. Bestaande symbolen worden niet dubbel in de marktverkenning getoond. De scan plaatst geen orders en toetst niet of er voldoende vrije cash is.

## Criteria

Alle voorwaarden gelden tegelijk; onbekende waarden worden uitgesloten:

| Voorwaarde | Grens |
| --- | --- |
| Contract | USD-put op aandelen, standaardmultiplier 100 |
| Looptijd | 35 t/m 50 resterende kalenderdagen, handelsdatum New York |
| Delta | Negatieve putdelta; absolute waarde 0,16 t/m 0,22 |
| IVR | Strikt groter dan 30 |
| OTM | Strike strikt onder de onderliggende koers uit de optie-Greeks |
| POP | `(1 − abs(delta)) × 100`, strikt groter dan 80% |
| Marktverkenning | Onderliggende koers $ 10 t/m $ 50; geen prijsgrens voor portfolio |
| Prijs | Positieve biedprijs; laatprijs minstens de biedprijs |

De POP-grens maakt het effectieve deltabereik **0,16 ≤ |delta| < 0,20**. Delta 0,20 levert 80% POP en wordt uitgesloten. POP is hier de door de gebruiker gekozen delta-benadering.

IVR: `100 × (actuele IV − laagste IV) / (hoogste IV − laagste IV)` op basis van de onderliggende aandelen-IV van IBKR (generic tick 106 / tick 24) en dagelijkse `OPTION_IMPLIED_VOLATILITY`-historie van één jaar. Rang begrensd op 0–100. Minimaal 200 geldige dagwaarnemingen, oudste minstens 330 dagen geleden, nieuwste maximaal 7 dagen geleden. Een vlakke of ontbrekende reeks wordt niet beoordeeld. Dit is IV-rank, geen IV-percentiel; providers met andere IV-reeksen kunnen andere uitkomsten leveren.

## Sortering en bedragen

Standaard hoogste lineair geannualiseerde premieopbrengst eerst. De keuze geldt binnen beide lijsten en kan worden gewijzigd naar rendement of absolute premie.

- Premie per contract: `biedprijs × 100`, vóór kosten.
- Bruto onderpand: `strike × 100`.
- Rendement op onderpand: `premie / onderpand × 100%`.
- Lineair jaarrendement: `rendement × 365 / resterende dagen`.

De tabel toont bied/laat, koers, expiratie, DTE, delta, POP, IVR, premie, onderpand en koersdatatype. **Opgehaald** is het verzameltijdstip, geen beurs-ticktimestamp. IBKR bepaalt of live, vertraagde of bevroren data geleverd wordt. Resultaten blijven zichtbaar met hun ophaaltijd tot een nieuwe scan of API-herstart.

## Marktdekking en datavereisten

De marktverkenning gebruikt maximaal 50 resultaten uit `STK.US.NASDAQ` en maximaal 50 uit `STK.US.MAJOR`, scan `HIGH_OPT_IMP_VOLAT`, prijs 10–50, stocktype CORP. NASDAQ-resultaten komen uit die beursselectie. Andere Amerikaanse resultaten worden uitsluitend meegenomen als hun symbool in de actuele [S&P 500-ledenlijst van datasets](https://github.com/datasets/s-and-p-500-companies) staat. Die lijst wordt bij elke scan opgehaald; bij uitval vervalt de S&P-selectie met een melding. NASDAQ betekent Nasdaq-genoteerde aandelen, niet uitsluitend Nasdaq-100. Dit is een shortlist, geen uitputtende marktscan.

Per geselecteerd aandeel worden alle door IBKR gemelde SMART-standaardketens met 35–50 DTE en beschikbare OTM-putstrikes gecontroleerd. Ketens kunnen niet-bestaande contractcombinaties bevatten; die worden overgeslagen en gemeld. Optiequotes worden in groepen van maximaal 15 gedurende 5 seconden verzameld om subscriptions en API-belasting te begrenzen. Een scan kan meerdere minuten duren. De browser haalt iedere 3 seconden voortgang en tussentijdse resultaten op.

Een bestaande IB Gateway-verbinding en passende marktdatarechten voor Amerikaanse aandelen, optie-Greeks en IV-historie zijn nodig. Client-ID: `IBKR_CLIENT_ID + 20`; reserveer die ID. Ontbrekende data leidt tot een gedeeltelijke scan met een samengevat aantal meldingen. Alleen aandelen met een CSP die aan alle criteria voldoet zijn zichtbaar; afgewezen symbolen staan niet in voortgang, samenvatting of meldingen. De interface toetst ontvangen resultaten opnieuw aan de actuele looptijd en CSP-grenzen, zodat ook oude resultaten buiten de grenzen verdwijnen. De scan start Gateway of MFA niet zelf: gebruik eerst de IBKR-koppeling.

## Backend

- `GET /api/scans`: status, voortgang, resultaten en meldingen.
- `POST /api/scans`: start één scan; een tweede aanvraag tijdens een actieve scan retourneert dezelfde scan.
- POST gebruikt dezelfde origincontrole en `X-Requested-With: trading-monitor` als IBKR-verversen.
- Scanstatus staat in API-geheugen en verdwijnt bij herstart. Bestaande portfolio- en uitvoeringsbestanden worden niet gewijzigd.
- Aparte read-only socket voor contracten, scanner, IV-historie en marktdata. Subscriptions worden opgeruimd en de socket sluit na afloop.

API-bronnen: [IBKR-optieketens](https://interactivebrokers.github.io/tws-api/options.html), [Greeks](https://interactivebrokers.github.io/tws-api/option_computations.html), [historische data](https://interactivebrokers.github.io/tws-api/historical_bars.html).
