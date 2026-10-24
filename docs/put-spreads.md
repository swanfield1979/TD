# Bull-put-spreadscanner

Trading Monitor **0.34.1**, bijgewerkt op 24 oktober 2026. Open **Put spreads** in het menu of gebruik `/#put-spreads`. Deze uitbreiding blijft binnen de bestaande lokale app.

## Gebruik

Vanaf 0.34.1 toont de pagina alleen de criteria/bediening, het aantal gescande aandelen met korte status en de passende spreads. Afwijzingsredenen, per-aandeelbeoordelingen, technische meldingen en uitlegpanelen zijn niet zichtbaar. De diagnostiek wordt intern behouden voor opslag, beveiliging en hervatten. Onderstaande technische uitleg staat uitsluitend in deze handleiding.

1. Standaard staat **Alle Amerikaanse aandelen** geselecteerd: alle gewone aandelen en ADR’s uit de officiële Nasdaq- en overige Amerikaanse beurslijsten, zonder 50-aandelenlimiet. Alle noteringen worden beoordeeld; optiegeschiktheid wordt via IBKR vastgesteld. Het universum bevat ook namen zonder bruikbare optiedata. Geen wereldwijde dekking, ETF’s, preferente aandelen of warrants. Optioneel kun je **Eigen tickers** kiezen (maximaal 50 USD-tickers). **IV-resultaten overnemen** kiest die eigen modus met maximaal 50 tickers.
2. Stel de criteria links in. Standaard minimaal 5.000 gemiddeld verhandelde optiecontracten volgens IBKR, koers $5–$150, 40–100 kalenderdagen, IV-rank minimaal 20, short-strike minstens 25% onder de koers, maximale winst minimaal $15, maximaal verlies hoogstens $1.000, OTM-proxy minimaal 70% en bied-laatverschil per put hoogstens $1 per aandeel. Dit is een aanpasbaar zoekprofiel naar de opgegeven waarden, geen gevalideerd optimaal handelsprofiel. Nieuwe waarden gelden bij nieuwe browservoorkeuren of **Criteria herstellen**; bestaande eigen waarden blijven bewaard.
3. Klik **Scan starten**. Er wordt één quote tegelijk opgehaald met de bestaande IBKR-pacing en IV-historiecache. IV-rank vereist voldoende recente jaarhistorie. De scan kan lang duren; **Scan stoppen** behoudt reeds gevonden resultaten. Er kan één optiescan tegelijk lopen.
4. Zoek op ticker en sorteer op IV-rank, winst, verlies of rendement op risico. De tabel toont maximaal 50 spreads per pagina. Open een ticker voor beide bied-/laatprijzen, bronstatussen, ophaaltijden en handelsklasse. De brede tabel schuift binnen het resultatenpaneel.
5. **CSV exporteren** exporteert alle zichtbare zoekresultaten, over alle pagina’s, inclusief quote-tijden en bronstatuscodes (1 live, 2 bevroren, 3 vertraagd, 4 vertraagd/bevroren). Bedragen in USD; punt als decimaalteken, puntkomma als kolomscheiding.

Criteria, universumkeuze en tickers worden na een geslaagde scanstart in de browser onthouden. De tabel vermeldt de werkelijk gebruikte scancriteria; wijzigingen links worden pas bij een nieuwe scan toegepast. De server bewaart resultaten, aandelenbeoordelingen, universum en cursor in het bestaande private scanbestand. Na een serverherstart wordt een actieve scan als onderbroken hersteld. **Scan hervatten** gaat met dezelfde filters en hetzelfde universum verder na het laatst volledig beoordeelde aandeel; bij een onderbreking tijdens een aandeel wordt dat aandeel opnieuw bekeken. Bij gewijzigde criteria kies je **Scan starten**. Oude resultaten worden bij hervatten op actuele resterende dagen gecontroleerd.

## Voorselectie en oude chains

Vanaf 0.34.0 wordt **gemiddeld optievolume** eerst opgevraagd of uit recente cache gelezen, via de aandelenquote. Onder het minimum worden IV-historie en optiechain niet opgevraagd. Daarna volgen koers en IV-rank. Het dagvolume wordt apart getoond als **Laatste dagvolume**, omdat dit uit een eerdere sessie kan komen en vroeg op een handelsdag nog laag is. Aandelenvolume wordt hiervoor niet gebruikt. Een hoog totaal optievolume garandeert geen liquide specifieke strike; de bied-laatcontrole op beide puts blijft nodig.

