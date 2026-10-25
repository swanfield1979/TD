# Versiehistorie

## 0.36.0 — drie stappen, weekplanning en blokkeerlijst (25 oktober 2026)

- Put spreads bevat Stock Filter → IV Scan → Option Scan. IV onderzoekt uitsluitend de opgeslagen aandelenvoorselectie en vraagt geen opties of broker-marktscanner aan. De optiejob vereist een afgeronde IV-selectie van dezelfde Stock Filter. Het losse IV-menu is verwijderd; oude `#iv`-/`#breakout`-links openen Put spreads.
- Stock- en IV-selecties zijn maximaal zeven dagen bruikbaar; bron-/ophaaltijden blijven zichtbaar. Ruwe IV-historie wordt gedeeld met de bestaande optiescanner. Afgeronde Stock Filters en IV Scans krijgen elk een afzonderlijk historiebestand.
- Verwijderen uit een resultaat voegt de ticker toe aan Geblokkeerde Stocks. Alle drie de fasen en toekomstige weekscans slaan deze over. Blokkeerlijst op de server, blijvend na herstart, met deblokkeren en normalisatie van aandelenticker-/klassevarianten. Geen aanpassing aan portefeuilleposities, Martin of de handmatige Leaps-shortlist.
- API-weekplanning: zondag Stock Filter om standaard 09:00 Europe/Amsterdam (instelbaar), IV bij de eerste beursopening op een volgende dag om 09:30 America/New_York. NYSE-feestdagen en zomertijd via de bestaande kalender 2026–2028. Geen automatische Option Scan, Gateway-start of MFA. Duurzame startregistratie voorkomt herhaling na herstart; onderbroken/falende runs worden handmatig hervat.
- 180 Node-tests, 13 frontendtests, TypeScript/Vite-build en browserworkflows voor Put spreads en Leaps geslaagd. Geen echte IBKR-rechtencontrole en geen serverinstallatie.

## 0.35.0 — aandelenfilter vóór de optiescan (25 oktober 2026)

- Twee expliciete stappen bij Put spreads: aandelen filteren en bewaren, daarna opties scannen op uitsluitend de afgeronde selectie. Geen automatische optieaanvragen na het filteren.
- Minimum-/maximumslotkoers en minimaal 5 miljoen verhandelde aandelen op de laatste afgesloten handelsdag, instelbaar. Dit is aandelenvolume; geen marktkapitalisatie of optievolume.
- Yahoo: vijf dagen OHLCV, drie gelijktijdige aanvragen, korte pauze tussen netwerkgroepen. Ruwe dagdata kunnen bij gewijzigde criteria opnieuw worden gefilterd zonder netwerkaanvragen. IBKR-daghistorie als seriële terugval met bestaande pacing en een hergebruikte verbinding.
- Selectie, bronnen, handelsdag, oorspronkelijke ophaaltijden en hervatcursor atomair bewaard buiten de webroot. Stoppen/hervatten, foutmeldingen bij ontbrekende data en bronbeperking. Geen 50-aandelenlimiet op de automatisch geselecteerde Amerikaanse markt.
- Optiejob verwijst naar een vaste selectie-ID; verouderde of onvoltooide selecties kunnen geen nieuwe optiescan starten. Bestaande optiecriteria en optiecache behouden.

## 0.34.1 — alleen voortgang en passende spreads (24 oktober 2026)

- Scanpagina beperkt tot instelbare criteria, bediening, aantal gescande aandelen, korte scanstatus en passende spreads. Afgewezen aandelen, redenen, bron-/cachetellingen, technische meldingen en uitlegpanelen verwijderd uit de pagina.
- Backenddiagnostiek, filtering, opslag, pacing, pauze en hervatten blijven werken. Alleen noodzakelijke actie-/invoerfouten blijven zichtbaar.
- Frontendtests, productiebuild en browserworkflow geslaagd; geen serverinstallatie uitgevoerd.

## 0.34.0 — optievolumevoorfilter (24 oktober 2026)

- IBKR generic ticks 100/105 bij de aandelenquote: gemiddeld optievolume (tickSize 87) en dagvolume (call 29 + put 30), vóór IV-historie en optiechain. Geen extra verzoek per optiecontract voor deze aandelenstatistiek.
- Minimum gemiddeld optievolume 5.000 contracten, aanpasbaar; 0 schakelt dit filter expliciet uit. Onbekend blijft onbekend, echt nul blijft nul. Ontbrekende volumerechten geven geen goedgekeurde chain; vijf opeenvolgende IV-/volumefouten pauzeren de job.
- Aparte persistente volumecache, maximaal zeven dagen oud, met oorspronkelijke ophaaltijden. Gemiddelde en dagvolume krijgen afzonderlijke kolommen/tijdstempels en CSV-velden.
- Zoekprofiel volgens opgegeven waarden: koers 5–150, IVR 20, DTE 40–100, buffer 25%, minimale maximale winst 15, maximaal verlies 1.000, OTM-proxy 70%, bied-laat maximaal 1. Bestaande browservoorkeuren behouden; geen claim van een optimaal handelsprofiel.
- Lokale tests/build en browsercontrole geslaagd; geen bevestiging van echte live-volumerechten of serverinstallatie.

## 0.33.1 — ontbrekende IV en veilige scanverbinding (24 oktober 2026)

