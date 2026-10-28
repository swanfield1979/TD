# Validatie

## Trading Monitor 0.42.2 — begrensde breedte op grote schermen (28 oktober 2026)

- Centrale layoutbreedte van maximaal 1760 pixels inclusief navigatie, met gelijke buitenmarges op brede schermen. Bestaande responsive indeling op kleinere schermen behouden.
- TypeScript/Vite-build en 13 frontendtests geslaagd. Browsercontrole van dashboard en Put spreads op 360, 768, 1440, 1920, 2560 en 3440 pixels, met gecentreerde breedte, mobiele navigatie en 200% zoom. Screenshots lokaal visueel gecontroleerd.
- Geen wijziging aan gegevens of berekeningen. Serverinstallatie nog niet uitgevoerd; bijwerken via Updates.

## Trading Monitor 0.42.1 — bediening en quotetabel (28 oktober 2026)

- Verwijderknop als eerste in de aandeelkolom, vóór het vergrootglas. Uitklappijl vergroot tot 24 pixels binnen een zichtbaar klikvlak van 44 × 44 pixels; native details-/toetsenbordbediening en TradingView-link behouden.
- Quote-details als tabel met verkoopput en koopput naast elkaar: strike, bied, laat, datastatus en quotetijd. Volume, handelsklasse, buffer en broninformatie staan als gezamenlijke tabelregels.
- TypeScript/Vite-build en 13 frontendtests geslaagd. Browserworkflow controleert knopvolgorde, afmetingen, uitklappen via de pijl, tabelkoppen en de bestaande spreadbediening; mobiele overflow en toetsenbord blijven gecontroleerd. Geen wijziging aan scanberekeningen.
- Serverinstallatie nog niet uitgevoerd; bijwerken via Updates.

## Trading Monitor 0.42.0 — Yahoo-optiechains (28 oktober 2026)

- Node-scraper met normale anonieme cookie-/crumbsessie, volledige standaardcall-/putchains per geselecteerde expiratie, twee expiraties tegelijk en gepacete aanvraagstarts. Aparte private cache van tien minuten met oorspronkelijke ophaaltijden.
- Optionele Yahoo-voorselectie van maximaal twintig spreadparen; alleen de geselecteerde benen worden bij IBKR opgevraagd. Alle uiteindelijke quotes, delta's, IV-/volumecriteria en spreadberekeningen blijven uit de bestaande brokerroute komen. Bron/tijd in details en CSV.
- 223 Node-tests, 13 frontendtests en TypeScript/Vite-build geslaagd. Tests controleren sessie/cache, onbekende waarden, contractvalidatie, annuleren, bronbeperkingen, brokerfallback en daadwerkelijk beperkte contractaanvragen. Browserworkflow controleert Yahoo-bronkeuze en opslag/hervatten, plus de bestaande spreadworkflow op mobiel/desktop.
- Live CLI-proef gaf HTTP 429 bij Yahoo; foutafhandeling bevestigd, succesvolle live-download en snelheid nog niet bevestigd. Geen proxy- of hostrotatie. Geen productie-installatie uitgevoerd. Zie [gebruik en beperkingen](yahoo-optiechains.md).

## Trading Monitor 0.41.0 — updateknop (28 oktober 2026)

- Pagina Updates met frontend-/API-versie, expliciete controle/installatie, voortgang, herladen en verbindingsherstel. De oude webapp vereist eenmalig de handmatige update om de service te installeren.
- Aparte systemd-service als gewone API-gebruiker; tijdelijke Git-worktree voor dependencies/tests/build, vaste root-publicatiehelper en nauw begrensde sudoers-regel. Geen shellopdrachten of downloadlocaties vanuit de browser. Bestaande API-sandbox behouden.
- Lokale wijzigingen, andere origin/branch en een gewijzigd GitHub-doel blokkeren installatie. Actieve scans/IBKR-vernieuwingen blokkeren de start; nieuwe scans wachten tijdens updates. Webroot-back-up en controle van de nieuwe API-versie.
- 216 Node-tests en 13 frontendtests geslaagd, inclusief bestaande lokale tests voor andere werkzaamheden. TypeScript/Vite-build en Bash-syntaxcontrole geslaagd. Nieuwe browserworkflow met gesimuleerde API geslaagd: setup, controle/installatie, dubbele acties, herladen, API-onderbreking, fouten, toetsenbord, 360–1440 pixels en 200% zoom. Screenshot visueel gecontroleerd.
- Geen daadwerkelijke systemd-/sudo-installatie of productie-update uitgevoerd in deze Windows-ontwikkelomgeving. Geen automatische volledige terugrol. Zie [installatie en herstel](app-updates.md).

## Trading Monitor 0.40.0 — optiechainverbeteringen (28 oktober 2026)

- Aangeleverde Yahoo-/SQLite-code beoordeeld; zie [vergelijking en afwegingen](vergelijking-optiechain.md). Geen externe broncode of nieuwe databron toegevoegd.
- Maximaal vier gelijktijdige optiequotes, gesynchroniseerde datatypefallback en één herberekening per batch. Tests controleren annulering, snelheidslimieten, abonnementen en selectie-equivalentie in 40 gevarieerde chains.
- Compacte/uitgebreide tabel, buffer, DTE, B/L, Jaar-R/R, drie extra sorteringen en CSV-kolom. Bestaande selectie per aandeel en alternatieven blijven behouden.
- 208 Node-tests en 13 frontendtests geslaagd, inclusief reeds aanwezige lokale tests voor andere werkzaamheden; TypeScript/Vite-build geslaagd. Browserworkflow met gesimuleerde API geslaagd: drie stappen, compacte/uitgebreide tabel, berekeningen, sorteringen, CSV, details, alternatieven, blokkeren, fouten, stoppen/hervatten, 360–1600 pixels en 200% zoom. Screenshot visueel gecontroleerd.
- Lokale synthetische meting: dezelfde 420 spreads uit 640 contracten; selectie circa 7,84 → 3,80 ms (mediaan van 20 uitvoeringen). Geen gemeten livebroker-versnelling of serverinstallatie.

## Trading Monitor 0.39.2 — uitlijning van spreadresultaten (26 oktober 2026)

- Vergrootglas, ticker, detailpijl en rode X in één aandeelkolom met gelijke hoogte; sector links, cijfers rechts onder overeenkomstige kolomkoppen. Bediening heeft vaste veldhoogtes; korte begeleidende tekst.
- TypeScript/Vite-build, 207 tests en 13 frontendtests geslaagd. Bestaande browserworkflow geslaagd en screenshot visueel gecontroleerd; deze controleert groepering, alternatieven, toetsenbord, verwijderen, sortering, details, TradingView, CSV en responsive weergave. Geen wijziging aan berekeningen of scancriteria.
- Updatescript en zichtbare frontendversie aangepast naar 0.39.2. Serverinstallatie nog niet uitgevoerd.


## Trading Monitor 0.39.1 — SE-groepering en serverversie (26 oktober 2026)

- Browserregressie met vijf SE-kandidaten: één overzichtsregel met 8,81%; vergrootglas opent exact vier overige spreads, hoogste resterende rendement 4,17%. Sortering op maximale winst houdt de overzichtskandidaat uitgesloten.
- Rode X naast de ticker via toegankelijke naam Verwijder SE bedienbaar; blokkering verwijdert SE uit de scan en toont Deblokkeer SE in de blokkeerlijst. Detail getest op 360–1600 pixels. Bestaande browserworkflow slaagt zonder runtimefouten.
- Productiebuild geslaagd. Screenshots se-best.png en se-alternatives.png staan lokaal in source/data/private/spread-validation/.
- Read-only HTTP-controle van 192.168.1.22: de geleverde bundle index-D7RYZBqu.js bevat de groepering uit 0.39.0 nog niet. Updatescript bleek vastgezet op 0.38.1; vereiste versie en succesmelding aangepast naar 0.39.1. Frontend toont v0.39.1 in de tabelkop. Geen serverinstallatie uitgevoerd.


## Trading Monitor 0.39.0 — beste spread per aandeel (26 oktober 2026)

- TypeScript/Vite-build en 13 frontendtests geslaagd. Alle 207 lokale tests geslaagd. In de eerste parallelle run startten twee API-tests niet binnen hun bestaande korte startvenster; beide afzonderlijk en de daaropvolgende volledige run slagen.
- Browserworkflow met gemockte API: één regel per aandeel, hoogste rendement/risico als standaard, hoogste maximale winst bij omschakelen, laagste verlies als kandidaat bij risico-sortering en behoud van de kandidaat bij omkeren van de weergavevolgorde.
- Vergrootglas via Enter opent alle alternatieven met focus op de detailkop; terugknop herstelt focus. CSV bewaart verborgen alternatieven. Zowel 55 aandelen als 55 alternatieven van één aandeel pagineren correct. Inspectie/sortering start geen extra optiescan.
- Bestaande scan-, zoek-, fout-, stop-/hervat-, TradingView-, sector-, planning- en blokkeerlijstcontroles slagen. Detailweergave getest op 360, 768, 1024 en 1600 pixels; bestaande 200%-zoomcontrole blijft slagen. Geen browserruntimefouten.
- Screenshots in `source/data/private/spread-validation/`: `grouped-stocks.png` en `stock-alternatives.png`, lokaal visueel beoordeeld. Scancriteria en brokerverzameling zijn ongewijzigd. Geen serverinstallatie uitgevoerd.

