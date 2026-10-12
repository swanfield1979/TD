# Releases

Er is nog geen kant-en-klaar distributiepakket beschikbaar. De productiebuild wordt vanuit [`../source/`](../source/) gemaakt en kan met de meegeleverde Nginx-, systemd- en IBKR-configuraties op de interne webserver worden geïnstalleerd. Zie de [installatiehandleiding](../docs/installatie.md).

## Trading Monitor 0.28.0

Breakout wordt via de [GitHub-broncode](https://github.com/swanfield1979/TD) verspreid. Er is geen afzonderlijk installatiepakket voor de webapp. Bouw vanuit source en gebruik `bash deploy/update-breakout.sh` op de bestaande server; zie [installatie](../docs/breakout-scanner.md#installatie-via-github). Lokale tests/build en browsercontrole geslaagd; live installatie en marktdata nog niet bevestigd. Tijdelijke builduitvoer blijft in source/dist.
