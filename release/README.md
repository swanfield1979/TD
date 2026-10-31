# Releases

## Trading Monitor 0.42.8 — huidige week in gegevensblok

Toont de actuele ISO-week volgens de Nederlandse datum, naast de bestaande gegevensdatum. Beschikbaar via GitHub-main en Updates; geen afzonderlijk installatiepakket. Serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.42.7 — laatst opgeslagen IBKR-synchronisatie

Automatisch de servergegevens laden zonder actieve gatewayverbinding, met zichtbare synchronisatiedatum en behoud bij tijdelijke leesfouten. Beschikbaar via GitHub-main en Updates; geen afzonderlijk installatiepakket. Serverinstallatie nog niet uitgevoerd. Zie [handleiding](../docs/laatste-synchronisatie.md).

Trading Monitor 0.42.6 (30 oktober 2026): IV Percentile en hergebruik van de IV-selectie. Geen afzonderlijk distributiepakket of serverinstallatie; broncode op 0.42.6. Beschikbaar via de versiecontrole op GitHub-main. Zie [handleiding](../docs/put-spreads.md).

## Trading Monitor 0.42.5 — uitklapbare optiecombinaties en Stats

Putspreads en SYNT worden eenmaal getoond met twee uitklapbare benen, netto premie/koers, gecombineerde waarden en ISO-openingsweek. Inclusief de Stats-uitbreiding met cumulatief resultaat en prestaties per aandeel. Manifest, lockfile en updatescript staan op 0.42.5 zodat Updates de versie herkent. Geen afzonderlijk installatiepakket; serverinstallatie nog niet uitgevoerd. Zie [optiecombinaties](../docs/optiecombinaties.md) en [Stats](../docs/stats.md).

## Stats-uitbreiding vanaf 0.42.4 (meegeleverd in 0.42.5)

Uitgebreide Stats-pagina met cumulatief gesloten optieresultaat, resultaatanalyse en sorteerbare prestaties per aandeel. Meegeleverd in 0.42.5; serverinstallatie nog niet uitgevoerd. Geen afzonderlijk installatiepakket. Zie [Stats](../docs/stats.md).

## Trading Monitor 0.42.3 — financieel ontwerp

Financiële ontwerpupdate van 28 oktober 2026: broncode en productiebuild gecontroleerd, geen afzonderlijk installatiepakket. Versie 0.42.3 maakt de wijziging herkenbaar via Updates. Serverinstallatie nog niet uitgevoerd. Zie [ontwerp en validatie](../docs/financieel-ontwerp.md).

## Trading Monitor 0.42.2 — prettige breedte op breedschermen

App gecentreerd met een maximale breedte van 1760 pixels inclusief navigatie. Kaarten en grafieken blijven compact op brede schermen; kleinere schermen behouden hun beschikbare ruimte. Build en frontendtests geslaagd. Broncodeversie zonder apart installatiepakket; serverinstallatie nog niet uitgevoerd. Bijwerken via Updates.

## Trading Monitor 0.42.1 — grotere uitklappijl en quotetabel

Kruisje vóór het vergrootglas, ruim klikvlak voor de uitklappijl en tabelvergelijking van verkoopput en koopput. Build en frontendtests geslaagd; bijwerken via Updates. Broncodeversie zonder apart installatiepakket; serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.42.0 — Yahoo Finance-optiechains

Volledige Yahoo-chains per expiratie met sessiehergebruik en private cache. Nieuwe keuze **Yahoo + IBKR-controle** in Option Scan; de broker controleert de geselecteerde contracten. Zelfstandig: `npm run scrape:yahoo -- AAPL 40 100` vanuit `source/`. [Handleiding en liveproef](../docs/yahoo-optiechains.md). Broncodeversie zonder apart installatiepakket. Yahoo-liveproef kreeg HTTP 429; geen bevestigde live-snelheidsclaim of serverinstallatie. Bijwerken kan via de bestaande pagina Updates.

## Trading Monitor 0.41.0 — bijwerken via de webapp

Pagina **Updates** met versiecontrole, installatie en voortgang. Nieuwe Linux-updateservice test en bouwt apart, maakt een webroot-back-up en herstart de bestaande services. Het handmatige updatescript installeert de service eenmalig; daarna kan bijwerken vanuit de browser. [Installatie en beperkingen](../docs/app-updates.md). Broncodeversie; geen apart installatiepakket. De serverinstallatie is nog niet uitgevoerd.

## Trading Monitor 0.40.0 — snellere optiechainverwerking en compacte tabel