## Trading Monitor 0.38.1 — volledige scanstappen inklappen (25 oktober 2026)

- `npm run test:frontend`: 13 geslaagd; TypeScript/Vite-build geslaagd. Geen backend- of criteriumwijzigingen.
- `npm run test:spreads`: bestaande workflow geslaagd, aangevuld met beide volledige stappen inklappen, toetsenbord Enter/Spatie, verborgen formulieren/resultaten, zichtbare Option Scan, behoud na herladen en starten van de optiescan met de eerdere stappen dicht. Inklappen/herladen start geen extra scan; eerder ingestelde IV-rank blijft behouden bij opnieuw openen.
- Screenshot `source/data/private/spread-validation/collapsed-steps.png` lokaal visueel beoordeeld. Bestaande responsive/zoom-, planning-, blokkering-, sector-, TradingView- en scancontroles blijven slagen. Geen browserruntimefouten.
- Geen serverinstallatie uitgevoerd.

## Trading Monitor 0.38.0 — automatisch blokkeren (25 oktober 2026)

- 197 scanner-/dashboardtests geslaagd, inclusief negen nieuwe tests voor de screenshotmeldingen, bron-/rechten-/pacinguitval zonder blokkering, blijvende automatische reden/stap, behoud van handmatige blokkeringen, zes ontbrekende IV-reeksen zonder ongewenste pauze en overslaan in een volgende job.
- Stock Filter-test: definitief ontbrekende Yahoo-dagdata zonder bruikbare brokerterugval blokkeren; bronbrede HTTP 429 pauzeert zonder blokkering. Option Scan-test: ontbrekende IV blokkeert, normale niet-passende spreads niet. Geen blokkering op onbekende sector of ontbrekende generic-volumevelden zonder bevestigde instrumentspecifieke oorzaak.
- Reconciliatieproef: oude meldingen verwerkt, beschikbare resultaten inclusief klassealias blijven behouden, deblokkeren overleeft herstart zonder directe herblokkering door de oude melding; nieuwe waarneming kan wel opnieuw blokkeren.
- API-integratie: reeds opgeslagen HMDS-no-data voor AIOK wordt bij processtart geblokkeerd met automatische IV-reden; offline Gateway niet; deblokkeren en tweede herstart laten AIOK gedeblokkeerd.
- 13 frontendtests, productiebuild en browserworkflow geslaagd. Blokkeerlijst toont Automatisch · IV Scan en de reden, met werkende deblokkering. Overige drie-stappen-, sector-, TradingView-, CSV-, responsieve en 200%-zoomcontroles blijven slagen.
- Tests gebruiken geïsoleerde opslag en brokermocks. De echte serverdata en blokkeerlijst zijn niet aangepast; geen GitHub-push of serverinstallatie uitgevoerd.

## Trading Monitor 0.37.1 — TradingView-links (25 oktober 2026)

- TypeScript/Vite-build geslaagd. Bestaande browserworkflow controleert in alle drie de tabellen een link naar `https://www.tradingview.com/chart/fxY1us9e/?symbol=HOOD`, `target=_blank` en `rel=noopener noreferrer`.
- Een echte linkklik in de spreadtabel opent een tweede browserpagina op de verwachte URL; `window.opener` is null en de quote-details van het aangeklikte aandeel klappen daarbij niet onbedoeld open/dicht. TradingView zelf is in deze controle afgevangen met een lokale testpagina; toegang tot de privé-layout is niet getest.
- Bestaande toetsenbord-, tabel-, CSV-, zoek-, inklap-, sector- en responsieve workflow blijft slagen. Geen backendwijziging of serverinstallatie.

## Trading Monitor 0.37.0 — sectorinformatie (25 oktober 2026)

- Acht nieuwe tests voor normalisatie zonder raden op bedrijfs-/industrienaam, één gedeelde bulkaanvraag, persistente cache na herstart, exacte Yahoo-equitymatch, onbekende/negatieve cache, bronbegrenzing, IBKR-terugval en behoud van eerdere koersophaaltijden. Ketenproef bewaart sector van Stock Filter via IV-selectie tot Option Scan; ontbrekende sector weigert geen geldig aandeel.
- `npm test`: 198 tests in de werkmap, inclusief tien reeds aanwezige lokale TradingView-referentietests buiten deze wijziging. Publiceerbare scanner-/dashboardtests: 188. Frontend: 13 tests; TypeScript/Vite-build geslaagd.
- API-integratie vult oudere opgeslagen aandelen-/IV-resultaten aan vanuit een vooraf bewaarde sectorcache; Option Scan krijgt de metadata ook als de oudere IV-rij zelf nog geen sector bevat.
- Browsercontrole: Sectorkolom met Tech/Financials in alle drie de overzichten, onbekende sector als Onbekend, sector/bron/datum in CSV, bestaande collapse-/herlaadworkflow en 360–1600px/200% zoom. Geen browserruntimefouten. Desktop-screenshot visueel gecontroleerd.
- Echte Nasdaq-proef: 6.978 rijen ontvangen in de bulklijst. AAPL, XOM, SOFI en TSLA ingedeeld in één aanvraag; met cacheopslag circa 567 ms. Herladen van de cache levert dezelfde classificatie zonder netwerkaanvraag. Yahoo-zoekendpoint gecontroleerd op beschikbare sectorvelden; IBKR-fallback alleen via mocks en officiële contractvelden, geen echte Gateway-query.
- Nasdaq noemt TSLA in deze bron Industrials; providers kunnen dus verschillen. De code gebruikt de vermelde bronclassificatie en verzint geen handmatige tickeruitzonderingen. Bron en datum staan bij de sectorkolom als tooltip.
- Sectorproefbestanden uitsluitend in `source/data/private/sector-validation/`. Geen serverinstallatie en nog geen GitHub-push.

## Trading Monitor 0.36.1 — inklapbare Stock Filter-resultaten (25 oktober 2026)

- TypeScript/Vite-build en `npm run test:spreads` geslaagd. De bestaande browserworkflow controleert nu ook inklappen via Enter, uitklappen via Spatie, verborgen tabel, blijvende scanteller en beschikbare IV-startknop, onthouden na herladen en behoud van de zoekterm bij dicht/open.
- Standaard blijft de lijst geopend. De browservoorkeur `tm-stock-list-expanded` onthoudt de keuze; zonder browseropslag blijft inklappen werken.
- Bestaande workflow voor drie stappen, blokkeren/deblokkeren, weekplanning, responsieve weergave, 200% zoom en quote-/CSV-bediening blijft slagen. Geen browserruntimefouten. Geen backendwijziging of serverinstallatie.

## Trading Monitor 0.36.0 — drie scans, weekplanning en blokkeren (25 oktober 2026)

- `npm test`: 180 Node-tests in de GitHub-publicatie (190 inclusief tien losse lokale TradingView-referentietests die buiten deze wijziging blijven); `npm run test:frontend`: 13 frontendtests. TypeScript/Vite-build geslaagd.
- Nieuwe pipelineproeven: blijvende blokkeerlijst met klassealias-normalisatie en deblokkeren; onleesbare blokkeerlijst niet overschrijven; geblokkeerde aandelen veroorzaken geen Yahoo-, IBKR- of optiecacheaanvragen; afgeronde Stock Filter gearchiveerd. IV verwerkt alleen de gekozen aandelen, bewaart raw IV-observaties en cursor, sluit ontbrekende data uit en pauzeert na vijf ontbrekende reeksen.
- Brokermock van de echte IV-adapter: alleen STK-quote/generic 106 en `OPTION_IMPLIED_VOLATILITY`-jaarhistorie; geen opties, optiechains of brede broker-scanner. Historische IV-terugval houdt bron/datum; de bestaande IV-cache wordt gedeeld met de optiejob.
- Scheduler met gesimuleerde klok: zondag 09:00 Europe/Amsterdam voor Stock Filter; maandag exact vanaf 09:30 New York IV; gesloten maandag Labor Day uitgesteld naar dinsdag; aparte Amerikaanse/Nederlandse zomertijd (maart 2026). Concurrente ticks, herstart met lopende job, eerdere fout, uitschakelen en ongeldige instellingen starten geen dubbele weekjob. Geen automatische Option Scan.
- API-integratie met geïsoleerde opslag: beide selectie-ID's vereist voor de optiejob, blokkeren/deblokkeren zichtbaar in Stock-/IV-resultaten en bewaard na procesherstart; geen lijstmutatie tijdens een scan; weekinstellingen opslaan; IV starten/stoppen op de Stock Filter; legacy-IV-route kan geen ongefilterde ronde starten. Bestaande Leaps-shortlist en resultaten blijven behouden.
- Browserworkflow `npm run test:spreads`: drie stappen en hun afhankelijkheden, standalone-IV-menu weg, nieuw Stock Filter maakt eerdere IV ongeschikt, aangepast IV-criterium blokkeert stap 3, verwijderen/deblokkeren met herladen, weektijd wijzigen en bewaren, lege/ontbrekende data, stop/hervat, sorteren, CSV en quote-details. 360/768/1024/1600 pixels, licht/donker, toetsenbord en 200% zoom; geen runtimefouten. Desktop/mobiel visueel gecontroleerd.
- Leaps-regressie via `RESEARCH_URL=http://127.0.0.1:5197 npm run test:research`: shortlist toevoegen/verwijderen, bewaren, berekeningen, fout/stop en 360–1440px geslaagd. IV-browserdekking verhuisd naar `test:spreads`.
- Geen echte IBKR-optieaanvragen, datarechtencontrole of serverinstallatie uitgevoerd. Weekplanning is lokaal voorbereid en draait pas op de server na installatie. Bestaande lokale TradingView-bestanden en wijzigingen behouden.

