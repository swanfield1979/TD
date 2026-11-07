# Privacy van de repository

De huidige broncode en documentatie gebruiken algemene voorbeelden in plaats van persoonlijke servergebruikersnamen, installatiepaden en interne LAN-adressen. De openbare GitHub-repositorynaam en de bestaande auteurvermeldingen blijven behouden. Oude commits zijn op verzoek niet herschreven.

## Lokale installatie

- `trading-monitor` is een voorbeeld voor de servicegebruiker en groep; `/opt/trading-monitor` is een voorbeeld voor de checkout. Pas servicebestanden en sudoers aan de bestaande installatie aan voordat je ze installeert. Maak deze gebruiker en map vooraf aan als je dit voorbeeld volgt.
- Hostnamen onder `example.test` zijn uitsluitend documentatievoorbeelden. Vervang ze door het eigen serveradres.
- De standaard toegestane origin is `http://127.0.0.1`. Stel voor LAN-gebruik `IBKR_ALLOWED_ORIGINS`, `IBKR_REFRESH_ORIGIN` en eventueel `BREAKOUT_ALLOWED_ORIGINS` lokaal in op de werkelijk gebruikte browser-origin, inclusief poort indien nodig.
- Een bestaande expliciete lokale configuratie blijft leidend. Kopieer voorbeeldconfiguraties niet blind over een bestaande installatie.
- Houd IBKR-inloggegevens uitsluitend in de lokale IBC-configuratie met beperkte leesrechten. `.env`, privérapporten en gegenereerde rekeninggegevens horen niet in Git.

## Controle op 7 november 2026

De huidige bestanden en de lokaal beschikbare Git-geschiedenis zijn gecontroleerd op gangbare wachtwoord- en tokenpatronen. Er zijn geen echte wachtwoorden of toegangstokens gevonden. Deze controle omvat geen afzonderlijke GitHub Actions-logs of releasebijlagen. Een broncodecontrole biedt geen absolute garantie dat alle soorten gevoelige gegevens zijn uitgesloten.
