# Synchronisatielogboek — 0.43.2

Open **Logboek** in het menu (`/#logs`). De pagina toont de laatste 500 gebeurtenissen, nieuwste eerst, en ververst iedere vijf seconden. Je kunt filteren op bron of zoeken op sessie-ID. De weergave gebruikt Nederlandse tijd, inclusief zomer- en wintertijd (`Europe/Amsterdam`). Iedere nieuwe sessie krijgt een eigen ID; start, tussenstappen en resultaat gebruiken hetzelfde ID.

## Wat wordt vastgelegd?

| Bron | Wanneer |
| --- | --- |
| Appverzoek | Een geaccepteerd verzoek naar de synchronisatieroute, waaronder de knop Verbinden/Vernieuwen |
| Uurlijkse taak | Het synchronisatiescript meldt zich met `X-Sync-Source: scheduled` |
| API-opstart | De bestaande Gateway-verbinding wordt bij starten van de API gecontroleerd |
| Achtergrondcontrole | De bestaande Gateway-verbinding wordt elke minuut uitgelezen, ook zonder geopende browser |

Gebeurtenissen zijn onder andere: gestart, Gateway-start aangevraagd, wachten op verbinding/IB Key, geslaagd, offline, mislukt, verlopen, overgeslagen en onderbroken. API-opstart en achtergrondcontrole starten geen Gateway-aanmelding. Het bestaande appverzoek en de uurlijkse taak kunnen dat wel doen als de Gateway niet bereikbaar is. Een dubbele aanvraag tijdens een lopende synchronisatie wordt als overgeslagen vastgelegd; overlappende achtergrondcontroles starten geen extra sessie.

Een sessiestart is een synchronisatiepoging, niet noodzakelijk een nieuwe IBKR-login. Een Gateway-startverzoek kan tot een melding op de telefoon leiden. De app kan niet vaststellen of die melding daadwerkelijk is aangekomen of goedgekeurd; een geslaagde sessie betekent dat gegevens zijn opgehaald en opgeslagen. Fouten bij het opslaan van een snapshot starten geen extra Gateway-aanmelding.

## Opslag en herstel

De Node-API bewaart maximaal 5.000 gebeurtenissen in `ibkr-sync-log.json`, standaard naast de private IBKR-snapshot onder `/var/lib/trading-monitor/`. De app toont daarvan de recentste 500; oudere bewaarde regels zijn uitsluitend in het lokale bestand beschikbaar. Oudste regels vervallen automatisch. Bij doorlopend twee gebeurtenissen per minuut is de bewaartermijn ongeveer 41 uur, minder bij extra sessies. Het logboek begint na installatie van deze versie; oudere gebeurtenissen worden niet gereconstrueerd.

Een ander lokaal pad kan met `IBKR_SYNC_LOG_PATH` in `/etc/trading-monitor/ibkr.env`, gevolgd door een API-herstart. Kies een private, voor de service beschrijfbare locatie, nooit de webroot. De bestaande systemd-service staat schrijven onder `/var/lib/trading-monitor/` toe. Het bestand krijgt beperkte rechten (`0600`) en wordt atomair vervangen. Na een API-herstart krijgt een onafgemaakte sessie de gebeurtenis **Onderbroken**. Corrupte bestanden worden niet overschreven. Lees- of schrijffouten verschijnen in de app; nieuwe regels blijven waar mogelijk tijdelijk in het geheugen en het servicejournal staan.

De logregels bevatten tijdstip, sessie-ID, bron, gebeurtenis en vaste Nederlandse tekst. Geen wachtwoorden, tokens, rekeningnummers, posities, financiële bedragen of onbewerkte brokerfouten. De bestanden zijn uitgesloten van Git. Dezelfde vaste gebeurtenissen staan in het API-servicejournal:

```bash
sudo journalctl -u trading-monitor-api.service --since today | grep 'IBKR-sync'
```

## Grenzen van de registratie