## Trading Monitor 0.35.0 — tweedelige scan (25 oktober 2026)

- `npm test`: 181 Node-tests geslaagd; `npm run test:frontend`: 13 frontendtests geslaagd; `npm run build`: TypeScript en Vite geslaagd.
- Negen nieuwe gerichte tests: dagvolume in aandelen, koersgrenzen, incomplete/stale dagbars, Yahoo-USD/equitycontrole, bronbegrenzing, herfilteren uit cache met oorspronkelijke ophaaltijden, opslag en procesherstart, stoppen/hervatten, ontbrekende data en seriële IBKR-terugval, configureerbare volumeeenheden en een brede selectie van 75 aandelen zonder 50-limiet.
- API-integratietest: geen nieuwe optiescan zonder geldige afgeronde selectie-ID; selectie wordt overgenomen in de optiejob, locks tussen beide stappen, origincontrole, stoppen en herstel na herstart.
- `npm run test:spreads`: beide handmatige stappen, bewaren/herladen, gewijzigde criteria blokkeren optiescan, bronfout met behoud van resultaten, aandelenfilter stoppen/hervatten, lege selectie, zoeken, optiequotes/bedragen, CSV, sorteren, optiehervatten, toetsenbord, licht/donker, 360/768/1024/1600 pixels en 200% zoom. Geen browserruntimefouten. Desktop- en mobiele screenshots visueel bekeken; bestanden uitsluitend in de private validatiemap.
- Echte Yahoo-proef met 20 Amerikaanse aandelen: 20/20 opgehaald, 10 geselecteerd bij $5–$150 en volume ≥ 5.000.000; bronhandelsdag 23 oktober 2026. Eerste filter 3.613 ms, identieke tweede filter 32 ms met 20/20 cachehits. Dit is een lokale steekproef, geen belofte voor duizenden aandelen. Resultaten/cache uitsluitend in `source/data/private/stock-filter-validation/`.
- Echte IBKR-dagvolume-eenheden en datarechten niet geverifieerd; adapter met brokermocks getest. Geen optiescan op de echte rekening en geen serverinstallatie uitgevoerd. Bestaande lokale TradingView-wijzigingen behouden.

## Trading Monitor 0.34.1 — rustige scanweergave (24 oktober 2026)

- `npm run test:frontend`: 13 geslaagd; TypeScript/Vite-build geslaagd. Geen wijziging aan berekeningen, API of scanbeveiliging.
- Bestaande browserworkflow bijgewerkt en geslaagd: scanteller zichtbaar; meegeleverde afwijzing, beoordelingsregio en individuele waarschuwing ontbreken in de pagina. Pauze toont alleen een korte status, zonder technische reden. Passende spreads, CSV, start/stop/hervatten, voorkeuren, paginering, 360–1600px, licht/donker, toetsenbord en 200% zoom blijven werken. Geen browserruntimefouten.
- Screenshots blijven lokaal in de private validatiemap. Geen serverinstallatie uitgevoerd.

## Trading Monitor 0.34.0 — optievolume en standaardcriteria (24 oktober 2026)

- Werkmap: **172 Node-tests** geslaagd (inclusief bestaande lokale referentietests), **13 frontendtests** en TypeScript/Vite-build geslaagd. Geen nieuwe dependencies.
- Nieuwe tests: opgegeven standaardprofiel, configureerbaar minimum gemiddeld optievolume; exacte contracteenheden zonder aandelenmultiplier; echte nul tegenover onbekend; geen gedeeltelijk dagtotaal als call of put ontbreekt; oorspronkelijke cacheophaaltijden en zeven-dagenverval; aparte persistente volumecache en gatewayisolatie.
- Brokermocks verifiëren generic ticks `100,105,106` in één aandelenquote en geen historiedownload/chainaanvraag bij laag, nul of onbekend gemiddeld volume. Bestaande passende-brokertest ontvangt volume en blijft spreads genereren. Historische-IV-tests schakelen het onafhankelijke volumefilter expliciet uit.
- Browsercontrole geslaagd voor nieuwe gemiddelde-/dagvolumekolommen, standaardminimum 5.000 en 40 DTE, naast de bestaande workflow voor brede/eigen modus, CSV, fout/pauze/hervatten, voorkeurherstel, 360–1600px, licht/donker en 200% zoom. Geen browserruntimefouten. Screenshots uitsluitend in private validatiemap.
- Echte live-volumeontvangst/API-abonnementen niet vastgesteld. Geen nulwaarden verzonnen bij ontbrekende data en geen legacy chain zonder volume goedgekeurd bij een actief minimum. Geen serverinstallatie uitgevoerd. Standaardwaarden zijn zoekcriteria, geen bewijs van handelskwaliteit of gerealiseerd rendement.

## Trading Monitor 0.33.1 — ontbrekende IV en Gateway-belasting (24 oktober 2026)

- Werkmap: **166 Node-tests** geslaagd, inclusief bestaande lokale referentietests; **13 frontendtests** en TypeScript/Vite-build geslaagd. Bestaande IV-, Leaps- en CSP-tests behouden. Geen extra dependencies.
- Gerichte tests voor ontbrekende tick-106-IV: één aandelenquote, gebruik van tick-75-slotkoers, daarna IV-jaarhistorie; gedateerde historische IV vóór de chain, geen gefingeerde actuele IV. Historische terugval weigert te oude/korte reeksen en gebruikt tijdens open sessie een eerdere dag.
- Brokermock verifieert één fysieke connectie over meerdere scan-aanroepen, oplopende request-ID’s, listener-cleanup en één fysieke disconnect aan het eind. Persistent herladen van IV-historie voorkomt een nieuwe jaardownload; een volgende open handelsdag gebruikt `10 D` voor een geldige bestaande reeks.
- Vijf opeenvolgende IV-fouten pauzeren de job. Hervatten beoordeelt de mislukte aandelen opnieuw. Wachtrijtest bevestigt 1 s tussen beoordelingen en 20 s na 25 brokerbeoordelingen. Bestaande pacertests voor serialisatie, historiebudget en annuleren slagen.
- Browserworkflow geslaagd voor gedateerde Dag-IV, pauzemelding en hervatten bij `remainingSymbols=0` met een retrycursor. Bestaande brede/eigen modus, tabel, CSV, fouten, start/stop, paginering, lichte/donkere modus, 200% zoom en 360–1600px blijven gecontroleerd. Geen browserruntimefouten.
- Officiële IBKR-documentatie gecontroleerd voor tickbeschikbaarheid, vertraagde versus historische rechten en onderscheid tussen kleine-bar-pacing en zachte throttling voor grotere bars. Het screenshot bewijst geen pacingfout of ontbrekend abonnement. De echte TWS/API-rechten en brokerresultaten zijn vanuit deze omgeving niet vastgesteld. Geen serverinstallatie uitgevoerd.

## Trading Monitor 0.33.0 — breed universum, voorselectie en oude chains (24 oktober 2026)

