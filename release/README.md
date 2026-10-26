# Releases

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
