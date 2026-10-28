# Yahoo Finance-optiechains

Trading Monitor **0.42.0** bevat een zelfstandige Yahoo-scraper en een voorselectie voor **Put spreads → 3. Option Scan**. De implementatie gebruikt Node.js; er zijn geen extra Python-pakketten of accounts nodig.

## Gebruik in de monitor

Rond Stock Filter en IV Scan af. Kies bij **Optiechainbron** voor **Yahoo + IBKR-controle** en start de optiescan. De browser onthoudt de keuze. Standaard blijft de rechtstreekse IBKR-scan geselecteerd. Hervatten gebruikt dezelfde bron als de gestopte scan; voor een andere bron start je een nieuwe scan.

Yahoo levert per opgevraagde expiratie een volledige call- en putchain. De monitor filtert de standaardputs op koersbuffer, bied-laatverschil, conservatieve credit en maximaal verlies. Van de twintig hoogst gerangschikte spreadparen worden de unieke benen geselecteerd. De IBKR-chainmetadata bevestigen beschikbare expiraties, strikes, handelsklasse en multiplier. Alleen de geselecteerde contracten krijgen vervolgens een brokerquoteaanvraag.

Alle spreads in de uiteindelijke tabel worden berekend met **IBKR-bied/laat en IBKR-delta**, inclusief de bestaande IV-rank-, gemiddelde-optievolume- en OTM-filters. Yahoo levert hiervoor geen verzonnen delta, winstkans of gemiddeld optievolume. In de quote-details en CSV staan `discoverySource` en `yahooFetchedAt`; ophaaltijden uit de cache worden niet vernieuwd alsof de gegevens net zijn gedownload.

De voorselectie is indicatief. Vertraagde Yahoo-koersen, ontbrekende quotes en de beperking tot twintig paren kunnen passende IBKR-spreads missen. Bij het combineren van de gecontroleerde benen kunnen meer dan twintig resultaatregels ontstaan. De oude IBKR-modus blijft beschikbaar voor de bredere bestaande dekking.

## Zelfstandige scraper

Voer vanuit `source/` uit:

```bash
npm run scrape:yahoo -- AAPL 40 100
```

Dit vraagt alle beschikbare expiraties binnen 40–100 kalenderdagen op en bewaart genormaliseerde standaardcalls en -puts onder `source/data/private/yahoo-options/AAPL.json`. Zonder de laatste twee argumenten geldt hetzelfde bereik. De uitvoer meldt aantallen contracten, expiraties, chainaanvragen, cachehits en de verstreken tijd. De twee sessieaanvragen tellen niet als chainaanvragen. De gemeten tijd kan bij cachegebruik niet als nieuwe downloadtijd worden beschouwd.

Velden: ticker, contractcode, expiratie, richting, strike, multiplier, valuta, bied/laat, laatst verhandelde prijs, volume, open interest, impliciete volatiliteit, laatste transactietijd en ophaaltijd. Ontbrekend volume of open interest blijft `null`; de laatste transactietijd is geen quote-timestamp. Afwijkende of aangepaste contractcodes, andere valuta en niet-standaardcontractgroottes worden uitgesloten. De prijs uit de chainmetadata is een Yahoo-aandeelkoers met eigen brontijd.

## Sessies, cache en fouten

De scraper gebruikt de normale anonieme Yahoo-cookie-/crumbsessie. Er zijn maximaal twee expiratieaanvragen tegelijk en minimaal 350 ms tussen aanvraagstarts. De server deelt één sessie tussen scans. Ruwe antwoorden worden tien minuten privé gecachet, apart van IBKR-chains. CLI-cache: `source/data/private/yahoo-options/cache/`; API-cache: `yahoo-option-chains/` naast de bestaande live-snapshot.

HTTP 401, 403 of 429 pauzeert de scan op het huidige aandeel. Er worden geen proxies, hostrotatie of automatische omzeilpogingen toegepast. Wacht en hervat, of start een nieuwe scan met **IBKR**. Andere Yahoo-bronfouten geven een waarschuwing en gebruiken de bestaande IBKR-scan. Yahoo-uitval blokkeert op zichzelf geen aandeel in Geblokkeerde Stocks. Stoppen annuleert ook lopende Yahoo-aanvragen.

Yahoo is geen gegarandeerde brokerfeed. Het gebruik van de optiestructuur is vergeleken met de [yfinance-broncode](https://github.com/ranaroussi/yfinance/blob/main/yfinance/ticker.py) en de [sessieafhandeling](https://github.com/ranaroussi/yfinance/blob/main/yfinance/data.py). De bron is onofficieel en kan wijzigen.

## Validatie en publicatie

223 Node-tests, 13 frontendtests en de productiebuild slagen. Gerichte tests controleren normalisatie, sessiehergebruik, één aanvraag per geselecteerde expiratie, hergebruik na een herstart, oorspronkelijke cachetijden, annulering, toegangs-/snelheidslimieten, brokerfallback en voorselectie. De brokeradaptertest bevestigt dat alleen de geselecteerde benen worden opgevraagd en dat de uiteindelijke credit van IBKR komt. De browserworkflow controleert bronkeuze, opslag/hervatten en de bestaande scanbediening.

Een live CLI-proef op 28 oktober 2026 kreeg **HTTP 429** tijdens het starten van de Yahoo-sessie. De foutafhandeling werkte; een succesvolle live-download en een snelheidsclaim van één à twee seconden zijn vanuit deze omgeving niet bevestigd. Test dit na installatie vanaf de eigen server met het bovenstaande CLI-commando.

Gebruik **Updates** in de webapp als de updateservice al is geïnstalleerd. Anders geldt de [eenmalige handmatige update](app-updates.md). Er zijn geen nieuwe systeemrechten of afhankelijkheden toegevoegd. De serverinstallatie is vanuit deze ontwikkelomgeving nog niet uitgevoerd.