- Ontbrekende actuele tick-106-IV blokkeert de IV-daghistorie niet meer voor Put spreads. Recente dag-IV wordt als gedateerde referentie gebruikt, met minimaal 200 waarnemingen, jaar- en recentedekking. Actuele IV en historische referentie blijven onderscheiden in tabel, beoordeling en CSV.
- Eén fysieke scanverbinding per run, geïsoleerde listeners per aandeel en oplopende request-ID’s. Eén eerste aandelenquote in vertraagde/bevroren modus; geen drievoudige herhaling uitsluitend wegens ontbrekende IV.
- IV-historie apart persistent opgeslagen; dagcache hergebruikt, geldige oudere reeks op open markt met tien dagen bijgewerkt. Te oude/ongeldige historie vraagt opnieuw een jaar.
- Bestaande requestpacing behouden, plus één seconde tussen brokerbeoordelingen en twintig seconden na 25. Vijf opeenvolgende IV-fouten pauzeren de job; hervatten probeert deze aandelen opnieuw, ook wanneer ze achteraan het universum stonden.
- Lokale tests/build en browsercontrole geslaagd. Geen diagnose van de werkelijke serverrechten, echte brokerproef of serverinstallatie geclaimd.

## 0.33.0 — brede put-spreadscan en oude chains (24 oktober 2026)

- Standaard alle gewone Amerikaanse aandelen/ADR’s uit Nasdaq Trader-noteringen; geen 50-aandelenlimiet voor breed scannen. Optiegeschiktheid via IBKR, zonder vaste shortlist of beperking tot Nasdaq/S&P 500. Eigen tickers blijven optioneel.
- Koersfilter vóór IV-historie en IV-rank vóór optiechain; overslagreden per aandeel zichtbaar. Optieafhankelijke filters volgen na de chain.
- Ruwe putquotes en chainmetadata per aandeel in private servercache. Gesloten beurs: opgeslagen quotes herfilteren, anders bevroren IBKR-data proberen. Uitval: cache gebruiken en ontbrekende data melden. Ophaaltijden, cachelabels en verlopen contracten expliciet behandeld.
- Duurzame universumcursor, stoppen/hervatten met dezelfde filters, voortgang en laatste 50 aandelenbeoordelingen. Geen automatische hervatting na serverherstart.
- Tests/build en browsercontrole geslaagd; nog geen echte IBKR-proef of serverinstallatie.

## 0.32.0 — bull-put-spreadscanner (24 oktober 2026)

- Nieuwe pagina **Put spreads** met filters links, eigen tickers of overname van maximaal 50 IV-resultaten, sortering, zoeken, paginering en CSV.
- Bestaande read-only IBKR-scan uitgebreid met standaard USD-putparen van dezelfde expiratie en handelsklasse, conservatieve credit, expiratiewinst/-verlies en rendement op risico.
- Delta-indicatie expliciet als OTM-proxy, zonder exacte winstkans, optievolume of externe scores te verzinnen. Beide bronstatussen en ophaaltijden inspecteerbaar.
- Start/stop, wederzijdse optiescanblokkering, invoervalidatie, checkpoints, herstel na herstart en LAN-proxy. Begrensde strike-dekking zichtbaar.
- Lokale validatie geslaagd; nog geen serverinstallatie of echte-brokerproef voor deze uitbreiding. Zie [handleiding](put-spreads.md).

## 0.31.8 — breed Amerikaans Martin-universum (16 oktober 2026)

- Standaard officiële Nasdaq Trader-lijsten voor Nasdaq en overige Amerikaanse beurzen, ontdubbeld en gefilterd op gewone aandelen/ADR’s. Geen vaste shortlistfallback. Bronmetadata en dekking zichtbaar.
- Automatische Potent-, Leaders-, Premarket- en Focuslijsten uit het brede universum; optionele eigen lijst behouden.
- Koerscache per aandeel/datum/slotperiode, checkpoint, stoppen/hervatten en pauzeren bij bronbegrenzing. Premarket pas na dagselectie voor ADR/liquiditeitskandidaten.
- Browserpaginering voor grote resultaten; export behoudt volledige gefilterde lijst. Update migreert de oude standaardshortlist naar brede modus.

## 0.31.7 — Martin-scan in het menu (16 oktober 2026)

- Menupagina `#martin` met scanstart, voortgang, aanpasbaar universum, vijf watchlistweergaven, zoeken, sortering en CSV-/TradingView-export.
- Asynchrone Node-job met behoud van vorige resultaten, origincontrole, invoervalidatie, opslag en herstel na herstart. De bestaande CLI en selectiecriteria blijven beschikbaar.
- FastAPI LAN-proxy en update-script bijgewerkt; frontend en Node-API samen publiceren. Zie [handleiding](martin-scanner.md).

## Martin-selectiescanner v1.0 — lokaal beschikbaar (16 oktober 2026)

- Zelfstandige scanner op basis van Martins interview: Potent, Leaders, Premarket en strengere focusselectie.
- EMA9/21/50, ADR, dollaromzet, compactheid, inside day, stopreferentie en themaclusters met aangeleverde metadata.
- Eigen tickeruniversum en lokale OHLCV-import; Markdown-, CSV-, JSON- en TradingView-export. Zie [handleiding](martin-scanner.md).
- Trading Monitor blijft 0.31.6; geen wijziging aan de webapp of publicatie.