- Werkmap: `npm test` **161 geslaagd** (inclusief bestaande lokale TradingView-referentietests), `npm run test:frontend` **13 geslaagd**, TypeScript/Vite-productiebuild geslaagd. Geen dependencies toegevoegd.
- Echte Nasdaq Trader-lijsten opgehaald: 3.322 Nasdaq en 2.293 overige gewone aandelen/ADR’s, samen 5.615 unieke namen; bronbestanden met creatietijd `1023202621:31`. Dit controleert het universum, niet de aanwezigheid van bruikbare opties voor elk aandeel. Geen echte brokerquotes of volledige marktbrede IBKR-scan uitgevoerd.
- Brokertest bevestigt nul optiechainaanvragen voor koers- en IV-afwijzingen; koersafwijzing doet ook geen IV-historieverzoek. Bij passende aandelen worden ruwe quotes plus chainmetadata aangeboden aan de persistente cache.
- Nieuwe tests: breed universum met 75 namen zonder shortlistlimiet; gesloten markt herfiltert cache zonder brokerverzoek; onbekende/onbereikbare broker verhindert latere cachehits niet; ontbrekende data blijft expliciet ontbrekend; verlopen puts vervallen, verruimde filters melden cachedekking; cursorstop/hervatten zonder dubbel beoordelen; raw-cacheherstel en gatewayisolatie; bronuitval gebruikt gedateerde universumcache; sessiegrenzen inclusief feestdag en verkorte sessie.
- `npm run test:spreads` geslaagd: brede standaardmodus zonder tickers, eigen modus/IV-overname, zichtbare overslagreden en gesloten-marktstatus, cachelabel, sorteren, zoeken, CSV, start/stop, fouten, voorkeurherstel, paginering en 360–1600px. Donker/licht, 200% zoom en toetsenbordvolgorde gecontroleerd; screenshots lokaal in private validatiemap. Geen browserruntimefouten.
- Geen serverinstallatie uitgevoerd. De eerste lokale chaincache moet nog met beschikbare IBKR-data worden opgebouwd; de scanner kan geen historische bid/ask-chain reconstrueren die nooit is opgehaald. Bron- en ophaaltijden blijven zichtbaar, ook bij hergebruik. Zie [gebruik en beperkingen](put-spreads.md).

## Trading Monitor 0.32.0 — bull-put-spreadscanner (24 oktober 2026)

- `npm test`: **155 geslaagd**; `npm run test:frontend`: **13 geslaagd**; `npm run build`: TypeScript en Vite geslaagd. Geen nieuwe afhankelijkheden.
- Nieuwe domeintests toetsen credit op bied/laat, multiplier 100, max. winst/verlies, break-even, rendement, filters en afwijzing van ongeldige/gekruiste, debet-, verlopen, aangepaste en gemengde contracten. Brokerfixture bevestigt pairing, bounded strikes, checkpoints, één actieve quote en cleanup zonder orderfunctie.
- Echte lokale HTTP-API getest met een onbereikbare testbroker: origincontrole, ticker-/filtervalidatie, wederzijdse scanblokkering, stoppen en herstel van criteria/resultaat na procesherstart. Dit is geen echte IBKR-quotetest.
- `backend/.venv/Scripts/python.exe -m pytest backend/tests -q`: **49 geslaagd**; inclusief GET/POST-proxy voor put-spreads en stop. Eén bestaande Starlette/httpx-deprecatiewaarschuwing.
- `npm run test:spreads`: browserworkflow met expliciete testquotes geslaagd voor IV-overname, start, sorteren, zoeken, bronstatus en tijden, bedragen, CSV-download, voorkeuren na herladen, foutafhandeling en stop. Geen paginaruntimefouten of pagina-overloop bij 360, 768, 1024 en 1600 pixels. Mobiel menu openen/sluiten, toetsenbordvolgorde, 50/5-resultaatpaginering, lichte modus en 200% zoom gecontroleerd; desktop-, mobiele en lichte screenshots visueel beoordeeld.
- Screenshots uitsluitend in genegeerde `source/data/private/spread-validation/`; geen privé- of testkoersen toegevoegd aan openbare appdata. `git diff --check` geslaagd. Bestaande lokale TradingView-wijzigingen behouden.
- Geen echte brokerdata voor deze uitbreiding opgehaald, geen push, externe publicatie of serverinstallatie. Datarechten, echte contractbeschikbaarheid en uitvoerbaarheid van combinatieprijzen blijven op de doelomgeving te controleren. Zie [handleiding en dekking](put-spreads.md).

## Trading Monitor 0.31.8 — breed Martin-universum (16 oktober 2026)

