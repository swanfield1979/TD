# Bull-put-spreadscanner

Trading Monitor **0.32.0**, lokaal voorbereid op 24 oktober 2026. Open **Put spreads** in het menu of gebruik `/#put-spreads`. Deze uitbreiding blijft binnen de bestaande lokale app; geen nieuwe externe Site of publicatie.

## Gebruik

1. Vul maximaal 50 USD-aandelentickers in, gescheiden door komma’s of spaties. Met **IV-resultaten overnemen** neem je maximaal de eerste 50 unieke tickers uit de opgeslagen IV Scan over; de optiequotes worden opnieuw opgehaald na de scanstart.
2. Stel de criteria links in. Standaard: 80–100 kalenderdagen, IV-rank minimaal 20, short-strike minstens 25% onder de koers, maximale winst minimaal $50, maximaal verlies hoogstens $1.000, OTM-proxy minimaal 70% en bied-laatverschil per put hoogstens $1 per aandeel. Dit zijn aanpasbare startwaarden naar het voorbeeld, geen strategieadvies.
3. Klik **Scan starten**. Er wordt één quote tegelijk opgehaald met de bestaande IBKR-pacing en IV-historiecache. IV-rank vereist voldoende recente jaarhistorie. De scan kan lang duren; **Scan stoppen** behoudt reeds gevonden resultaten. Er kan één optiescan tegelijk lopen.
4. Zoek op ticker en sorteer op IV-rank, winst, verlies of rendement op risico. De tabel toont maximaal 50 spreads per pagina. Open een ticker voor beide bied-/laatprijzen, bronstatussen, ophaaltijden en handelsklasse. De brede tabel schuift binnen het resultatenpaneel.
5. **CSV exporteren** exporteert alle zichtbare zoekresultaten, over alle pagina’s, inclusief quote-tijden en bronstatuscodes (1 live, 2 bevroren, 3 vertraagd, 4 vertraagd/bevroren). Bedragen in USD; punt als decimaalteken, puntkomma als kolomscheiding.

Criteria en tickers worden na een geslaagde scanstart in de browser onthouden. De tabel vermeldt de werkelijk gebruikte scancriteria; wijzigingen links worden pas bij een nieuwe scan toegepast. De server bewaart resultaten en scancriteria in het bestaande private scanbestand. Na een serverherstart wordt een actieve scan als onderbroken hersteld; de uitbreiding hervat niet automatisch. Eerdere resultaten na een mislukte of gestopte nieuwe scan behouden hun eigen criteria en quote-tijden.

## Berekeningen en beperkingen

Per combinatie worden twee puts van hetzelfde aandeel, dezelfde expiratie en handelsklasse gebruikt, beide in USD met multiplier 100. De short-strike ligt boven de long-strike en onder de aandelenkoers. Onvolledige of gekruiste bied-/laatprijzen, negatieve/debetcredits en credits vanaf de volledige spreadbreedte worden afgewezen.

| Veld | Berekening |
| --- | --- |
| Netto credit per aandeel | Short-bied − long-laat |
| Maximale winst per spread | Credit × 100 |
| Maximaal verlies per spread | (Short-strike − long-strike − credit) × 100 |
| Break-even bij expiratie | Short-strike − credit |
| Rendement op risico | Maximale winst / maximaal verlies × 100% |
| Koersbuffer | (1 − short-strike / aandelenkoers) × 100% |
| OTM-proxy | (1 − absolute short-delta) × 100% |

Voorbeeld: verkoop de 75-put met bied $1,20 en koop de 65-put met laat $0,60. Credit $0,60; maximale winst $60; maximaal verlies $940; break-even $74,40; rendement op risico circa 6,38%. Geen commissies, slippage of financieringskosten inbegrepen. Maximaal verlies beschrijft het gecombineerde expiratieresultaat; vroegtijdige toewijzing kan extra kapitaal en beheer vereisen.

De delta-proxy is geen exacte kans op maximale winst, winst of maximaal verlies. De scanner toont geen externe Samurai-scores of totaal optievolume: die zijn niet beschikbaar in deze datastroom. Quotes worden na elkaar opgehaald, mogelijk vertraagd/bevroren, en vormen geen gegarandeerd uitvoerbare combinatieprijs.

De scan gebruikt het opgegeven universum, geen automatische volledige markt. Per ticker, expiratie en handelsklasse worden maximaal de 32 hoogste strikes onder de gekozen buffergrens gecontroleerd, binnen de opgegeven looptijd. Beide legs komen uit deze selectie. Er kunnen betere spreads buiten deze selectie bestaan. Ontbrekende brokerdata wordt gemeld; de app vult deze niet met voorbeeldkoersen aan.

## Architectuur

- `source/shared/put-spread.mjs`: filtervalidatie, putparen en financiële berekeningen; gedeelde TypeScript-declaraties ernaast.
- `source/server/csp-scanner.mjs`: aanvullende modus `spreads`, bestaande read-only IBKR-verbinding, pacing en cleanup.
- `GET /api/put-spreads`: status/resultaten. `POST /api/put-spreads`: `{ symbols: string[], filters: {...} }`. `POST /api/put-spreads/stop`: annuleren. Bestaande origin- en aanvraagheadercontrole geldt.
- `source/server/scan-store.mjs`: opslag en herstel via dezelfde atomaire scanopslag. Oudere bestanden zonder spreads blijven geldig.
- `source/backend/app/main.py`: LAN-proxy naar Node voor `put-spreads` en `put-spreads/stop`.
- `source/src/pages/PutSpreadPage.tsx`: geïntegreerde pagina met bestaande donkere/lichte thema’s; geen nieuwe afhankelijkheden.

## Installatie en serverupdate

Alle ontwikkel- en bouwcommando’s vanuit `source/`:

```powershell
npm ci
npm test
npm run test:frontend
npm run build
npm run dev:lan
```

Gebruik de bestaande IB Gateway-configuratie en datarechten; zie [IBKR](IBKR.md). Zonder bereikbare API/broker zijn geen actuele scanresultaten te verifiëren. Lokale frontend apart: `npm run dev -- --host 127.0.0.1 --port 5197`; Node-API apart: `npm run start:api`. Zorg dat die frontend-origin toegestaan is voor de Node-API. De gebruikelijke LAN-launcher regelt dit voor zijn eigen origin.

Serverupdate vereist frontend (`dist/`), Node (`server/`, `shared/`) én de bijgewerkte Python-LAN-proxy. Het bestaande script `bash deploy/update-options.sh` controleert nu versie 0.32.0, bouwt/test, publiceert en herstart de bestaande services. Gebruik dat pas op de bedoelde server na beschikbaar maken van deze bronwijzigingen; in deze taak is geen push of serverinstallatie uitgevoerd. Het script voert een aanvullende GET-controle op `/api/put-spreads` uit. Volg de [bestaande installatiehandleiding](installatie.md) voor een nieuwe installatie.

## Validatie

Gericht: `node --test tests/put-spread.test.mjs tests/put-spread-api.test.mjs`. Browser met expliciete testquotes: start de frontend op poort 5197 en voer `npm run test:spreads` uit. Screenshots staan uitsluitend lokaal in de genegeerde map `source/data/private/spread-validation/`. Dit zijn testgegevens, geen echte gevonden handelsmogelijkheden. Zie [validatie](validatie.md) voor de uitgevoerde controles.