## Nog niet uitgebracht — mobiele IBKR-bediening (14 oktober 2026)

- IBKR-status en Verbinden/Vernieuwen direct onder de paginatitel op schermen t/m 700 pixels, bereikbaar met gesloten menu.
- Desktopbediening blijft in de zijbalk; knop op mobiel minimaal 44 pixels hoog en statusberichten kunnen afbreken.

## 0.31.6 — IV Scan automatisch vervolgen (13 oktober 2026)

- Serverreeks: 25 aandelen, 20 seconden pauze, volgend blok tot de lijst is afgerond.
- Afteller en Scan stoppen tijdens pauzes; browser mag gesloten worden.
- Bestaande IBKR-pacing, resultaten en cursoropslag blijven behouden; geen tweede optiescan tijdens de pauze.
- Geen automatische herhaling na volledige ronde, brokerfout of opslagfout; een actieve ronde blijft dezelfde lijst vervolgen over middernacht. Na serverherstart handmatig hervatten.

## 0.31.5 — IV-rank sorteren en prijsfilters (13 oktober 2026)

- IV Scan sorteren op IV-rank in beide richtingen; standaard hoogste eerst, gelijke rangen alfabetisch.
- Prijsranges en vrij minimum/maximum in USD met inclusieve grenzen, validatie en Filters wissen.
- Sortering en prijsfilter per browser onthouden; uitsluitend lokale filtering van beschikbare scanresultaten.
- Browsercontrole op volgorde, grenzen, ongeldige range, gefilterd lege lijst, reset, herladen en mobiele breedtes.

## 0.31.4 — laatste scans en IV-voortgang bewaren (13 oktober 2026)