- Officiële Nasdaq Trader-bronnen daadwerkelijk opgehaald: 3.321 Nasdaq en 2.292 overige beursnoteringen, samen 5.613 unieke namen na filtering. Geen vaste-shortlistfallback.
- Marktenginetest met 1.001 fictieve aandelen buiten de oude lijst: stoppen op drie, hervatten zonder dubbele downloads, volledige dekking, automatische watchlists en een nieuwe ronde geheel uit dagcache. Aanvullend getest: directoryvalidatie, ontdubbelen, effectfilters, 429-pauze/hervatten, data-uitval, premarketselectie/-ouderdom en cacheperiode.
- Echte CLI-proef: gestart en gestopt op 30, hervat tot 60 verwerkte namen; 58 beoordeeld, twee data-uitval, resterend 5.553. Geen volledige marktbrede koersdownload geclaimd. De echte API startte zonder tickers met totaal 5.613; stop en hervatstatus werkten. Ongewijzigd rapport wordt bij voortgangspolls niet opnieuw meegestuurd.
- `npm test`: 149 lokale JavaScript-tests geslaagd; de commit bevat 139 tests, afzonderlijk gecontroleerd. `npm run test:frontend`: 13 geslaagd. `npm run build`: geslaagd.
- `npm run test:martin`: brede standaardmodus, eigen-lijstvalidatie, start/stop/hervatten, voortgang, navigatie, zoeken/sorteren, paginering, export, fout/herstel en 360–1440px geslaagd. Mobiele screenshot visueel beoordeeld; geen browserruntimefouten.
- Geen serverinstallatie uitgevoerd. Zie [serverupdate](martin-scanner.md#serverupdate-en-verificatie). Eerste volledige brede run kan geruime tijd duren en blijft afhankelijk van Yahoo-beschikbaarheid; ontbrekende en onvoltooide dekking wordt vermeld.

## Trading Monitor 0.31.7 — Martin-menupagina (16 oktober 2026)

- `npm test`: 140 JavaScript-tests geslaagd in de lokale werkmap; afzonderlijk alle 130 tests van de te pushen Git-bestanden geslaagd. Vier nieuwe servertests controleren dubbel starten, voortgang, opslag/herstart, foutafhandeling en behoud van eerdere resultaten. `npm run test:frontend`: 13 geslaagd. `npm run build`: TypeScript en productiebuild geslaagd.
- `backend/.venv/Scripts/python.exe -m pytest backend/tests -q`: 45 geslaagd, inclusief GET/POST-doorgifte van `/api/martin-scan` via de FastAPI LAN-host. Bestaande Starlette/httpx-deprecationwaarschuwing blijft aanwezig.
- `npm run test:martin`: browserworkflow met fixtures geslaagd voor menu, start, voortgang, navigatie, herstel, lege/partiële resultaten, zoeken, sorteren, downloaden, fouten en 360/768/1024/1440 pixels plus 720px als 200%-zoom-equivalent. Geen browserruntimefouten. Screenshots in de genegeerde `source/data/private/martin-ui-validation/` visueel gecontroleerd.
- Echte Node-API op tijdelijke lokale poort met aparte privéopslag: ongeoorloofde POST 403, ongeldige ticker 400, geldige scan 202. Browserstart haalde twee echte USD-aandelen (NVDA/AMD) bij Yahoo op en toonde beide in de watchlist; geen IBKR-login vereist.
- Update-script controleert versie 0.31.7 en de nieuwe API-route. Geen installatie op de bestaande Linux-server uitgevoerd; zie [serverupdate](martin-scanner.md#serverupdate).

## Martin-selectiescanner (16 oktober 2026, lokaal)

- Zelfstandige CLI, geen webappwijziging: `node scripts/scan-martin.mjs` vanuit `source/`.
- Echte Yahoo-dagdata voor 29/29 tickers verwerkt, peildatum 15 oktober 2026; nul downloadfouten. Premarket 27/29 bruikbare snapshots, twee oude snapshots uitgesloten; geen gapmatches op de ingestelde filters. Focuslijst leeg.
- Markdown, CSV, JSON, ruwe bars en vier TradingView-lijsten aangemaakt in `source/data/private/martin/`. Herimport van 29 reeksen geslaagd.
- `node --test tests/*.test.mjs`: 136 geslaagd, inclusief acht Martin-tests voor trend/ADR, stop, compacte setup, ongeldige data, tijdzone/afgesloten dag, premarket, ranking/thema's, tickers en provideraggregatie.
- Geen rendement/backtest, TradingView-import of serverpublicatie geclaimd. Geen UI- of buildwijziging. Databron en geselecteerde getallen zijn beschreven in [de handleiding](martin-scanner.md).

## Lokale mobiele IBKR-correctie (14 oktober 2026, nog niet gepubliceerd)

- IBKR-bediening op mobiel uit het verborgen menu naar direct onder de paginatitel verplaatst; desktop houdt de bediening in de zijbalk. Er is steeds één bediening gemount.
- 128 Node-tests, 13 frontendtests en TypeScript/productiebuild geslaagd.
- Edge-browsercontrole met API-fixtures op 320/360/390/700/701/768/1024/1440 pixels: bediening zichtbaar, binnen schermbreedte en geen horizontale pagina-overflow.
- Vernieuwen via toetsenbord verstuurt één POST en blokkeert de knop tijdens ophalen; verbonden, offline, fout, ophalen, MFA en ontbrekende service gecontroleerd op mobiel.
- Mobiele weergave visueel gecontroleerd. Echte IBKR-synchronisatie en serverpublicatie zijn niet uitgevoerd.

## Trading Monitor 0.31.6 — automatische IV-blokken (13 oktober 2026)

- 128 lokale Node-tests geslaagd, waarvan 118 voor de te publiceren code. 13 frontendtests, productiebuild en browserworkflow geslaagd.
- Reekstests controleren 25/25/rest, exact 20.000 ms wachttijd per tussenpauze, stoppen tijdens wachten, behoud van resultaten en einde zonder nieuwe ronde.
- Broker-/opslagfouten stoppen vervolgaanvragen; de actieve lijst blijft over middernacht dezelfde cursor volgen.
- API-integratietest controleert automatisch starten en exclusieve optiescan. Opslagtest herstelt een wachtende scan als onderbroken, zonder oude afteller.
- Browserfixture controleert pauzeaftelling, Scan stoppen en Scan hervatten; geen browsergestuurde vervolg-POST nodig. Echte IBKR-data en liveserverinstallatie blijven ongeverifieerd.

## Trading Monitor 0.31.5 — sorteren en prijsfilters (13 oktober 2026)

- 124 lokale Node-tests, 13 frontendtests en productiebuild geslaagd; 114 Node-tests betreffen de te publiceren code.
- Browserfixture controleert IV-rank hoog/laag, inclusieve minimum-/maximumgrenzen, presets, ongeldige range, gefilterd lege resultaten en Filters wissen.
- Sortering en prijsrange blijven na herladen behouden. De fixture bevestigt dat sorteren en filteren geen extra scan-POST versturen.
- Visuele desktopcontrole en overflowcontrole op 360/768/1024/1440 pixels geslaagd. Leaps- en scanopslagworkflow blijven slagen.

## Trading Monitor 0.31.4 — scanopslag en hervatten (13 oktober 2026)

- 124 lokale Node-tests geslaagd, waarvan 114 voor de te publiceren code en tien bestaande lokale referentietests. 13 frontendtests, productiebuild en browserworkflow geslaagd.
- Storetests controleren herladen via een nieuwe store, lopend naar onderbroken, exacte IV-cursor, quote-ophaaltijden, opeenvolgende atomische writes en onleesbare/verkeerde-Gatewaybestanden.
- API-integratietest herstart het echte Node-proces en controleert de teruggezette IV-/Leaps-resultaten. Eerdere resultaten blijven bewaard na een nieuwe scan zonder opbrengst en na een tweede herstart.
- Brokerfixture schrijft echte IV-checkpoints en hervat met een nieuwe Gateway guard zonder al gecontroleerde aandelen opnieuw te verwerken.
- Browserfixture controleert teruggezette resultaten, opslagmelding en Volgende 25 scannen. Geen live brokerdata of serverupdate uitgevoerd.

## Trading Monitor 0.31.3 — calculatorvelden (13 oktober 2026)

- 121 lokale Node-tests geslaagd, waarvan 111 voor de te publiceren code en tien bestaande lokale referentietests. 13 frontendtests, productiebuild en browserworkflow geslaagd.
- Rekentest reproduceert de drie aangeleverde voorbeelden: −2,89% / 0,50% / 26,32%; −10,54% / 1,49% / 11,84%; −16,82% / 3,70% / 9,86%, met de in de afbeelding vermelde DTE.
- Ongeldige prijzen, nul-DTE en strike gelijk aan premie worden afgewezen. Netto-calculatorrendement blijft gescheiden van de bestaande volledige-onderpandvergelijking.
- Browserfixture controleert de drie kolomtitels en de getoonde percentages; geen extra IBKR-aanvragen voor deze berekeningen.

## Trading Monitor 0.31.2 — aandelenlijsten zonder IBKR-marktscanner (13 oktober 2026)

- 120 lokale Node-tests geslaagd, waarvan 110 voor de te publiceren code en tien bestaande lokale TradingView-referentietests. 13 frontendtests, TypeScript/Vite-build en browserworkflow geslaagd.
- Broncontrole via de Node-runtime: S&P 500 en Nasdaq-feeds bereikbaar; 3.726 unieke tickers, beide bronnen en geen waarschuwingen. Dit verifieert de tickerlijsten, niet IBKR-koersen of IV.
- Nieuwe tests controleren tickerfilters, deduplicatie, bronuitval, ongeldig/onvolledig formaat, 25-aandelenblokken, hervatten, eerdere matches behouden en nul IBKR-scannersubscriptions in IV Scan.
- Een aandeel zonder actuele IV wordt overgeslagen voordat historische data worden aangevraagd; ontbrekende data worden expliciet gemeld.
- Browserfixture controleert Volgende 25 scannen en de dekkingsindicator. Geen echte IBKR-login of liveserverupdate uitgevoerd.
- Cursor en resultaten staan in het Node-procesgeheugen; nieuwe beursdatum of API-herstart begint een nieuwe ronde. De Leaps-shortlist blijft op schijf.

## Trading Monitor 0.31.1 — rustige IBKR-scans (13 oktober 2026)

- Node-suite: 117 tests geslaagd, waarvan 107 voor de te publiceren code en tien reeds aanwezige lokale TradingView-referentietests. 13 frontendtests en productiebuild geslaagd.
- Nieuwe tests bewijzen requestspreiding, historiebudget, identieke aanvragen, één actieve quote, hergebruik van IV-historie, onthouden van disabled scanners, stoppen na pacingfouten en annuleren van actieve brokerrequests.
- API-test controleert de stoproute; browserworkflow controleert Scan stoppen naast shortlist, resultaten, fouten en responsive weergave.
- Wachtrij geldt voor de optiescans in de Node-service, niet voor andere API-processen of TWS. Cache en disabled-scannergeheugen zijn leeg na API-herstart; de handmatige shortlist blijft op schijf.
- Disabled scannertypes op de echte IBKR-installatie blijven een beschikbaarheidsprobleem. Geen echte brokerlogin of serverupdate uitgevoerd.
- [Werking, bronnen en update](iv-leaps.md).

## Trading Monitor 0.31.0 — IV Scan en Leaps (13 oktober 2026)

- 101 Git-gevolgde Node-tests inclusief zeven nieuwe tests geslaagd. De volledige lokale suite bevat daarnaast tien reeds aanwezige, ongepubliceerde TradingView-referentietests: 111 tests geslaagd.
- 13 Vitest-frontendtests en 43 pytest-backendtests geslaagd; één bestaande Starlette/httpx-deprecatiewaarschuwing.
- TypeScript/Vite-productiebuild geslaagd; bouwuitvoer uitsluitend in source/dist.
- Browserworkflow met expliciete marktdatafixtures geslaagd op 360, 768, 1024 en 1440 pixels: menuvervanging, shortlisttoevoegen/-verwijderen, verversen, vergelijkingsresultaten, filters en API-fouten; geen browserfouten of pagina-overflow.
- API-integratietest bevestigt atomisch shortlistopslaan, invoervalidatie, origincontrole, behoud na API-herstart en exclusieve optiescans.
- Brokerfixtures bevestigen IV-rankfilter, geen $10–$50-koersgrens in IV Scan, alleen de handmatige lijst in Leaps, vergelijking en opruimen van marktdata-abonnementen.
- Geen echte IBKR-login of marktdata geverifieerd en geen liveserverupdate uitgevoerd. Het Linux-updatescript is geleverd, maar lokaal op Windows niet uitgevoerd.
- [Gebruiks- en updatehandleiding](iv-leaps.md). Testcommando's worden vanuit source uitgevoerd.

## 12 oktober 2026 — aanvullende scanneracceptatie 0.30.0

- 43 pytest-tests geslaagd, waaronder zes deterministische setupfixtures, dubbele bars, CSV, filters, disconnected/cached-herstart, health en verbod op orderfuncties in de scanner. Eén deprecation warning uit Starlette/httpx; geen testfouten.
- 13 Vitest-tests geslaagd, inclusief alle vijf Nederlandse statuslabels; 94 Git-gevolgde Node-regressietests geslaagd.
- TypeScript/Vite-productiebuild geslaagd. Playwright-smoketest geslaagd op desktop en 390px mobiel met echte FastAPI/SQLite, testbroker, CSV-import, synchronisatie, filtering, sortering en details/chart.
- Productie gestart met npm run serve:lan op 0.0.0.0:8000. Health en scannerpagina opnieuw gecontroleerd via localhost en 192.168.1.48. Geen productie-demodata of automatische brokerfallback.
- Documentatie SETUP_LOGIC.md, IBKR.md en DEPLOYMENT.md toegevoegd; brokerinterface expliciet gemaakt. Echte IBKR-verbinding, tweede fysiek LAN-apparaat en installatie op 192.168.1.22 blijven onbevestigd.

## Versie 0.27.2 — koers- en scannerterugval (lokaal)

- `npm test`: 84 van 84 tests geslaagd; TypeScript- en Vite-productiebuild geslaagd.
- Nieuwe tests simuleren ontbrekende reguliere quotes met beschikbare bevroren data, een uitgeschakelde IV-scanner met MOST_ACTIVE-terugval, specifieke HTTP-startfouten en foutcategorieën zonder afgewezen tickers.
- Serverdiagnose: GET status bevestigt verbonden IBKR; GET scans werkt; POST scans wordt via shell én browser geaccepteerd. De eerdere browser-startfout is niet opnieuw opgetreden.
- De huidige productiescan meldt ontbrekende aandelenkoersen en IBKR-code 162: HIGH_OPT_IMP_VOLAT-scanner uitgeschakeld. Versie 0.27.2 is hiervoor lokaal verbeterd, maar de correctie is nog niet op de productieserver geïnstalleerd of met echte bevroren quotes bevestigd.

## Versie 0.27.1 — uitsluitend passende scanresultaten (lokaal)

- `npm test`: 81 van 81 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.
- Nieuwe regressietest bevestigt dat afgewezen IVR/POP, ontbrekende delta, verlopen contracten en een te hoge marktkoers niet in de zichtbare resultaten terechtkomen.
- Voortgang en portfoliosamenvatting bevatten geen onderzochte tickers; datameldingen tonen uitsluitend het aantal meldingen.

## Resultaat 11 oktober 2026 — versie 0.27.0 (lokaal)

- `npm test`: 80 van 80 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd. JavaScript-syntax van API en scanner gecontroleerd.
- CSP-tests controleren inclusieve DTE 35/50 en koers 10/50, strikte POP/IVR-grenzen, ontbrekende data, negatieve putdelta, premie/onderpand/rendement, jaarhistorie en sortering.
- Gesimuleerde Gateway-integratie controleert portfolio vóór marktverkenning, uitsluiting van bestaande symbolen en niet-S&P-aandelen, deltafilters, quote-opruiming en socketafsluiting.
- Browser: donkere modus, wisselen naar licht, onthouden na herladen, Scans-navigatie, API-fout en scanvoortgang getest. Op 360 en 768 pixels geen horizontale pagina-overflow gemeten.
- Echte lokale API gestart; starten van een scan retourneert actieve status en eindigt bij ontbrekende Gateway met een zichtbare fout en herstartmogelijkheid. Er zijn geen echte marktdataresultaten bevestigd: lokale Gateway op poort 4001 is niet beschikbaar.
- Live IBKR-datadekking, Greeks, IV-historie, werkelijke kandidaten en installatie op de productieserver moeten nog worden gecontroleerd op de verbonden Gateway. De NASDAQ/S&P-verkenning is een begrensde shortlist.

## Resultaat 7 oktober 2026 — versie 0.26.3 (lokaal)

- Regressietests reconstrueren openingsdatum, gewogen gekozen DTE en openingspremie van nieuwe Gateway-posities na de Flex-grens.
- Een gedeeltelijke FIFO-sluiting laat uitsluitend het resterende openingslot meetellen; een positie zonder complete uitvoeringhistorie blijft onbekend.
- Integratietest controleert dat de gereconstrueerde gegevens daadwerkelijk op de Options-pagina terechtkomen zonder nieuwe Flex-import.
- `npm test`: 74 van 74 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.

## Resultaat 6 oktober 2026 — versie 0.26.2 (lokaal)

- Regressies controleren winst en verlies op gekochte opties, waardeloze expiratie en een synthetic waarvan beide legs in dezelfde resultaatperiode sluiten.
- Gesimuleerde Gateway-sluitingen controleren dat ook een actuele long-optiesluiting in maand, jaar en maandgemiddelde terechtkomt.
- De private Flex-import is opnieuw berekend; de basis t/m 2 oktober 2026 geeft een gerealiseerd jaarresultaat van `$ +7.715,02`, gelijk aan de som van de getoonde maandresultaten uit alle afgesloten optielegs plus aandelenverkopen.
- `npm test`: 72 van 72 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.

## Resultaat 5 oktober 2026 — versie 0.26.1 (lokaal)

- Kalendertests controleren pre-market vanaf 04:00 ET, slotcontrole om 16:00 ET, Amerikaanse zomer-/wintertijd, weekenden, NYSE-feestdagen in 2026–2028 en vroege sluiting om 13:00 ET.
- De geplande service gebruikt uitsluitend de lokale beveiligde refreshroute; hij bevat geen IBKR-inloggegevens en kan IB Key niet automatisch goedkeuren.
- `npm test`: 72 van 72 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.
- Systemd-units en installatie-/controlecommando's zijn toegevoegd; live-installatie op de server staat nog open.

## Resultaat 5 oktober 2026 — versie 0.26.0 (lokaal)

- De aangeleverde Flex YTD-bronnen van 2026 zijn verwerkt: saldo en trades lopen t/m 2 oktober, de dashboardmaand is oktober en de Gateway-overlapgrens staat op 2 oktober.
- De gegenereerde basis toont oktober als actuele maand; volgende Gateway-uitvoeringen worden vanaf de nieuwe overlapgrens zonder dubbeltelling toegevoegd. Exacte portefeuillebedragen blijven buiten Git.
- Regressiesnapshot van 5 oktober 2026 controleert dat **Deze maand** oktober toont en september naar **Vorige maand** schuift.
- Dezelfde synchronisatie verwerkt een gerealiseerde optiesluiting en aandelenverkoop in maand, jaar, gemiddelde, premie, maandgrafiek, saldohistorie en het actuele doel.
- `npm test`: 68 van 68 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.
- Live-publicatie en controle tegen de eigen IBKR Gateway staan nog open.

## Resultaat 2 oktober 2026 — versie 0.25.1 (lokaal)

- De werkelijke lokale bron is gereproduceerd: saldohistorie t/m 24 september 2026, laatste Flex-trade op 23 september 2026. De oude overlapgrens sloot daardoor Gateway-mutaties van 24 september ten onrechte uit.
- `npm run import:flex` schrijft nu 23 september 2026 als `tradesThroughDate`; de private samenvatting is opnieuw gegenereerd.
- `npm test`: 67 van 67 tests geslaagd. Nieuwe regressies controleren zowel de berekende overlapgrens als een Gateway-sluiting op de daaropvolgende saldodag.
- `npm run build`: TypeScript- en Vite-productiebuild geslaagd. Live-publicatie en controle tegen de eigen IBKR Gateway staan nog open.

## Resultaat 30 september 2026 — versie 0.25.0 (lokaal)

- `npm test`: 65 van 65 tests geslaagd. TypeScript/Vite-productiebuild geslaagd; `git diff --check` zonder whitespacefouten.
- Gesimuleerde Gateway controleert de rekeningfilter zonder clientfilter, wachten op uitvoeringen en later ontvangen commissies, en weigeren van afgebroken uitvoeringsdownloads.
- Regressies voor twee rolls, gedeeltelijke sluitingen, heropenen dezelfde dag, opgeslagen historie, herhaalde refresh, uitvoeringscorrecties, latere Flex-overlap, ontbrekende openingsgegevens en IBKR-sentinelwaarden.
- React/TypeScript-integratie controleert dat Gateway-sluitingen in de portefeuille en handelsaantallen verschijnen en bij herladen niet verdubbelen.
- De eigen IBKR Gateway is in deze omgeving niet getest. Serverpublicatie, Master API client ID en zichtbaarheid van de twee werkelijke rolls moeten na installatie worden gecontroleerd; geen live-publicatie geclaimd.

## Resultaat 30 september 2026 — versie 0.24.0

- `npm run import:flex`: lokale Flex-import geslaagd; de nieuwe maandreeks is opgenomen in de gegenereerde private samenvatting.
- `npm test`: 55 van 55 tests geslaagd. `npm run build`: TypeScript en Vite-productiebuild geslaagd. `git diff --check`: geen whitespacefouten.
- Regressie controleert dat maandresultaten dezelfde sluitingsdatum, kosten en peildatum gebruiken als het jaarresultaat; toekomstige transacties blijven uitgesloten en de som van maanden sluit aan op het jaarresultaat.
- React-rendercontrole: jaardoel zonder inleg verzint geen jaarschema; een oud doel past niet op een nieuwjaarsaldo; historische netto-premie blijft zichtbaar; oude JSON zonder maandreeks geeft een herimportmelding.
- Lokale browsercontrole: dashboard, jaarkeuze 2025/2026, navigatie naar Stocks, Options, Goals, Stats en Trades; mobiele weergave op 390 × 844 en desktopweergave. Positieve maandbalken zijn groen, negatieve rood.
- De liveserver is bereikbaar maar SSH-aanmelding via de huidige omgeving is geweigerd. Publicatie op de server wordt door de gebruiker via PuTTY uitgevoerd; geen live IBKR-refresh of serverpublicatie geclaimd.

## Resultaat 28 september 2026 — live saldoverandering (lokaal)

- `npm test`: 53 van 53 tests geslaagd. `npm run build`: TypeScript en productiebuild geslaagd.
- Getest: live bedrag/percentage, recentere referentie, meerdere updates, dezelfde rapportdag, ontbrekende referentie, nulbasis, dagwissel, herstart en verschillende valuta.
- React-rendercontroles verifiëren bedragen, percentages, datums en bronlabels. Geen nieuwe visuele browsercontrole of live IBKR-aanvraag uitgevoerd.
- Nog niet gepubliceerd; backendupdate vereist herstart van `trading-monitor-api.service`.


## Resultaat 27 september 2026 — versie 0.23.1

- `npm test`: 49 van 49 tests geslaagd. `npm run build`: geslaagd.
- React-renderregressie: saldo 86.097,12 tegenover jaardoel 119.204,50 toont een gevulde balk van 72,2%, terwijl het negatieve rendement na inleg afzonderlijk behouden blijft.

## Resultaat 27 september 2026 — versie 0.23.0

- `npm test`: 48 van 48 tests geslaagd. `npm run build`: TypeScript en productiebuild geslaagd.

- Regressies voor herhaalde en afsluitende IBKR-updates, behoud van koersreferenties, ontdubbeling van oude snapshots, OCC-expiratie en ongeldige datums.
- Integratietests laden de echte TypeScript/React-modules via Vite: beide laadvolgordes, herladen, oude snapshots, valuta, actuele aantallen, dagpercentage en Goals-jaarovergang.
- EAE-aandelenlevering plus verkoop op dezelfde dag gecontroleerd via zowel het realisatieregister als de volledige Flex-import. Geen fantoompositie achteraf.
- Nettoverdeling gecontroleerd met negatieve verplichtingen en negatieve cash; de bedragen tellen op tot de netto liquidatiewaarde.
- Alle twaalf lokale XML-bronnen opnieuw geïmporteerd. Privébronnen, financiële JSON en bouwuitvoer blijven buiten Git.
- Browsercontrole met de bestaande IBKR-snapshot en bewust 1,5 seconde vertraagde Flex-response: het actuele saldo blijft behouden. Dashboard toont zeven open posities; SOFI-expiratie is 23 oktober 2026. Er zijn geen orders of nieuwe IBKR-synchronisaties gestart.
- Dashboard visueel gecontroleerd op desktop en bij een viewport van 390 pixels; geen horizontale pagina-overloop. Options, Goals, Stats en Trades gecontroleerd op labels, datums en waarden. Browserconsole zonder fouten.

Publicatie op de Linux-server vereist naast import/build ook een herstart van `trading-monitor-api.service`, omdat de eventverwerking in de backend is gewijzigd.

## Resultaat 27 september 2026 — versie 0.20.0

- `npm test`: 31 van 31 tests geslaagd. De nieuwe regressies controleren sluitingsmaand/jaargrens, open posities, gedeeltelijke FIFO-sluitingen, rolls, gekochte calls, aandelen/ETF-verkopen, CC/CSP-assignment, expiratie, dubbele OptionEAE-events, uitoefening en commissies.
- `npm run import:flex`: alle negen beschikbare lokale jaarbronnen opnieuw verwerkt; alle gerealiseerde posities hebben bijbehorende openingshistorie.
- Onafhankelijke controle op de lokale bronnen: bij 444 volledig gesloten contracten/aandelenposities is de som van de resultaten gelijk aan de volledige transactiekasstroom inclusief commissies (tolerantie $ 0,001).
- Jaarresultaat gecontroleerd tegen het realisatieregister. De JSON in de productiebuild is identiek aan de opnieuw geïmporteerde samenvatting.
- `npm run build`: TypeScript-controle en Vite-productiebuild geslaagd.
- Deze wijziging is functioneel en via de build gecontroleerd; er is geen nieuwe visuele browsercontrole uitgevoerd.
- Ruwe XML, gegenereerde financiële JSON en tijdelijke bouwuitvoer blijven lokaal en buiten Git.

## IBKR-koppeling

- De backend bindt alleen aan `127.0.0.1`.
- Een POST-opdracht vereist dezelfde toegestane origin en de applicatieheader.
- De systemd-unitnaam komt uitsluitend uit de serverconfiguratie en wordt gevalideerd.
- De backend gebruikt geen shell voor het starten van Gateway.
- De browser ontvangt geen IBKR-rekeningnummer, gebruikersnaam of wachtwoord.
- De snapshot wordt atomair met bestandsmodus `0600` opgeslagen.
- Er is geen orderfunctionaliteit aanwezig.
- Een tweede refresh wordt genegeerd zolang de eerste nog loopt.
- De normalisatie van netto liquidatiewaarde, positie-P/L, optiecontractgegevens, dagelijkse koersbeweging en strategieherkenning wordt met unit-tests gecontroleerd.

De eerste versie wordt gecontroleerd met:

- parser-tests via `npm test`;
- strikte TypeScript-controle en productiebuild via `npm run build`;
- visuele controle op breed desktopformaat en compacte mobiele breedte;
- controle van het lokale gegenereerde JSON-bestand tegen de bronwaarden.

## Resultaat 26 september 2026

- `npm test`: 16 van 16 tests geslaagd, inclusief meerjarige deduplicatie, referentiemaanden, jaardoelberekening, IBKR-snapshotnormalisatie, optiecontractgegevens, synthetische strategieherkenning, dagelijkse koersbeweging, covered-call-dekking en CSP-reservering.
- `npm run build`: geslaagd met TypeScript 7 en Vite 8.
- Meerjarige XML-import: 453 unieke dagsaldi, 1.430 unieke trades en 156 optie-events uit zes lokale jaarbronnen verwerkt.
- Desktopweergave: visueel gecontroleerd in de lokale browser.
- Browserconsole: geen fouten of waarschuwingen.
- Compacte weergave: responsieve kaartopmaak en begrensde horizontale tabelscroll zijn op een gesimuleerde viewport van 768 pixels gecontroleerd.
- Jaargrafiek: januari–september 2026 met bronwaarden gecontroleerd; oktober–december tonen expliciet dat data ontbreekt en alle twaalf maandbedragen van 2025 staan als grijze referentiebalken op dezelfde schaal.
- Opgeschoonde jaargrafiek: samenvattingsbalk en uitklapbare maandtabel zijn niet meer aanwezig.
- Vereenvoudigde dashboardkop: bovenlabel en toelichtingszin zijn niet meer aanwezig; titel en gegevensstatus blijven uitgelijnd.
- Optieactiviteit: 181 tradecycli, 171 gesloten en 10 open; 167 gesloten cycli hebben een meetbare looptijd.
- Premies: YTD en de huidige/vorige rapportmaand gecontroleerd tegen de sommen uit het Flex-tradesrapport.
- Schone browsercontrole na de dashboarduitbreiding: geen fouten of waarschuwingen.
- Valutaweergave: saldo, winst, jaargrafiek en premiegegevens tonen uitsluitend het `$`-teken, zonder uitgeschreven valutacode.
- Compacte statistiekkaarten: visueel gecontroleerd op brede, middelgrote en mobiele viewport; geen horizontale pagina-overflow en geen consolewaarschuwingen.
- Overzichtsraster: gelijke buitenranden met Jaarverloop en een sluitende kaartverdeling gecontroleerd op brede, middelbrede en compacte weergave.
- Portefeuilleverdeling: bronberekening, percentages, toegankelijk tekstalternatief, brede plaatsing naast Saldo en mobiele stapeling gecontroleerd.
- Compactere verhoudingen: begrensde kaartbreedtes en kleinere typografie op 1920 en 768 pixels gecontroleerd, zonder horizontale overflow.
- Dagelijkse W&V: `$ +32,55` en `+0,04%` gecontroleerd tegen de laatste twee beschikbare handelsdagsaldi; de kaart staat tussen Saldo en Portefeuilleverdeling en de donut bevat geen dubbele dagwaarde meer.
- Semantische kleuren: positieve resultaten en opbrengsten groen; negatieve resultaten, terugkoop, commissie en negatief nettoresultaat rood.
- Stocks-pagina: vijf open posities, FIFO-aankoopwaardes en CC-dekking gecontroleerd; lege koersvelden, lege toestand, desktopweergave en mobiel begrensde tabelscroll getest.
- Dagbeweging: positieve, negatieve, ongewijzigde en ontbrekende waarden hebben een expliciete tekstuele weergave; de vorige slotkoers blijft read-only en ontbrekende data wordt niet als nul geïnterpreteerd.
- Options-pagina: 10 open posities en 37 contracten uit de huidige Flex-data gecontroleerd; strike, expiratie, openingspremie, gekozen en resterende DTE worden correct getoond.
- Strategieherkenning: de gekoppelde long call en short put op dezelfde OUST-strike en expiratie worden beide als `SYNT long` gemarkeerd.
- Strategiepresentatie: synthetische combinaties gebruiken naast het label een Fluent-samenvoegicoon, een amberkleurige strategie-accentlijn en een toegankelijke tekstuele aanduiding.
- Options-layout: alle kolommen passen op breed desktopformaat; op 768 pixels blijft de pagina zelf begrensd en scrolt uitsluitend de tabel horizontaal.
- CSP-reservering: alle open short puts, inclusief de synthetische short-putleg, reserveren strike maal 100 maal contractaantal; compacte IBKR-contractnamen leveren een veilige strike-fallback.
- Vrij te besteden: saldo minus actuele aandelenwaarde minus CSP-reservering; het Dashboard verplaatst dezelfde reservering van Geld / overig naar Opties.
- Goals-resultaat 2025: startsaldo `$ 35.772,47`, 30% rendement `$ 10.731,74`, jaarlijkse inleg `$ 12.000,00`, doel `$ 58.504,21`, eindresultaat `$ 82.465,00` en verschil `$ +23.960,79` gecontroleerd tegen de gegenereerde brondata.
- Goals-berekening 2026: startsaldo `$ 82.465,00`, 30% rendement `$ 24.739,50`, jaarlijkse inleg `$ 12.000,00` en jaardoel `$ 119.204,50` gecontroleerd tegen de gegenereerde brondata.
- Goals-layout: vier compacte bronkaarten, een semantische voortgangsbalk, voor/achter-schema-indicator en vijfjarenplanning visueel gecontroleerd in de bestaande dashboardstijl.
- Trades-import: 404 afgesloten optiecycli gevonden: 14 gesloten in 2024, 219 gesloten in 2025 en 171 gesloten in 2026.
- Trades-jaarkeuze en paginering: 2025 toont 219 trades op vijf pagina's en 2026 toont 171 trades op vier pagina's, steeds maximaal 50 regels en met toegankelijke vorige-, volgende- en paginanummerknoppen.
- Trades-berekening: netto cashflow inclusief commissies, rendement op openingspremie en lineaire jaaromrekening gecontroleerd met een gesloten short-puttest.
- Trades-layout: numerieke kolommen rechts uitgelijnd, semantische winst/verliesweergave en uitsluitend tabelscroll op compacte breedtes.
- Stats 2026: 171 afgesloten trades, 84,8% winratio, `$ +6.155,29` nettoresultaat, `$ +36,00` gemiddeld per trade, profit factor 1,42 en 13,1 dagen gemiddelde looptijd gecontroleerd.
- Stats 2025: 219 afgesloten trades, 83,1% winratio, `$ +19.439,52` nettoresultaat, `$ +88,76` gemiddeld per trade, profit factor 1,83 en 8,4 dagen gemiddelde looptijd gecontroleerd.
- Dashboard-scope 2026: 171 afgesloten trades en 10 actuele open posities leveren 181 totaal; premiebehoud 25,0%, `$ 39.981,00` ontvangen brutopremie en 13,1 dagen gemiddelde looptijd zijn uitsluitend uit 2026 berekend.
- Gerealiseerd maandresultaat september 2026: premie `$ -490,21`, aandelenverkopen `$ 0,00` en gesloten SYNT `$ +1.984,52` leveren samen `$ +1.494,31`.
- Gerealiseerd maandresultaat augustus 2026: premie `$ +2.665,70`, aandelenverkopen `$ 0,00` en gesloten SYNT `$ +1.771,57` leveren samen `$ +4.437,27`; een aparte regressietest voorkomt dubbeltelling van de korte synthetische leg.
- Stats-jaarkeuze: kerncijfers, maandgrafiek, winst/verliesdonut, grootste resultaatimpact en looptijdverdeling wisselen tussen 2024, 2025 en 2026 en openen standaard op 2026.
- Portefeuilleverloop: 26 werkelijke maandeindsaldi van augustus 2024 tot en met september 2026 verwerkt; de grafiek opent op 2026 en de filters 2024, 2025, 2026 en Alles veranderen uitsluitend deze historische grafiek.

## Versie 0.21.0 — totale winst

- 32 tests geslaagd, inclusief startsaldo op de jaargrens, eerste beschikbare dag in 2025, nul en ontbrekende startgegevens.
- Flex-import, TypeScript-controle en productiebuild geslaagd.
- Kaart in de browser gecontroleerd op desktop en mobiel; geen horizontale pagina-overloop of afgeknipte kaarten op 1720, 1400, 1024, 768 en 360 pixels. Geen browserfouten of waarschuwingen tijdens de controle.
- Het actuele saldo wordt rechtstreeks uit dezelfde state gelezen als de Saldokaart, zodat een live update automatisch doorwerkt.

## Versie 0.21.1 — uitsluiting gekochte opties

- 33 tests geslaagd; expliciete regressies voor winst én verlies op gekochte opties, inclusief maand- en jaarafbakening.
- Import en TypeScript/Vite-build geslaagd. De maandkaarten bevatten uitsluitend premie en aandelen; jaarresultaat en maandgemiddelde gebruiken dezelfde selectie.

## Versie 0.21.2 — centrering

- Dashboardkaarten in de browser gecontroleerd op 1720, 768 en 360 pixels. De inhoud heeft per kaart gelijke ruimte boven en onder; geen horizontale pagina-overloop.
- 33 bestaande tests en de TypeScript/Vite-build geslaagd. Alleen uitlijning gewijzigd.

## Versie 0.22.0 — inleg en rendement

- 38 tests geslaagd, inclusief valutauitsplitsing zonder dubbeltelling, gelijke stortingen, opnames, cumulatieve rapportvervanging, ontbrekende jaarhistorie, verschillende peildatums en doelen bij extra inleg.
- Alle twaalf lokale XML-bronnen opnieuw geïmporteerd; jaartotalen gecontroleerd tegen de aangeleverde Cash Reports. Productie-JSON is gelijk aan de geïmporteerde samenvatting.
- TypeScript/Vite-build geslaagd. Dashboard en Goals gecontroleerd in de browser; geen horizontale pagina-overloop op desktop, tablet en mobiel (1720, 1024, 768 en 360 pixels voor Goals). Geen browserfouten tijdens de controle.
- Stortingsbestanden zijn uitgesloten van Git. De huidige winst is expliciet voorlopig omdat saldo- en inlegpeildatum één dag verschillen.

## Breakout-scanner 0.28.0 — 12 oktober 2026

- Detectiekern en echte HTTP-API getest, inclusief origin-/configvalidatie en foutmelding bij onbereikbare Gateway.
- Browsercontrole met echte lokale API voor laden/validatie; geïsoleerde OHLC-testfixtures voor resultaten, details, sortering, filters, zoeken en CSV. Desktop 1440 px en mobiel 390 px gecontroleerd, inclusief menubediening en geen pagina-overloop. Geen browserexceptions.
- Tests en TypeScript/Vite-productiebuild geslaagd. Reproduceerbare browsercontrole: `node scripts/verify-breakout-browser.mjs` vanuit source (Playwright en Edge vereist).
- Geen live marktdata of installatie op 192.168.1.22 bevestigd. Verspreiding via GitHub; serverupdate met `bash deploy/update-breakout.sh`. Zie [handleiding](breakout-scanner.md).

## Breakout 0.29.0 — 12 oktober 2026

- 24 pytest-tests geslaagd: analyse, cache/contractopslag, incrementele updates, per-symbol failure/retry, corporate-actioncontrole, annulering/shutdown, paper/read-only, reconnect, pacing, bounded backoff en echte FastAPI-routes.
- Zeven Vitest-tests en 94 bijgehouden Node-regressietests geslaagd; TypeScript/Vite-build geslaagd en npm audit meldt nul kwetsbaarheden.
- Playwright met echte React → HTTP → FastAPI → SQLite → Python-analyse, uitsluitend testbroker in tests.smoke_server. CSV-upload, JSON-validatiefout, scannen, setupdetails/chart, sortering, filters, zoeken, export en 390px-menubediening gecontroleerd. Desktop/mobiel geen pagina-overflow of browserexceptions. Test weigert een productiebackend zonder testheader.
- Lokale productiemodule heeft geen fictieve datafallback. Live IBKR en serverinstallatie nog niet bevestigd; GitHub-updateprocedure en Python 3.12+-vereiste gedocumenteerd. Eén Starlette TestClient-deprecatiewaarschuwing voor httpx, geen testfalen.
- [Architectuur, API en databeperkingen](breakout-python.md).

## Breakout 0.30.0 — 12 oktober 2026

- 32 pytest-tests en zeven Vitest-tests geslaagd; 94 bestaande Node-tests behouden. Extra tests voor API-contract, instellingen/pacingpersistente herstart, structured errors, detailroutes/ambiguïteit, alle returnperioden, basisduur, MA-/contractieregels, pivotlows/tolerantie, ontbrekende sessies en read-only env.
- Playwright: echte CSV/HTTP/SQLite/analyseflow, checklist, detail-/bars-API, bedrijfsnaamzoeken, uitgebreide tabel en responsive grafiek. Productiebuild geslaagd.
- Productiecommando gestart op 0.0.0.0:8000; frontend, scanner-API en portefeuilleproxy bereikbaar via localhost en eigen 192.168.1.48 LAN-adres, browser gecontroleerd. Ontwikkel/demo-start gecontroleerd met expliciete DEMO-labels. Geen tweede fysiek LAN-apparaat, live IBKR of installatie op 192.168.1.22 bevestigd.
- Systemd alleen handmatig; updateprocedure vraagt vooraf geïnstalleerde service. Zie [LAN/API-handleiding](breakout-lan.md).