Volgens [IBKR streaming-data](https://www.interactivebrokers.com/docs/tws-api/doc/md/streaming-data) geeft generic tick 105 gemiddeld optievolume via `tickSize` 87, en generic tick 100 call-/putdagvolume via 29 en 30. De app vraagt `100,105,106` in één streamingaanvraag voor het aandeel wanneer volume moet worden opgehaald. Dit vereist beschikbare generieke live data voor de API-gebruiker. Bevroren/vertraagde standaardkoersen leveren deze velden niet vanzelf. Er worden geen betaalde regulatory snapshots gebruikt. Als het filter op 0 staat, zijn volumevelden optioneel/onbekend en worden de extra volume-generic-ticks niet opgevraagd.

Beide dagvolumecomponenten moeten bekend zijn om een totaal te tonen; één ontbrekende kant wordt niet als nul ingevuld. Een expliciet ontvangen nul is wel geldig en voldoet niet aan een positief volumeminimum. Geen 100-aandelenmultiplier op optiecontractvolume. Gemiddelde en dagvolume hebben afzonderlijke ophaaltijden. De gemiddeldeperiode wordt door IBKR bepaald; de app presenteert dit niet als een zelf berekend 20-/90-daags gemiddelde.

Beschikbare waarden worden onafhankelijk van een succesvolle chain in `volume-<hash>.json` in de private cache bewaard. Cachewaarden ouder dan zeven kalenderdagen of met een toekomstige/ontbrekende ophaaltijd gelden als onbekend. De bronophaaltijd schuift bij hergebruik niet mee. Op een nieuwe open handelsdag wordt een nieuwe volumewaarde geprobeerd; bij uitval kan een nog geldige cachewaarde worden gebruikt, zichtbaar met de oorspronkelijke datum. Ook cached chains moeten aan het actieve volumefilter voldoen. Legacy chains zonder volume worden dus niet automatisch goedgekeurd. Onbekend volume geeft **Data ontbreekt**; vijf opeenvolgende vereiste IV-/volumefouten pauzeren de job. Verzamel eerst beschikbare gegevens tijdens beursuren, of zet het minimum bewust op 0 en start een nieuwe scan. Geen claims dat een nulinstelling de liquiditeit bevestigt.

Na het volumefilter wordt de koers gecontroleerd: buiten de grenzen worden IV-historie en chain niet opgehaald. Daarna wordt IV-rank getoetst; bij een te lage IV-rank wordt geen chain aangevraagd. Looptijd en buffer beperken vervolgens de contractselectie. Premie, risico, bied-laatverschil en delta zijn pas met optiegegevens toetsbaar. De afzonderlijke aandelenbeoordelingen worden intern bewaard, maar staan niet op de pagina. Het tickerzoekveld doorzoekt alleen de passende spreads.

Bij de opgegeven grenswaarden is $15 maximale winst tegenover $1.000 maximaal verlies slechts 1,5% bruto op risico; dit is geen verwacht rendement en kosten zijn niet inbegrepen. De 25%-buffer kan veel puts met lage premie opleveren, zeker dichter bij 40 DTE. Een bied-laatgrens van $1 per aandeel is relatief ruim bij goedkope opties. Dit zoekprofiel is dus breed op IV/premie, maar streng op afstand tot de aandelenkoers. Bekijk bij concrete resultaten ook rendement op risico en beide bied-/laatprijzen; de filters betekenen niet dat een gevonden spread aantrekkelijk of uitvoerbaar is.

Een brede eerste run kan vele uren duren door IBKR-pacing en IV-historie. De scan loopt door het volledige geladen universum; voortgang toont hoeveel namen daadwerkelijk zijn gecontroleerd. De bronlijst wordt lokaal bewaard en bij bronuitval met datum hergebruikt. De bronnen zijn [Nasdaq-noteringen](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt) en [overige Amerikaanse noteringen](https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt).

### IV-fouten en Gateway-belasting

De melding uit 0.33.0 dat actuele IV ontbreekt bewijst niet dat de Gateway is overbelast of dat een abonnement ontbreekt. De app ontving geen bruikbare tick-106-IV en stopte daardoor ten onrechte vóór de aanvraag van IV-daghistorie. Volgens [IBKR zijn ticks niet altijd voor elk instrument beschikbaar](https://interactivebrokers.github.io/tws-api/tick_types.html); controle in TWS blijft nodig om beschikbaarheid en rechten vast te stellen.

Vanaf 0.33.1 doet Put spreads één eerste aandelenquoteverzoek. Ontbreekt actuele IV, dan probeert de app één `OPTION_IMPLIED_VOLATILITY`-dagreeks, of gebruikt de geldige reeds opgeslagen reeks. Met voldoende jaarhistorie kan de laatste geldige dag-IV als referentie dienen. Maximaal zeven kalenderdagen oud, minimaal 200 waarnemingen en voldoende jaarspreiding; een vlakke of onvolledige reeks geeft geen IV-rank. Tijdens een open markt gebruikt de historische terugval uitsluitend een eerdere dag, geen nog onvoltooide dagbar. Deze referentie wordt zichtbaar als **Dag-IV met datum**, ook bij gefilterde aandelen en in CSV (`ivSource`, `ivAsOf`). Het is geen actuele IV-quote. Het IV-filter wordt niet uitgeschakeld en ontbrekende waarden worden niet verzonnen.

De ruwe IV-dagreeks staat los van de chaincache in `iv-<hash>.json` naast de private chainbestanden en blijft na een herstart bewaard. Dezelfde beursdag wordt hergebruikt; bij gesloten markt mag een nog geldige reeks ouder zijn. Bij een nieuwe open handelsdag wordt een geldige bestaande reeks met een tien-dagenaanvraag aangevuld en ontdubbeld. Zonder bruikbare oudere reeks wordt één jaar gevraagd. De app gebruikt geen historische volatiliteit als vervanging voor impliciete volatiliteit.

De belasting wordt begrensd door:

- één fysieke read-only scanverbinding per run, hergebruikt voor volgende aandelen;
- één quote/historieverzoek tegelijk en oplopende request-ID’s;
- bestaande applicatiepacing: minimaal 0,5 seconde tussen aanvragen, 11 seconden tussen historieverzoeken, maximaal 55 historieverzoeken per tien minuten en 15 seconden tussen identieke historieverzoeken;
- één seconde rust tussen brokerbeoordelingen en twintig seconden na 25 brokerbeoordelingen; cachebeoordelingen doen geen onnodige broker-wachtrondes;
- annuleren van subscriptions en historieverzoeken, plus stoppen op IBKR-pacingmeldingen;
- pauze na vijf opeenvolgende aandelen zonder bruikbare IV/historie. De scan bewaart waar die reeks begon. **Scan hervatten** probeert die aandelen opnieuw; ze worden niet stilzwijgend als afgehandeld overgeslagen. Er volgt geen automatische stroom retry’s.

Dit zijn conservatieve applicatiegrenzen, geen garantie dat andere TWS/API-clients geen belasting veroorzaken. [IBKR beschrijft de harde 60/10-minutenregel voor kleine bars en ook zachte throttling bij grotere bars](https://interactivebrokers.github.io/tws-api/historical_limitations.html); de app houdt de bovengenoemde ruime marge ook voor dagbars aan. Een volledige eerste opbouw voor duizenden aandelen kan een lange sessie of meerdere sessies kosten. Stoppen en hervatten behoudt de voortgang.

Als ook daghistorie ontbreekt, controleer in TWS bij een bekend optieaandeel of **Option Implied Volatility** en de IV-daggrafiek beschikbaar zijn, en controleer of marktdatarechten voor de ingelogde API-gebruiker gelden. [Vertraagde koersen betekenen niet automatisch toegang tot historische marktdata](https://interactivebrokers.github.io/tws-api/delayed_data.html). De software kan ontbrekende bronrechten niet omzeilen. De scanner pauzeert dan in plaats van een volledige, geslaagde beoordeling te suggereren.

Na een geslaagde chainbeoordeling bewaart de server de ruwe opgevraagde putquotes, chainmetadata, koers, IV-rank en selectiecriteria per aandeel. Het gaat om de geselecteerde contracten, niet alle contracten van de volledige chain. Bij gesloten reguliere optiemarkt wordt deze opgeslagen selectie opnieuw met je huidige filters beoordeeld, zonder brokerverzoeken voor dat aandeel. De oude koers/IV-rank en beide originele ophaaltijden blijven behouden. Cachelabels staan bij de spread en in CSV. Resterende dagen worden opnieuw berekend; verlopen puts tellen niet mee. Een ruimere looptijd of lagere buffer dan de opgeslagen selectie geeft een melding van onvolledige dekking.

Zonder lokale chain probeert de scanner de bestaande bevroren/vertraagde IBKR-data. Bij een ontbrekende brokerverbinding worden andere aandelen met cache wel beoordeeld; ontbrekende chains krijgen de status **Data ontbreekt**. Tijdens een open markt worden brokerquotes opnieuw geprobeerd, met terugval op cache bij data-uitval. Zonder eerder opgehaalde of via IBKR beschikbare quotes kan geen oude chain worden verzonnen. De eerste cache moet dus worden opgebouwd. Weekenden, NYSE-feestdagen en verkorte handelsdagen gebruiken de bestaande sessiekalender; pre-/post-market telt als gesloten voor deze optiescan. De kalender is gevuld voor 2026–2028.

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

De scan gebruikt standaard het brede Amerikaanse aandelenuniversum. Per passend aandeel, expiratie en handelsklasse worden maximaal de 32 hoogste strikes onder de gekozen buffergrens gecontroleerd, binnen de opgegeven looptijd. Beide legs komen uit deze selectie. Er kunnen betere spreads buiten deze selectie bestaan. Ontbrekende brokerdata wordt gemeld; de app vult deze niet met voorbeeldkoersen aan. Ophaaltijden beschrijven wanneer de app de brokerdata ontving, niet een gegarandeerde beursquotetijd.

## Architectuur

- `source/shared/put-spread.mjs`: filtervalidatie, putparen en financiële berekeningen; gedeelde TypeScript-declaraties ernaast.
- `source/server/csp-scanner.mjs`: aanvullende modus `spreads`, bestaande read-only IBKR-verbinding, pacing en cleanup.
- `source/server/spread-scan.mjs`: breed universum, voorselectieresultaten, cachekeuze, voortgang en cursor. `spread-cache.mjs`: per-aandeel atomaire JSON-opslag met gatewaycontrole, standaard in `put-spread-cache/` naast de private IBKR-snapshot. Deze map staat buiten de publieke webroot. Geen extra dependencies.
- `source/server/scan-connection.mjs`: fysieke verbinding per job, tijdelijke eventlisteners per aandeel en gedeelde request-ID-teller. `source/shared/iv-reference.mjs`: geldigheid en datum van actuele of historische IV-referentie.
- `source/shared/option-volume.mjs`: gemiddelde/dagvolume, expliciet onbekend tegenover nul, cacheouderdom en volumefilter. `minAvgOptionVolume` is een geheel getal vanaf 0 in de bestaande filters-API. Resultaten/CSV bevatten `avgOptionVolume`, `avgOptionVolumeAt`, `dayOptionVolume`, `dayOptionVolumeAt` en `volumeSource`. Een oudere onvoltooide scan zonder volumefilter moet opnieuw worden gestart om dit nieuwe criterium ook op eerdere aandelen toe te passen.
- `GET /api/put-spreads`: status/resultaten. `POST /api/put-spreads`: `{ universeMode: "us" | "custom", symbols?: string[], filters: {...}, resume?: boolean }`; standaard brede modus zonder tickers, eigen modus maximaal 50. `POST /api/put-spreads/stop`: annuleren. Bestaande origin- en aanvraagheadercontrole geldt.
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

Serverupdate vereist frontend (`dist/`), Node (`server/`, `shared/`) en de bestaande bijgewerkte Python-LAN-proxy. Het bestaande script `bash deploy/update-options.sh` controleert nu versie 0.34.1, bouwt/test, publiceert en herstart de bestaande services. Er is geen serverinstallatie vanuit deze ontwikkelomgeving uitgevoerd. Het script voert een aanvullende GET-controle op `/api/put-spreads` uit. Volg de [bestaande installatiehandleiding](installatie.md) voor een nieuwe installatie.

## Validatie

Gericht: `node --test tests/put-spread.test.mjs tests/put-spread-api.test.mjs tests/spread-universe-cache.test.mjs`. Browser met expliciete testquotes: start de frontend op poort 5197 en voer `npm run test:spreads` uit. Screenshots staan uitsluitend lokaal in de genegeerde map `source/data/private/spread-validation/`. Dit zijn testgegevens, geen echte gevonden handelsmogelijkheden. Zie [validatie](validatie.md) voor de uitgevoerde controles.