- Resultaten van IV Scan, Leaps en CSP in privébestand scan-results.json, atomisch geschreven.
- IV-universum, matches en cursor na ieder afgerond aandeel opslaan; herstart hervat dezelfde beursdatum zonder opnieuw bij nul te beginnen.
- Lopende scans na herstart als onderbroken tonen; quote-ophaaltijden blijven behouden.
- Eerdere IV-/Leaps-resultaten behouden als een nieuwe scan faalt of zonder resultaten wordt gestopt.
- Opslagfouten zichtbaar; onleesbaar bestand niet overschrijven. [Handleiding](iv-leaps.md#laatste-scan-bewaren-0314).

## 0.31.3 — Leaps-calculatorvelden (13 oktober 2026)

- Decrease to break even als negatieve koersafstand tot break-even bij expiratie.
- Return if expired en Return annualized volgens netto rekenbasis strike min biedpremie.
- Bestaande bruto-onderpandvergelijking expliciet gelabeld; selectiecriteria behouden.
- Tests vergelijken de drie aangeleverde calculatorvoorbeelden en browserkolommen. [Formules](iv-leaps.md#berekeningen-en-afhandeling).

## 0.31.2 — IV Scan zonder IBKR-marktscanner (13 oktober 2026)

- Tickers rechtstreeks uit S&P 500-ledenlijst en Nasdaq-directory; geen IBKR-scannersubscriptions in IV Scan.
- 25 aandelen per klik, cursor en gevonden matches bewaard tijdens deze ronde; Volgende 25 scannen vervolgt de lijst.
- Dekking zichtbaar; ontbrekende bron/data geeft een melding, geen succesvolle lege marktscan.
- Ontbrekende actuele IV wordt overgeslagen voordat historische data worden aangevraagd.
- Lokale broncontrole: 3.726 unieke tickers uit beide feeds, zonder waarschuwingen. Echte IBKR-koersen nog niet geverifieerd.

## 0.31.1 — rustig scannen bij IBKR (13 oktober 2026)

- Optiequotes van 15 tegelijk naar één tegelijk; gedeelde requestwachtrij met minimaal 500 ms tussen aanvragen en 11 s tussen historiedownloads.
- Conservatief budget van 55 historische requests per 10 minuten; identieke aanvragen minimaal 15 s uiteen.
- IV-jaarhistorie voor dezelfde beursdatum uit geheugencache; nieuwe aandelen-IV en optiequotes blijven vereist.
- Uitgeschakelde scannertypen één uur onthouden; niet opnieuw proberen voor de andere marktlocatie of volgende scans.
- Echte pacingfout stopt de scan met een pauze van minstens één minuut; geen automatische vervolgaanvragen.
- Scan stoppen in IV Scan, Leaps en CSP. Reeds gevonden resultaten blijven zichtbaar. [Werking en update](iv-leaps.md).

## 0.31.0 — IV Scan en Leaps (13 oktober 2026)

- Breakout-menu vervangen door IV Scan met IV-rank strikt boven 40; bestaande links openen IV Scan.
- Leaps-shortlist handmatig beheren en op de server bewaren, ook na herstart.
- Standaard USD-puts vergelijken: 30–50 / 300–700 DTE, |delta| 0,10–0,15, maximaal 0,02 deltaverschil, IV-rank > 40 en IV-percentile > 50.
- Langlopende put moet het beste vergelijkbare korte jaarlijkse premierendement overtreffen; biedprijs en volledig cashonderpand als basis.
- Break-even, buffer, marktdataherkomst, gedeeltelijke resultaten, ontbrekende gegevens en 50%-exitprijs zichtbaar.
- Node-API en LAN-proxy uitgebreid; [updatehandleiding](iv-leaps.md). Geen orderuitvoering.

## 0.30.0 — volledig API-contract en LAN-start (12 oktober 2026)

- Gezamenlijke instellingen-API, universe/import, sync/start/status, stockdetails/bars en analyseherberekening; Nederlandse structured errors.
- Cached-dataherkomst en afzonderlijke sync-/opslag-/berekentijden, ontbrekende sessies uitgesloten van momentumrangen.
- Tabel met bedrijf/rang/MA-steun/breakoutafstand/sparkline; detailchecklist, impulsmarkeringen en consolidatie-overlay.
- Eén ontwikkel- en productiecommando, gezamenlijke origin, 0.0.0.0-hosting en expliciete demo; systemd uitsluitend handmatig.
- 32 pytest-, zeven Vitest- en 94 regressietests plus Playwright/LAN-browserworkflow geslaagd. [Handleiding](breakout-lan.md).


## 0.29.0 — Python Breakout en incrementele cache (12 oktober 2026)

- Node-scanner vervangen door afzonderlijke FastAPI-/SQLAlchemy-/SQLite-subapp; bestaande portefeuille/CSP behouden.
- Gepinde ib_async 2.1.0, Paper standaard, TWS/Gateway-instellingen, reconnect, pacing, bounded retries, annulering en geschoonde subscriptiefouten.
- CSV-universum, cached conIds, incrementele dagbars, per-symbol fouten en retry, corporate-actionhercontrole met behoud van cache bij fouten.
- React-code opgesplitst; financiële candlestickgrafiek, prijs-/liquiditeits-/metadatafilters en expliciete read-only tekst. Labels Setup mislukt en Onvoldoende data.
- Gedocumenteerde JSON/OpenAPI, Pydantic-config en systemd/Nginx GitHub-update. 24 pytest-, zeven Vitest- en 94 Node-tests plus Playwright-smoke geslaagd. Live plaatsing en IBKR-data nog niet bevestigd.
- [Handleiding](breakout-scanner.md), [architectuur/API](breakout-python.md).


## 0.28.0 — Breakout-scanner (12 oktober 2026)

- Nederlandse Breakout-pagina in donkere lime-stijl, naast de bestaande portefeuillepagina’s.
- Werkelijke momentumranglijsten per 21/63/126 sessies en top 1/2/5% binnen het gekozen universum.
- Configureerbare rolling impuls, ordelijke consolidatie en breakout zonder kandidaatbar in eerdere high/ATR.
- Read-only IBKR ADJUSTED_LAST-daghistorie, private scanopslag, voortgang, annuleren en expliciete datadekking.
- Detailgrafiek, setupdiagnostiek, toegankelijke sortering, filters en CSV. Tests, build en lokale browserworkflow gecontroleerd. Live installatie en IBKR-marktdata nog niet bevestigd.
- [Handleiding en serverupdate](breakout-scanner.md).

## 0.27.2 – koers- en scannerterugval en zichtbare startfouten

- Quotes proberen bevroren en vertraagd-bevroren data wanneer de reguliere stream geen volledige koers levert.
- Een uitgeschakelde IV-marktscanner valt terug op actieve aandelen; alle CSP-filters blijven gelden.
- Startfouten tonen HTTP-status en gerichte uitleg. Opnieuw starten verzendt de startaanvraag opnieuw.
- Datameldingen geven concrete oorzaken zonder afgewezen tickers te tonen.

## 0.27.1 – uitsluitend passende aandelen in Scans

- Afgewezen aandelen verdwijnen uit de portfoliosamenvatting, voortgang en datameldingen.
- Resultaten worden ook in de interface opnieuw getoetst aan alle CSP-criteria en de actuele resterende looptijd.
- Meldingen over ontbrekende data blijven zichtbaar als een samenvatting zonder afgewezen tickers.

## 0.27.0 – donkere modus en CSP-scans (11 oktober 2026)

- Donkere modus standaard; licht/donker wordt per browser onthouden.
- Nieuw menu Scans met portfolioresultaten eerst en afzonderlijke NASDAQ/S&P 500-shortlist voor aandelen van $ 10–$ 50.
- Strikte filters: standaard USD-puts, 35–50 kalenderdagen, |delta| 0,16–0,22, IVR > 30, OTM en delta-POP > 80%.
- Sortering op lineair jaarrendement, rendement op onderpand of premie; zichtbare koersbron en onvolledige-data-meldingen.
- Nieuwe asynchrone read-only IBKR-scanroutes; ontbrekende data leidt niet tot gefingeerde matches.

## 0.26.3 – volledige openingsgegevens voor actuele opties

- Nieuwe optieposities na de laatste Flex-import krijgen openingsdatum en gekozen DTE uit de bewaarde Gateway-uitvoeringen.
- De reconstructie verwerkt meerdere openingslots en gedeeltelijke sluitingen volgens FIFO en accepteert het resultaat alleen als het aansluit op de actuele IBKR-positie.
- Bij werkelijk ontbrekende uitvoeringhistorie blijft de waarde onbekend; er wordt geen openingsdatum geschat.

## 0.26.2 – volledig gerealiseerd optie- en aandelenresultaat

- Maandresultaat, jaarresultaat en maandgemiddelde tellen gerealiseerde long én short opties plus aandelenverkopen.
- Beide legs van een gesloten synthetic worden daardoor verwerkt; een open synthetic blijft ongerealiseerd en telt niet mee.
- Flex-import en live Gateway-sluitingen gebruiken dezelfde categorieën. Premiebehoud en premiedetails blijven uitsluitend op short opties gebaseerd.
- Maandkaarten en grafiektooltips tonen short opties, long opties en aandelen afzonderlijk.

## 0.26.1 – automatische synchronisatie tijdens handelssessies

- Systemd-timer controleert ieder uur van 04:00 t/m 16:00 New York-tijd, inclusief NYSE Arca pre-market en met automatische Amerikaanse zomertijd.
- Weekenden, officiële NYSE-feestdagen voor 2026–2028 en uren na een gepubliceerde vroege sluiting worden overgeslagen.
- De timer start een gestopte API-service mee; bij een ontbrekende Gateway gebruikt hij de bestaande IBC- en IB Key-flow.
- Maximaal één geplande MFA-poging per uur; IB Key-goedkeuring blijft handmatig.

## 0.26.0 – volledige actuele synchronisatie

- **Vernieuwen** zet de dashboardperiode voortaan op de actuele IBKR-kalendermaand; oktober blijft niet meer op september staan.
- Nieuwe Gateway-resultaten werken maand, jaar, gemiddelde, premie, aandelenresultaat, maandgrafiek en handelsstatistieken gezamenlijk bij.
- Het actuele IBKR-saldo vult ook de lopende maand in saldohistorie en doelen aan.
- Gateway-nettoresultaat wordt apart vermeld wanneer de bruto premiecomponenten alleen uit Flex bekend zijn.

## 0.25.1 – Gateway-mutaties op de Flex-saldodag

- De overlapgrens gebruikt voortaan de laatste werkelijk geïmporteerde Flex-trade, niet de einddatum van het Flex-rapport.
- Daardoor worden Gateway-uitvoeringen niet meer weggefilterd wanneer de saldohistorie een dag verder loopt dan de tradehistorie.
- Regeneratie van de lokale portfoliosamenvatting, regressietests en productiebuild zijn gecontroleerd; live-publicatie staat nog open.

## 0.25.0 – afgesloten trades via IBKR Gateway

- Bestaande koppeling haalt ook uitvoeringen en resultaten op; rolls en gedeeltelijke sluitingen verschijnen in Trades en Stats.
- Automatisch ophalen elke minuut; handmatig Vernieuwen haalt direct op. Private uitvoeringhistorie blijft bewaard bij dagwissel en herstart.
- Deduplicatie, uitvoeringscorrecties, accountfiltering en melding bij ontbrekende resultaten; bijgewerkte historie voorkomt dubbele trades.
- Lokale tests met gesimuleerde Gateway en productiebuild gecontroleerd. Live-publicatie en controle op de eigen Gateway staan nog open.

## 0.24.0 – lichte portefeuille-interface

- Nieuwe lichte vormgeving met rustige kaartlijnen, witruimte, groen voor positieve resultaten en rood voor negatieve resultaten; dezelfde stijl op alle pagina's.
- Kerncijfers bovenaan: portefeuillesaldo, totale winst, saldoverandering en jaarresultaat.
- Saldohistorie met jaarkeuze en vorig jaar als referentie; netto maandgrafiek uit gerealiseerde short-optiepremie en aandelenverkopen na kosten.
- Compact jaardoel met bestaande saldovoortgang en berekening van het jaarschema, plus verwijzing naar Goals.
- Maandresultaat en premiedetails samengevoegd per maand onder de grafieken; handelsstatistieken daaronder. Het jaarresultaat verschijnt één keer.
- De importer exporteert `monthlyTradingResults`; voer de import opnieuw uit bij de serverupdate.
- Live-installatie gebeurt door de gebruiker via Git en PuTTY; dit is geen bevestiging van serverpublicatie.

## Live saldoverandering – meegenomen in de update naar 0.24.0

- Saldoverandering en percentage volgen nu het actuele IBKR-saldo tegenover de vorige beschikbare dagstand.
- De server bewaart de laatste meting van een eerdere dag; Flex blijft terugvalbron. Vergelijkingsdatum en bron blijven zichtbaar.
- Geen fictief nulpercentage bij ontbrekende referentie of nulbasis.
- Voor ingebruikname moeten frontend en backend worden bijgewerkt en de API-service worden herstart.

## 0.23.1 – zichtbare voortgang naar het jaardoel

- De voortgangsbalk toont actueel saldo gedeeld door het totale jaardoel. Een negatief jaarresultaat maakt de balk daardoor niet meer leeg.
- Winst na netto inleg en het verschil met het jaarschema blijven afzonderlijk berekend.

## 0.23.0 – betrouwbare synchronisatie en consistente peildatums

- Herhaalde IBKR-positieupdates vervangen dezelfde positie; nulposities verdwijnen. Ook oude snapshots worden ontdubbeld.
- Een snapshot die vóór de Flex-data binnenkomt blijft behouden; verouderde snapshots overschrijven geen nieuwere rapportdatum.
- Dashboardaantallen gebruiken de actuele open opties. Ontbrekende expiraties worden waar mogelijk uit de OCC-contractnaam gelezen.
- EAE-aandelenleveringen worden vóór verkopen op dezelfde dag verwerkt, met dezelfde volgorde voor resultaten en resterende posities.
- Saldoverandering rapportdag gebruikt het bijbehorende historische saldo. Headers onderscheiden actuele posities van Flex-historie.
- Stats/Trades benoemen expliciet dat hun optieresultaat long en short omvat. Het dashboardnettoresultaat blijft uitsluitend short-premie plus aandelenverkopen.
- Goals vraagt bij een jaarovergang om een nieuwe jaarafsluiting voordat het nieuwe saldo in een doelberekening wordt gebruikt.
- Portefeuilleverdeling behoudt het negatieve teken van short-opties en sluit aan op het nettosaldo. Negatieve categorieën worden niet als positieve donutsegmenten getekend.

## 0.22.0 – werkelijke inleg en gecorrigeerd rendement

- Jaarlijkse stortingsrapporten ingelezen; opnames verlagen de netto inleg.
- Totale winst en percentage gecorrigeerd voor netto inleg sinds 2025.
- Goals toont Inleg, Ingelegd en Winst / %, met aparte winst- en inlegvoortgang.
- Extra inleg boven de planning verhoogt de saldoverwachting zonder als rendement te tellen.
- Ontbrekende historie en afwijkende peildatums worden expliciet getoond.

## 0.21.2 – gecentreerde dashboardkaarten

- Titels, bedragen en toelichtingen staan als één groep verticaal gecentreerd in de saldo-, resultaat-, activiteit- en premiekaarten.
- Gelijke boven- en onderruimte; toelichtingen worden niet meer naar de onderrand geduwd.

## 0.21.1 – gekochte opties buiten nettoresultaat

- Winst en verlies van gekochte opties tellen niet meer mee in het maand- en jaarresultaat of maandgemiddelde.
- De nettoresultaatkaarten tonen uitsluitend premie en aandelen.
- Optiehistorie in Trades/Stats en Totale winst op basis van saldogroei blijven behouden.

## 0.21.0 – totale winst sinds start 2025

- Rechts naast de portefeuilleverdeling staat Totale winst met saldogroei in dollars en procenten.
- Toont startsaldo / huidig saldo en de gebruikte startdatum; live IBKR-saldo-updates worden direct meegenomen.
- Responsieve kaartindeling en expliciete lege toestand bij ontbrekende startgegevens.

## 0.20.0 – uitsluitend gerealiseerde resultaten

- Openingspremies en aankopen hebben geen invloed op netto premie of nettoresultaat. Alleen sluitingen, bevestigde expiraties en verkopen tellen mee in hun realisatiemaand.
- FIFO verdeelt aankoopkosten en commissies over gedeeltelijke afsluitingen.
- Aandelen/ETF-verkopen, CC-assignment en gekochte calls tellen mee; assignmentpremie en commissies worden niet dubbel geboekt.
- Jaarresultaat, maandgemiddelde, premiekaarten en optietrades volgen dezelfde realisaties.
- OptionEAE vult ontbrekende sluitingen aan en wordt met bestaande uitvoeringen gededupliceerd.
- Nederlandse berekeningsdocumentatie en regressietests uitgebreid.

## 0.19.0 – cashreservering voor CSP

- Iedere open short put reserveert `strike × 100 × aantal contracten`, inclusief de short-putleg van een synthetische positie.
- Options toont het totaal gereserveerde bedrag en het vrij te besteden bedrag volgens `saldo − aandelen − CSP-reservering`.
- De dashboardcategorie Opties omvat voortaan zowel de actuele optiewaarde als de CSP-reservering; hetzelfde bedrag wordt uit Geld / overig gehaald.
- Ontbrekende strikes worden waar mogelijk veilig uit de compacte IBKR-contractnaam afgeleid en anders zichtbaar als onvolledige reservering gemeld.

## 0.18.0 – gerealiseerd maandresultaat

- Nettoresultaat deze en vorige maand combineren netto optiepremie met gerealiseerde aandelenverkopen en gesloten synthetische posities.
- De korte synthetische leg blijft onderdeel van netto premie; uitsluitend de lange leg wordt aanvullend geteld om dubbeltelling te voorkomen.
- Beide kaarten tonen een controleerbare uitsplitsing in premie, aandelen en SYNT.

## 0.17.1 – consistente jaarscope

- Het Dashboard gebruikt uitsluitend in 2026 afgesloten trades voor de handels- en premiestatistieken en telt daar de huidige open posities bij op.
- Totaal trades op het Dashboard is daardoor weer 181: 171 gesloten in 2026 en 10 momenteel open.
- Stats heeft een onafhankelijke jaarkeuze voor 2024, 2025 en 2026 en opent standaard op 2026.

## 0.17.0 – meerjarig portefeuilleverloop

- Stats toont het werkelijke portefeuillesaldo per maandeinde over alle beschikbare Flex-jaren.
- Met 2024, 2025, 2026 en Alles kan de grafiek onafhankelijk van de trade-analyse worden gefilterd.
- De kerncijfers en alle handelsgrafieken blijven vast gebaseerd op 2026; ook het portefeuilleverloop opent standaard op 2026.
- Beginwaarde, eindwaarde, dollarverschil en procentuele verandering geven directe context bij de lijn.
- Benchmarklijnen worden pas geactiveerd wanneer een betrouwbare koersbron beschikbaar is; er worden geen voorbeeldgegevens als echte prestaties getoond.

## 0.16.0 – historisch doelresultaat 2025

- Goals toont 2025 als afgesloten jaar met het werkelijke startsaldo uit 2024, het berekende doel en het gerealiseerde resultaat.
- De jaarlijkse geplande inleg is gecorrigeerd naar `$ 12.000` en wordt consequent toegepast op 2025, 2026 en de meerjarenplanning.
- Afgesloten, actuele en toekomstige jaren zijn visueel en semantisch van elkaar onderscheiden.
- Gecombineerde synthetische optielegs zijn op de Options-pagina herkenbaar aan een samenvoegicoon, strategie-accent en gekoppelde rijkleur.

## 0.15.0 – statistiekenpagina

- Stats is als menuoptie tussen Goals en Trades toegevoegd.
- Een jaarkeuze schakelt alle analyses tussen 2025 en 2026.
- Zes kerncijfers tonen trades, winratio, nettoresultaat, gemiddeld resultaat, profit factor en gemiddelde looptijd.
- Grafieken tonen maandresultaten, winst/verliesverdeling, resultaatimpact per onderliggende waarde en de verdeling van de aanhoudduur.

## 0.14.2 – navigatievolgorde

- Het hoofdmenu staat nu in de volgorde Dashboard, Stocks, Options, Goals en Trades.

## 0.14.1 – saldo-opmaak

- De primaire saldowaarde is vergroot voor een duidelijkere visuele hiërarchie en betere benutting van de kaart.

## 0.14.0 – dagelijkse winst en verlies

- Tussen Saldo en Portefeuilleverdeling staat een afzonderlijke kaart voor Dagelijkse W&V.
- De kaart toont het dagresultaat in dollars en als percentage van het saldo van de vorige handelsdag.
- Positieve, negatieve en ongewijzigde dagresultaten gebruiken dezelfde semantische statusweergave als de rest van het dashboard.
- De kleine dubbele dagwaarde is uit het midden van de portefeuilledonut verwijderd.

## 0.13.0 – meerjarige trades en jaarreferentie

- De importer leest meerdere jaarbestanden per Flex-brontype en voorkomt dubbeltellingen van overlappende saldodagen en IBKR-executies.
- De trades uit 2025 zijn toegevoegd naast 2026; de Trades-pagina heeft een jaarkeuze en eigen samenvatting en paginering per jaar.
- Jaarverloop toont de maandbedragen van 2025 als grijze referentiebalken achter de lijn van 2026.
- De meerjarige import is gecontroleerd met 453 unieke saldodagen, 1.430 uitvoeringen en 390 afgesloten optiecycli.

## 0.12.0 – afgesloten trades

- Trades is als laatste navigatieoptie toegevoegd.
- Alle afgesloten optiecycli worden van nieuw naar oud getoond met maximaal 50 regels per pagina.
- Per trade zijn positie, strike, openings- en sluitingsdatum, aanhoudduur, openingspremie en nettoresultaat zichtbaar.
- Trade-rendement en lineair geannualiseerd rendement worden afzonderlijk getoond en uitgelegd.
- Oudere trades zonder opening in het Flex-bereik blijven zichtbaar zonder ontbrekende percentages te schatten.

## 0.11.0 – jaarlijkse doelen

- Goals is als derde navigatieoptie toegevoegd tussen Options en Stocks.
- Het jaardoel gebruikt de werkelijke eindstand van het voorgaande jaar, 30% rendementsdoel en `$ 1.200` jaarlijkse inleg.
- De pagina toont actueel saldo, resterend doelbedrag, lineaire voortgang en voor- of achterstand op het jaarschema.
- Een vijfjarenplanning rekent toekomstige startsaldi, rendement, inleg en doelen door.
- Een echte nieuwe jaarafsluiting vervangt automatisch het eerder geplande startsaldo.

## 0.10.0 – open optieposities

- Een afzonderlijke Options-pagina en navigatieoptie tonen alle open optiecontracten.
- Per positie zijn strategie, call/put, long/short, aantal, strike, expiratie, gekozen DTE, resterende dagen en openingspremie beschikbaar.
- Live IBKR-data vult huidige prijs, marktwaarde en ongerealiseerd winst/verlies aan.
- Synthetische long- en shortcombinaties worden op basis van onderliggende waarde, strike en expiratie als `SYNT` herkend.
- Korte resterende looptijden krijgen een zichtbare waarschuwing zonder uitsluitend op kleur te vertrouwen.

## 0.9.0 – dagelijkse koersbeweging

- De Stocks-tabel toont als laatste kolom de procentuele koersverandering ten opzichte van de vorige slotkoers.
- Positieve dagbewegingen zijn groen, negatieve rood en een ongewijzigde koers wordt expliciet als `0,0%` getoond.
- De read-only IBKR-refresh haalt de vorige slotkoers via live of beschikbare vertraagde marktdata op.
- Ontbrekende slotkoersen worden als niet beschikbaar getoond en niet als een onjuiste nulwaarde.

## 0.8.1 – uitgelijnd dashboardraster

- Saldo en portefeuilleverdeling vullen samen dezelfde breedte als Jaarverloop in een rustige 40/60-verdeling.
- Resultaat- en handelskaarten verdelen de volledige beschikbare rij gelijkmatig.
- Middelbrede en compacte schermen laten geen lege laatste kaartpositie meer achter.

## 0.8.0 – covered-call-dekking

- De Stocks-tabel toont per aandeel hoeveel open short calls tegenover volledige pakketten van 100 aandelen staan.
- Volledige dekking wordt groen getoond; ontbrekende, gedeeltelijke en overmatige dekking worden rood en met tekst gemarkeerd.
- Puts, gekochte calls en opties op andere symbolen tellen niet mee als covered call.

## 0.7.0 – read-only IBKR-koppeling

- Linksonder is een toegankelijke IBKR-status- en refreshbediening toegevoegd.
- De backend kan via een vaste systemd-service IBC en IB Gateway starten.
- IB Key MFA wordt door de gebruiker in IBKR Mobile bevestigd.
- Actuele netto liquidatiewaarde, posities, marktprijzen en ongerealiseerde winst/verlies worden read-only opgehaald.
- Nginx geeft `/api/` uitsluitend door aan de backend op localhost.
- Systemd-, Xvfb-, sudoers- en omgevingsconfiguraties zijn toegevoegd.

## 0.6.2 – productie op webroot

- De productiebuild gebruikt expliciet `/` als basispad.
- Een Nginx-configuratie voor de standaard webroot op poort 80 is toegevoegd.
- De installatiehandleiding beschrijft bouwen, installeren en veilig bijwerken op Linux.
- Financiële JSON-data en `index.html` worden niet gecachet; gehashte assets wel.

## 0.6.1 – netto portefeuillewaarden

- De premiekaarten tonen netto premie als hoofdwaarde; ontvangen premie, terugkoop en commissie blijven zichtbaar als controleerbare uitsplitsing.
- De resultaatkaarten benoemen expliciet dat zij de mutatie van de netto liquidatiewaarde tonen.
- Het aandelenoverzicht onderscheidt nettokostprijs, actuele netto positiewaarde en aandelenwinst/-verlies.
- Commissies op aandelenaankopen worden in de resterende FIFO-kostprijs verwerkt.
- Actuele positiewaarde en ongerealiseerd resultaat blijven leeg totdat actuele IBKR-koersen beschikbaar zijn.

## 0.6.0 — 26 september 2026

- Tweede navigatiepagina `Stocks` toegevoegd.
- Open aandelenposities met aantallen, FIFO-aankoopprijs en aankoopwaarde uit Flex-trades berekend.
- Kolommen voor huidige prijs, huidige waarde en verschil voorbereid op de toekomstige IBKR-koppeling.
- Responsieve, horizontaal begrensde aandelentabel en lege toestand toegevoegd.

## 0.5.2 — 26 september 2026

- Positieve resultaten en opbrengsten consequent groen weergegeven.
- Negatieve resultaten, terugkoop en commissie consequent rood met minteken weergegeven.

## 0.5.1 — 26 september 2026

- Tekst, kaarthoogtes en tussenruimtes compacter gemaakt.
- Brede statistiekkolommen begrensd zodat ze niet langer over het volledige scherm uitrekken.
- Navigatie en paginamarges verkleind voor evenwichtigere dashboardverhoudingen.

## 0.5.0 — 26 september 2026

- Donutgrafiek met aandelen, opties en geld/overig naast het saldo toegevoegd.
- Dagrendement in het midden van de verdelingsgrafiek toegevoegd.
- Indicatieve allocatie uit open aandelenkostprijs en de laatste Flex-saldowaarden berekend.

## 0.4.0 — 26 september 2026

- Alle dashboardstatistieken in compacte, gelijkmatige kaarten geplaatst.
- Gecentreerde titel, waarde en toelichting met een semantische linker accentlijn.
- Responsieve indeling met vijf, twee of één kaart per rij, afhankelijk van de beschikbare breedte.

## 0.3.1 — 26 september 2026

- Saldo, winst, jaargrafiek en optiepremies consequent als dollars weergegeven.
- Compact `$`-teken gebruikt voor alle geldbedragen.

## 0.3.0 — 26 september 2026

- Blokken toegevoegd voor totaal trades, gesloten/open trades en gemiddelde aanhoudduur.
- Premiebehoud en ontvangen brutopremie voor het jaar toegevoegd.
- Ontvangen premie, terugkoop, commissie en netto toegevoegd voor de huidige en vorige maand.
- Bestaande statistiekblokken compacter gemaakt voor de uitgebreidere dashboardindeling.

## 0.2.2 — 26 september 2026

- Bovenlabel `Portfolio-overzicht` uit de dashboardkop verwijderd.
- Toelichtingszin onder de dashboardtitel verwijderd.

## 0.2.1 — 26 september 2026

- Samenvattingsbalk met beste en laagste maand verwijderd.
- Uitklapbare tabel met exacte maandbedragen verwijderd.

## 0.2.0 — 26 september 2026

- Lijngrafiek met saldoverandering per maand voor het volledige kalenderjaar.
- Positieve, negatieve en nog ontbrekende maandgegevens visueel onderscheiden.

## 0.1.0 — 26 september 2026

- Eerste lokaal werkende dashboardopzet.
- Donkere responsieve navigatie met Trading Monitor-logo.
- Saldo, winst 2026, huidige maand, vorige maand en gemiddeld per maand.
- Lokale, privacybewuste import van IBKR Flex XML-rapporten.
