# Laatst opgeslagen IBKR-synchronisatie

Vanaf Trading Monitor **0.42.7** laadt de browser bij openen automatisch de laatst geslaagde IBKR-synchronisatie vanaf de server. Een actieve gatewayverbinding is hiervoor niet nodig. Bij opnieuw openen, een andere browser of een API-herstart blijft dezelfde synchronisatie beschikbaar.

De server bewaart elke geslaagde synchronisatie in `/var/lib/trading-monitor/live-snapshot.json`, of op het ingestelde pad `IBKR_SNAPSHOT_PATH`. Dit bestaande private bestand bevat saldo, posities, uitvoeringen en de synchronisatiedatum. Schrijven gebeurt via een tijdelijk bestand en een atomische vervanging. Mislukte gatewayaanvragen verwijderen de vorige synchronisatie niet. Private gegevens horen niet in Git of de openbare webroot.

De fout zat in het terugladen: de browser vroeg dit bestand alleen op bij de status `connected`. Dat is losgekoppeld. `/api/ibkr/status` en `/api/ibkr/snapshot` worden nu afzonderlijk opgevraagd. Een offline gateway of een fout in de statusaanvraag blokkeert de opgeslagen gegevens niet. De API herstelt bij opstart de laatste synchronisatiedatum uit het bestand, zonder daarmee een actieve gatewayverbinding te suggereren.

De browser controleert iedere 15 seconden op een nieuwere snapshot; tijdens handmatig synchroniseren iedere drie seconden. Deze leesaanvragen starten geen gateway en vragen geen IB Key-bevestiging. De knop Verbinden/Vernieuwen blijft bedoeld om nieuwe gegevens bij IBKR op te halen. De bestaande achtergrondtaak blijft synchroniseren zolang de gateway bereikbaar is.

Bij de koppeling staat **Laatste synchronisatie** met datum en tijd. De paginakop vermeldt **Laatste IBKR-synchronisatie**, ook bij Trades en Stats wanneer de snapshot wordt toegepast. De oude aanduiding 'IBKR live' is vervangen omdat de getoonde data een opgeslagen meting zijn.

Zonder eerder geslaagde synchronisatie blijft de historische Flex-basis zichtbaar. Een snapshot ouder dan de Flex-basis of met een andere valuta vervangt deze basis niet. Ontbrekende of ongeldige snapshotgegevens worden niet toegepast. Een tijdelijke leesfout wist een reeds geladen snapshot niet. Een ontbrekend bestand geeft HTTP 404; een onleesbaar bestand HTTP 500. De API verbergt het rekeningnummer in de browserrespons.

Vanaf **0.42.8** toont dit blok ook **Huidige week**: de ISO-week van de huidige datum in Europe/Amsterdam. Dit staat los van de synchronisatiedatum en wordt iedere minuut opnieuw bepaald. Op 31 oktober 2026 is dat week 44.

## Installatie en controle

Installeer versie **0.42.8** via **Updates → Controleren op updates → Versie 0.42.8 installeren**. Frontend en API moeten samen worden bijgewerkt. De broncodepush alleen installeert de wijziging niet op de server.

Synchroniseer eenmaal succesvol en noteer het saldo en de datum. Open daarna de app opnieuw terwijl de gateway niet verbonden is: hetzelfde saldo en dezelfde synchronisatiedatum moeten zichtbaar zijn zonder op Verbinden te klikken. Bestaande serverbestanden worden hergebruikt; er is geen datamigratie nodig.

Ontwikkelcontroles vanuit `source/`: `node --test tests/saved-snapshot-api.test.mjs`, `npm run test:frontend` en `npm run build`. Browsercontrole met Vite op 5197: `node scripts/verify-saved-snapshot-browser.mjs`. De controles gebruiken synthetische gegevens en geen live brokerverbinding.