De bron is een technische aanduiding op basis van de uitvoerroute en een aanvraagheader. Dit is geen geverifieerde gebruikersidentiteit of beveiligingsaudit. Het logboek voegt geen gebruikerslogin of netwerktoegangsbeveiliging toe. Afgewezen HTTP-verzoeken starten geen sessie en komen niet in dit synchronisatielogboek.

Zelfstandige loginpogingen/herstarts van IBC, IB Gateway of systemd buiten een app-synchronisatiesessie zijn niet afzonderlijk in dit app-logboek zichtbaar. Controleer bij herhaalde IB Key-meldingen ook:

```bash
sudo journalctl -u ibc-gateway.service -u trading-monitor-sync.service --since today
sudo systemctl status trading-monitor-sync.timer --no-pager
```

## Installatie en verificatie

Publiceer frontend en Node-API samen en herstart de API. De uurlijkse service verwijst naar het bijgewerkte script in de checkout; er is geen aparte logging-service nodig. Geen Flex-herimport vereist. Gebruik [Updates](app-updates.md) of voer vanuit de `source/`-map van de bestaande serverinstallatie uit:

```bash
bash deploy/update-options.sh
```

Controleer versie **0.43.3**, open **Logboek** en controleer de API-opstartsessie. Klik alleen als je wilt synchroniseren op **Verbinden/Vernieuwen**; deze poging moet als Appverzoek verschijnen. Een normaal uitgevoerde uurlijkse taak verschijnt als Uurlijkse taak. Deze versie is lokaal getest, niet op de productieserver geïnstalleerd en niet met een echte IBKR-login getest.

Ontwikkelcontroles vanuit `source/`:

```bash
node --test tests/ibkr-sync-log.test.mjs tests/ibkr-sync-api.test.mjs
npm test
npm run test:frontend
npm run build
# In een aparte terminal: npm run dev -- --port 5197 --strictPort
npm run test:sync-log
```

## Synchronisatie stoppen vanaf 0.43.3

Tijdens een lopende synchronisatie verschijnt **Synchronisatie stoppen** bij de IBKR-status, ook voor automatisch gestarte sessies. Op mobiel staat deze status onder de paginatitel. De knop onderbreekt de gegevensaanvraag of de wachttijd op verbinding/IB Key. De app sluit de socket van deze synchronisatie en bewaart de laatst opgeslagen snapshot. De knop toont **Stoppen…** totdat de server bevestigt dat de sessie is gestopt. In Logboek verschijnen **Stop aangevraagd** en **Gestopt**, met hetzelfde sessie-ID en de oorspronkelijke bron.

Als de sessie al atomair wordt opgeslagen of afgerond, is stoppen niet meer mogelijk. De knop is dan uitgeschakeld; bij een gelijktijdige aanvraag meldt de API dat afronding al bezig is. Een herhaald stopverzoek start geen extra werk. Bij een fout blijft de lopende status zichtbaar en kan stoppen opnieuw worden geprobeerd. Een nieuwe synchronisatie kan daarna via Verbinden/Vernieuwen worden gestart.

Deze knop stopt alleen de huidige app-synchronisatie. IB Gateway/IBC worden niet afgesloten, andere scans worden niet gestopt, de automatische planning blijft actief en een eerder verstuurd IB Key-verzoek kan niet worden ingetrokken. Een latere geplande synchronisatie kan dus opnieuw beginnen. Het stopverzoek gebruikt dezelfde origincontrole als synchroniseren; dit voegt geen gebruikersauthenticatie toe.

Technisch: `POST /api/ibkr/stop` gebruikt dezelfde vereiste headers als de refresh-route. De publieke status bevat `canStop`; de app gebruikt dit om stoppen tijdens afronden te voorkomen. Stoppen zonder actieve sessie is een onschadelijke actie en levert geen nieuwe loggebeurtenis op. Stop- en synchronisatielogging blijven bewaard na API-herstart.