Maximaal vier quoteaanvragen tegelijk met bestaande pacing, vroegere filtering en minder herberekeningen. Compacte/uitgebreide tabel met buffer, DTE, B/L en Jaar-R/R; extra sortering en CSV-veld. Zie [vergelijking](../docs/vergelijking-optiechain.md) en [serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Broncodeversie op GitHub; geen apart installatiepakket. Serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.39.2 — uitlijning spreadtabel

Vergrootglas, ticker, detailpijl en rode X staan samen onder Aandeel. Zoek- en sorteervelden hebben gelijke afmetingen; kolomkoppen volgen de uitlijning van de waarden. Broncode-update zonder apart installatiepakket; serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.39.1 — overige spreads en rode X

Het vergrootglas toont uitsluitend de overige spreads (bij vijf kandidaten: één in het overzicht, vier in het detail). Een rode X naast de ticker blokkeert het aandeel. Frontendversie zichtbaar in de tabelkop. Updatescript accepteert 0.39.1 in plaats van de oude 0.38.1. Geen nieuw installatiepakket; serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.39.0 — beste spread per aandeel

Option Scan toont één kandidaat per aandeel, met vergrootglas en aantal voor alle gevonden spreads. Sorteer op rendement/risico, maximale winst, maximaal verlies of IV-rank. Geen nieuw installatiepakket; bouwuitvoer staat in `source/dist/`. Zie [serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Nog niet op de server geïnstalleerd.

## Trading Monitor 0.38.1 — stappen inklappen

Stock Filter en IV Scan zijn als geheel afzonderlijk inklapbaar, met onthouden browserkeuze. Option Scan kan open blijven en behoudt de eerdere selecties. Geen nieuw installatiepakket; [serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Nog niet op de server geïnstalleerd.

## Trading Monitor 0.38.0 — automatisch Geblokkeerde Stocks

Aandelen zonder bevestigde bruikbare koers-/IV-data komen automatisch in de blokkeerlijst, inclusief reden en scanstap. Deblokkeren blijft beschikbaar. Geen nieuw installatiepakket; tijdelijke bouwuitvoer in `source/dist/`. [Serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Broncode-update; serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.37.1 — TradingView-links

Klikbare tickers in de drie scanoverzichten openen de eigen TradingView-layout in een nieuw venster/tabblad. Geen nieuw installatiepakket; tijdelijke bouwuitvoer in `source/dist/`. [Serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Broncode-update; serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.37.0 — sectoren in scanoverzichten

Stock Filter, IV Scan en Option Scan tonen sectoren, met blijvende metadatacache en sectorinformatie in CSV. Geen nieuw installatiepakket; tijdelijke build in `source/dist/`. [Serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Lokaal gevalideerde broncode-update; serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.36.1 — inklapbare aandelenlijst

Stock Filter-resultaten kunnen worden ingeklapt; de browser onthoudt de keuze. Geen nieuw installatiepakket; tijdelijke bouwuitvoer in `source/dist/`. [Serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Lokaal gevalideerd, nog niet op de server geïnstalleerd.

## Trading Monitor 0.36.0 — drie scans en Geblokkeerde Stocks

Stock Filter → IV Scan → Option Scan in Put spreads. Selecties en blokkeerlijst blijven bewaard; de weekplanning voert zondag de Stock Filter uit en maandag bij Amerikaanse beursopening de IV Scan. De Option Scan blijft handmatig. Geen nieuw installatiepakket; tijdelijke build binnen `source/dist/`. [Installatie en serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Lokaal getest, serverinstallatie niet uitgevoerd; de weekplanning draait dus nog niet op de server.

## Trading Monitor 0.35.0 — aandelenfilter en aparte optiescan

Opgeslagen aandelenvoorselectie via Yahoo Finance met IBKR-terugval, koersgrenzen en instelbaar minimum van 5 miljoen aandelen dagvolume. De optiescan start apart op de afgeronde selectie. Geen nieuw installatiepakket; tijdelijke build staat in `source/dist/`. [Serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Serverinstallatie niet uitgevoerd.

## Trading Monitor 0.34.1 — rustige scanweergave

Compacte scanteller/status en alleen passende spreads. Afwijzingsredenen, per-aandeelbeoordelingen en technische scanmeldingen worden niet meer getoond. Criteria en scanbeveiliging behouden. Geen nieuw installatiepakket; [serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Serverinstallatie niet uitgevoerd.

## Trading Monitor 0.34.0 — optievolume en zoekprofiel

Gemiddeld optievolume als voorfilter, laatst ontvangen dagvolume apart, bronophaaltijden, private volumecache en onbekende waarden zonder nulvervanging. Nieuwe standaardcriteria volgens het opgegeven zoekprofiel. Geen nieuw installatiepakket; [serverupdate](../docs/put-spreads.md#installatie-en-serverupdate). Geen serverinstallatie uitgevoerd.

## Trading Monitor 0.33.1 — IV en Gateway-belasting

Eén scanverbinding per run, één eerste IV-quoteverzoek, gedateerde historische IV-fallback en persistente/incrementele IV-cache. Wachtrij met pauzes en beveiliging na vijf opeenvolgende IV-fouten. Geen nieuw installatiepakket; [updatehandleiding](../docs/put-spreads.md#installatie-en-serverupdate). Serverinstallatie niet uitgevoerd.

## Trading Monitor 0.33.0 — broncode-update

Breed Amerikaans universum voor Put spreads, voorselectie vóór chainaanvragen, persistente ruwe optiecache en stoppen/hervatten. Geen nieuw installatiepakket; [updatehandleiding](../docs/put-spreads.md#installatie-en-serverupdate). Serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.32.0 — lokaal voorbereid

Bull-put-spreadscanner in de bestaande app, met frontend, Node-API en LAN-proxy. Er is geen nieuw installatiepakket beschikbaar; tijdelijke build staat in `source/dist/`. [Handleiding en serverupdate](../docs/put-spreads.md). Nog niet op de server geïnstalleerd; geen nieuwe controlesom voor een distributiepakket.

## Trading Monitor 0.31.8

Martin-scan gebruikt standaard officiële Nasdaq- en overige Amerikaanse beurslijsten in plaats van 29 vaste tickers. Automatische watchlists, per-aandeelkoerscache, stoppen/hervatten en paginering. Broncode via GitHub; geen apart installatiepakket. Frontend en API samen bijwerken volgens [serverupdate](../docs/martin-scanner.md#serverupdate-en-verificatie). Serverinstallatie nog niet uitgevoerd.

## Trading Monitor 0.31.7

**Martin-scan** staat in het menu en biedt scan starten, eigen tickerlijst, voortgang, opgeslagen watchlists en CSV-/TradingView-downloads. Uitgeleverd via GitHub-broncode; geen apart installatiepakket. Publiceer frontend en API samen met de [serverupdate](../docs/martin-scanner.md#serverupdate). Tests en lokale browsercontrole geslaagd; installatie op de server nog niet uitgevoerd.

Martin-selectiescanner v1.0 wordt als [Node.js-broncode](../source/scripts/scan-martin.mjs) geleverd, met [handleiding](../docs/martin-scanner.md). Er is geen afzonderlijk installatiepakket; de scanner maakt lokale Markdown-, CSV-, JSON- en TradingView-watchlists vanuit `source/`.

## Trading Monitor 0.31.6

IV Scan en Leaps worden uitgeleverd via de [GitHub-broncode](https://github.com/swanfield1979/TD). Er is geen afzonderlijk installatiepakket voor deze webappversie. Bouwuitvoer staat tijdelijk in `source/dist/`. Gebruik de [serverupdate-instructies](../docs/iv-leaps.md#serverupdate-via-github). De historische breakoutbroncode blijft bewaard en staat los van de vervallen Breakout-menupagina.

Er is nog geen kant-en-klaar distributiepakket beschikbaar. De productiebuild wordt vanuit [`../source/`](../source/) gemaakt en kan met de meegeleverde Nginx-, systemd- en IBKR-configuraties op de interne webserver worden geïnstalleerd. Zie de [installatiehandleiding](../docs/installatie.md).

## Trading Monitor 0.30.0

Verspreiding via de [GitHub-broncode](https://github.com/swanfield1979/TD). Er is geen afzonderlijk installatiepakket voor de webapp. Gebruik de [serverupdate](../docs/breakout-scanner.md#installatie-via-github) vanuit source. Python 3.12+ en Node 22.12+/24/26+ vereist. Productiecommando `npm run serve:lan` na dependency-installatie; optionele service wordt niet automatisch geïnstalleerd. Zie [LAN-handleiding](../docs/breakout-lan.md). Tests, build en lokale LAN/browserworkflow slagen; live installatie en IBKR-marktdata nog niet bevestigd. Tijdelijke build blijft in source/dist.

Aanvullende scanneracceptatie: 43 backendtests, 13 frontendtests, productiebuild en browserworkflow geslaagd. Installatiecommando en huidige deploymentgrenzen: [DEPLOYMENT.md](../docs/DEPLOYMENT.md). Er is hiervoor geen nieuw los distributiearchief.
