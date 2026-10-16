# Validatie

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
