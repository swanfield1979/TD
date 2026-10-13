# Releases

## Trading Monitor 0.31.6

IV Scan en Leaps worden uitgeleverd via de [GitHub-broncode](https://github.com/swanfield1979/TD). Er is geen afzonderlijk installatiepakket voor deze webappversie. Bouwuitvoer staat tijdelijk in `source/dist/`. Gebruik de [serverupdate-instructies](../docs/iv-leaps.md#serverupdate-via-github). De historische breakoutbroncode blijft bewaard en staat los van de vervallen Breakout-menupagina.

Er is nog geen kant-en-klaar distributiepakket beschikbaar. De productiebuild wordt vanuit [`../source/`](../source/) gemaakt en kan met de meegeleverde Nginx-, systemd- en IBKR-configuraties op de interne webserver worden geïnstalleerd. Zie de [installatiehandleiding](../docs/installatie.md).

## Trading Monitor 0.30.0

Verspreiding via de [GitHub-broncode](https://github.com/swanfield1979/TD). Er is geen afzonderlijk installatiepakket voor de webapp. Gebruik de [serverupdate](../docs/breakout-scanner.md#installatie-via-github) vanuit source. Python 3.12+ en Node 22.12+/24/26+ vereist. Productiecommando `npm run serve:lan` na dependency-installatie; optionele service wordt niet automatisch geïnstalleerd. Zie [LAN-handleiding](../docs/breakout-lan.md). Tests, build en lokale LAN/browserworkflow slagen; live installatie en IBKR-marktdata nog niet bevestigd. Tijdelijke build blijft in source/dist.

Aanvullende scanneracceptatie: 43 backendtests, 13 frontendtests, productiebuild en browserworkflow geslaagd. Installatiecommando en huidige deploymentgrenzen: [DEPLOYMENT.md](../docs/DEPLOYMENT.md). Er is hiervoor geen nieuw los distributiearchief.
