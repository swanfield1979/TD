# Bull-put-spreadscanner

Trading Monitor **0.42.0**, bijgewerkt op 28 oktober 2026. Open **Put spreads** in het menu of gebruik `/#put-spreads`. Deze uitbreiding blijft binnen de bestaande lokale app.

## Nieuw in 0.42.0: Yahoo-voorselectie

Kies bij **Optiechainbron** voor **Yahoo + IBKR-controle**. Volledige Yahoo-chains worden vooraf lokaal gefilterd; de benen van maximaal twintig spreadparen gaan daarna naar IBKR. De tabel bevat uitsluitend resultaten op IBKR-quotes en -delta. Rechtstreeks IBKR blijft standaard. [Werking, CLI-scraper en bronbeperkingen](yahoo-optiechains.md).

## Nieuw in 0.40.0

Versie 0.40.0 voegt compacte optiechainresultaten, Jaar-R/R en extra sorteringen toe. De scanner verwerkt maximaal vier quotes tegelijk met behoud van pacing en filtert ongeschikte benen vóór het combineren. Standaard staan sector en aandeelvolumes in de uitgebreide weergave; alle gegevens blijven in CSV beschikbaar. Jaar-R/R is R/R × 365 / DTE, vóór kosten, als lineaire vergelijkingsmaat. Zie [onderzoek, keuzes en validatie](vergelijking-optiechain.md).

## Uitlijning van de resultaten

Vanaf 0.39.2 staan vergrootglas met aantal, ticker met detailpijl en rode verwijderknop samen in één links uitgelijnde kolom **Aandeel**. De sector staat links; bedragen en percentages rechts onder hun kolomkop. Zoek- en sorteervelden hebben dezelfde hoogte en breedte. De korte regel boven de tabel toont aantallen en rangschikking; de uitleg van rendement/risico staat bij de kolomkop. De detailpijl opent nog steeds bied-/laatprijzen en brontijden, de ticker opent TradingView.

## Beste spread per aandeel

Option Scan toont één spread per aandeel. Standaard staat de kandidaat met het hoogste **Rendement op risico** vooraan: maximale winst ÷ maximaal verlies × 100%, over de looptijd van de trade en vóór kosten. Bedrijfskwaliteit en Samurai-scores maken geen deel uit van deze rangschikking.

Via **Sorteren op** kies je de maatstaf. Bij maximale winst wordt per aandeel de spread met de hoogste maximale winst gekozen; bij maximaal verlies die met het laagste maximale verlies. Bij gelijkstand volgen rendement/risico, maximale winst, lager verlies en de vaste spread-ID. **Hoog → laag / Laag → hoog** verandert de weergavevolgorde en behoudt de beste kandidaat per aandeel.

Klik het **vergrootglas met aantal** links van de ticker voor uitsluitend de overige gevonden spreads van dat aandeel. Bij vijf SE-spreads staat SE eenmaal met de beste spread in het overzicht; het vergrootglas toont de andere vier. De bij openen gekozen beste spread blijft tijdens sorteren in het detail uitgesloten. Bij één kandidaat is het vergrootglas met aantal 0 uitgeschakeld. Een rode X direct achter de ticker vervangt de tekstknop Verwijder; hij voegt het volledige aandeel toe aan Geblokkeerde Stocks. De tabel gebruikt dezelfde sorteerkeuze en is standaard aflopend. Kies **Maximale winst** voor de hoogste potentiële dollarwinst bovenaan. **Terug naar aandelen** opent het overzicht op de pagina van dat aandeel en herstelt de toetsenbordfocus. Zoeken blijft behouden. Overzicht en detail tonen maximaal 50 regels per pagina.

CSV vanuit het overzicht bevat alle gevonden spreads binnen het tickerzoekfilter, inclusief verborgen alternatieven en volgende pagina’s. CSV vanuit het detail bevat de overige spreads van het geopende aandeel, zonder de in het overzicht gekozen beste spread. Openen, sorteren en exporteren starten geen nieuwe scan of brokerverzoeken. De alternatieven zijn beperkt tot opgehaalde contracten die aan de scancriteria voldoen; er wordt hiermee geen volledige optieketen aangevraagd.

Klik bij **1. Stock Filter** en **2. IV Scan** op **Inklappen** om de volledige stap te sluiten. In de kop blijven de stapnaam, het aantal geselecteerde aandelen en **Uitklappen** zichtbaar. Beide stappen kunnen dicht blijven terwijl **3. Option Scan** open is. De browser bewaart beide keuzes afzonderlijk, ook na herladen. Inklappen wist geen criteria, zoektekst of selectie en onderbreekt de statusopvragingen en scans niet. De onderstaande aandelenlijst kan daarnaast nog afzonderlijk worden ingeklapt.

Klik op **Geselecteerde aandelen (aantal)** om de Stock Filter-lijst in of uit te klappen. Zoeken, tabel en paginering klappen samen in; criteria en voortgang blijven zichtbaar. De browser onthoudt de keuze na herladen. Inklappen wijzigt de opgeslagen selectie niet en houdt de IV Scan beschikbaar.

Klik op een ticker in Stock Filter, IV Scan of Option Scan om de TradingView-layout `fxY1us9e` met dat aandeel te openen. De URL heeft de vorm `https://www.tradingview.com/chart/fxY1us9e/?symbol=TSLA`. De link opent via een nieuw tabblad/venster, afhankelijk van je browserinstellingen. Klassevarianten worden als `BRK.B` doorgegeven. In de spreadtabel kun je de quote-details nog steeds via het uitklappijltje openen.

## Sectoren in de overzichten

Vanaf 0.37.0 tonen Stock Filter, IV Scan en Option Scan een kolom **Sector**. Technology wordt als **Tech** getoond; overige labels zijn bijvoorbeeld Energy, Financials, Healthcare, Industrials en Utilities. Zonder bruikbare bronclassificatie staat er **Onbekend**. Beweeg over de sector voor bron en ophaaltijd. Sector is aanvullende informatie, geen nieuw selectiecriterium. De CSV bevat `sector`, `sectorSource` en `sectorAsOf`.

De [Nasdaq-screener](https://www.nasdaq.com/market-activity/stocks/screener) levert de classificaties in één bulkaanvraag voor het Amerikaanse universum. De aparte private cache `stock-sectors.json` naast `IBKR_SNAPSHOT_PATH` overleeft serverherstarts en wordt na zeven dagen ververst. Voor ontbrekende aandelenkandidaten wordt Yahoo Finance gebruikt, uitsluitend bij een exact overeenkomende equityticker. Een resultaat voor een vergelijkbare naam wordt niet overgenomen. Ontbrekende classificaties worden een dag onthouden; bronbegrenzing voorkomt herhaalde mislukte aanvragen.

IBKR kan ontbrekende sectoren aanvullen vanuit `industry` in de al opgehaalde [contractdetails](https://www.interactivebrokers.com/docs/tws-api/ref/contract-details). Hiervoor wordt geen extra IBKR-aanvraag gedaan. Er wordt niet geraden op basis van bedrijfsnaam, branchebeschrijving of ticker. Bronlabels worden naar een vaste set sectorlabels vertaald, maar de onderliggende bronclassificatie kan afwijken van Yahoo/GICS; Nasdaq classificeert bijvoorbeeld sommige autobouwers bij Industrials.

Sectorgegevens worden met nieuwe selecties opgeslagen en aan de volgende stappen doorgegeven. Bestaande opgeslagen rijen zonder sector worden bij openen op de achtergrond aangevuld, zonder koers-/IV-datum te vernieuwen of een nieuwe scan te starten. Sectoruitval blokkeert de prijs-/volumevoorselectie niet: bekende metadata blijven met hun oorspronkelijke datum beschikbaar, anders verschijnt Onbekend. `SECTOR_LOOKUPS_DISABLED=1` voorkomt externe sectorverzoeken in API-tests; eerder bewaarde metadata blijven leesbaar.

## Drie stappen vanaf 0.36.0

1. **Stock Filter**: minimum-/maximumkoers en minimaal 5.000.000 verhandelde aandelen per afgesloten handelsdag, aanpasbaar. Yahoo Finance als eerste bron, IBKR als terugval. Klik **Aandelenfilter starten**. De selectie en ruwe daggegevens worden op de server bewaard.
2. **IV Scan**: start alleen op de afgeronde, opgeslagen Stock Filter. Minimum IV-rank standaard **40**, aanpasbaar van 0–100; de grens is inclusief. IBKR levert IV en de vereiste recente jaarhistorie. Geen optiechainaanvragen in deze stap. De tabel toont IV-rank, IV-percentile, IV, bron en datum. Bevestigde ontbrekende IV-gegevens worden automatisch geblokkeerd en uitgesloten. Bij onduidelijke of algemene dataproblemen blijft de pauze na vijf mislukte reeksen op rij bestaan; stoppen en hervatten behouden de cursor. Eerder gedocumenteerde IV-jaar-/recentheidseisen blijven gelden.
3. **Option Scan**: klik zelf **Optiescan starten** nadat beide voorgaande stappen zijn afgerond. Alleen de IV-selectie gaat door naar de bestaande put-spreadscanner. De overige optiecriteria, behoudende creditberekening, oude optiechaincache en bied-laatcontroles blijven gelden. De minimum-IV-rank komt uit stap 2. Koers, IV en optievolume worden in deze fase opnieuw getoetst waar de bestaande scanner dat vereist.

Het losse IV-menu vervalt. Oude `#iv`, `/iv` en `#breakout`-links openen Put spreads. De Leaps-pagina en de afzonderlijke CSP-/Martin-scans blijven behouden. Een nieuwe Stock Filter maakt eerdere IV-resultaten ongeschikt voor stap 3 totdat de IV Scan op die nieuwe selectie is uitgevoerd. Aangepaste aandelen-/IV-criteria blokkeren de volgende stap totdat opnieuw is gescand. Geen limiet van 50 op de automatisch geselecteerde Amerikaanse markt; eigen invoer blijft maximaal 50 tickers.

### Opslag en wekelijkse geldigheid

Stock Filter en IV Scan blijven na browser-/API-herstart beschikbaar. Beide selecties zijn maximaal zeven dagen na afronding bruikbaar voor een nieuwe vervolgstap. De datumcontrole is niet meer beperkt tot dezelfde beursdag: de zondagselectie kan maandag worden gebruikt. Oude koersen en IV worden nooit door hergebruik als nieuw gemarkeerd. Een oude, onvoltooide of lege selectie kan geen nieuwe vervolgstap starten.

Private bestanden naast `IBKR_SNAPSHOT_PATH`:

| Bestand/map | Inhoud |
| --- | --- |
| `stock-filter/selection.json` | Laatste aandelenfilter, criteria en voortgang |
| `stock-filter/observations.json` | Ruwe dagcache met oorspronkelijke ophaaltijden |
| `stock-filter/history/<selectie-id>.json` | Afgeronde Stock Filters |
| `scan-results.json` | Laatste IV-/optieresultaten, criteria en hervatcursor |
| `iv-scan-history/<selectie-id>.json` | Afgeronde IV Scans |
| `blocked-stocks.json` | Blijvende blokkeerlijst |
| `put-spread-schedule.json` | Weekplanning, startregistraties en laatste uitvoeringsstatus |

Eerdere afgeronde filters blijven als historiebestanden bestaan bij een volgende scan. De huidige pagina toont de laatste job per stap; er is geen historische-selectiekiezer. Een onleesbare selectie, blokkeerlijst of planning wordt niet stilzwijgend overschreven. De browser bewaart alleen invoervoorkeuren; resultaten en planning staan op de server. Opslag gebeurt via tijdelijke bestanden en rename; afgeronde selecties hebben een eigen ID.

### Weekplanning

Standaard ingeschakeld: **zondag 09:00 Nederlandse tijd** voor de Stock Filter, en **maandag 09:30 New York** voor IV. De zondagtijd is een aanpasbare standaard omdat alleen de zondag was opgegeven. Onder **Weekplanning** kun je dag/tijd aanpassen, uitschakelen en de IV-vervolgscan aan- of uitzetten. Klik **Weekplanning opslaan**. De laatste op de server opgeslagen aandelen-/IV-criteria en dezelfde universumkeuze worden gebruikt.

De API controleert elke 30 seconden of een job mag starten. Hij haalt een gemiste Stock Filter later op dezelfde geplande dag in, zodra de server beschikbaar is en geen andere scan loopt. IV wacht op de eerste reguliere Amerikaanse beursopening op een volgende dag na die Stock Filter; bij een gesloten maandag wordt dit bijvoorbeeld dinsdag. De bestaande NYSE-kalender 2026–2028 en `America/New_York` bepalen de beursuren. Nederlandse en Amerikaanse zomertijdwissels worden daardoor apart verwerkt. Bij herstart tijdens een beursdag kan de nog niet gestarte IV-job later in de open sessie beginnen.

De API-service moet blijven draaien; de browser hoeft niet open te staan. Voor IV moet IBKR Gateway verbonden zijn en moeten de vereiste marktdatarechten beschikbaar zijn. De planning start geen Gateway of MFA. Een startregistratie wordt vóór uitvoering opgeslagen, zodat dezelfde weekjob na herstart niet dubbel start. Een onderbroken, gepauzeerde of mislukte job wordt zichtbaar gemeld en vraagt handmatig hervatten/nieuw starten; geen automatische herhaalstorm. Een geslaagde geplande Stock Filter koppelt de IV-job aan precies die selectie-ID. Een tussentijdse nieuwe handmatige Stock Filter vraagt opnieuw een passende IV Scan.

De **Option Scan blijft handmatig**. Er worden geen orders geplaatst. `PUT_SPREAD_SCHEDULE_DISABLED=1` is alleen voor testprocessen die de achtergrondtimer niet mogen uitvoeren; de normale bediening gebruikt de opgeslagen weekinstellingen. De weekplanning wordt pas op de server actief nadat de nieuwe frontend/API zijn geïnstalleerd.

### Geblokkeerde Stocks

Vanaf 0.38.0 worden aandelen met bevestigde ontbrekende koers-/IV-data **automatisch** geblokkeerd. Voorbeelden zijn HMDS query returned no data, onvoldoende bruikbare IV-jaarhistorie, geen recente volledige dagkoers/volume of een ontbrekende Yahoo-ticker (404). De lijst toont **Automatisch**, de scanstap en de reden. Bij Stock Filter wordt pas geblokkeerd als geen bruikbare terugval beschikbaar is; de instrumentspecifieke Yahoo-fout blijft daarbij apart van een eventueel offline Gateway. Sectorinformatie is optioneel en vormt geen blokkeerreden.

Een algemene Gateway-/netwerkstoring, time-out, annulering, snelheidslimiet of ontbrekende accountrechten blokkeert geen aandelen automatisch. Ook een normale afwijzing op koers-, volume-, IV-rank- of spreadcriteria is geen reden. Onbekend generiek optievolume zonder bewezen instrumentspecifieke oorzaak blijft een datamelding. De bestaande scanpauzes blijven voor zulke problemen behouden. Automatisch geblokkeerde IV-aandelen worden wel direct overgeslagen; de scan hoeft daarvoor niet na vijf aandelen te stoppen.

Bij de eerste API-start na deze update worden ook eerdere bewaarde foutmeldingen uit Stock Filter, IV Scan en Option Scan verwerkt. Bruikbare bewaarde resultaten krijgen voorrang. Blokkeringen, redenen en deblokkeringstijdstippen staan in `blocked-stocks.json`. Expliciet deblokkeren overleeft een herstart: dezelfde oude foutmelding blokkeert het aandeel niet opnieuw. Als een nieuwe scan opnieuw geen bruikbare data vindt, kan het aandeel wel opnieuw automatisch worden geblokkeerd. Mislukte opslag stopt de scan of toont een actiegerichte fout; er wordt geen opgeslagen blokkering geclaimd voordat de schrijfoperatie is gelukt.

Klik **Verwijder TICKER** bij een aandeel in Stock Filter, IV Scan of de spreadtabel. Het verdwijnt uit de zichtbare resultaten en komt in **Geblokkeerde Stocks**. Je kunt ook rechtstreeks een ticker blokkeren. Alle drie de stappen en toekomstige weekscans slaan geblokkeerde tickers over. De blokkeerlijst geldt voor deze Put-spreadsworkflow, niet voor portefeuilleposities, Martin of de Leaps-shortlist.

**Deblokkeer TICKER** maakt het aandeel weer beschikbaar. Als het in de bewaarde resultaten zat, kan het daar opnieuw zichtbaar worden met de oorspronkelijke datum; anders wordt het bij een volgende passende scan opnieuw meegenomen. Tijdens een scan is de blokkeerlijst vergrendeld; stop de scan of wacht op afronding. Klassevarianten zoals `BRK.B`, `BRK B` en `BRK-B` verwijzen naar dezelfde blokkering.

API: `GET/POST /api/stock-filter`; `GET/POST /api/put-spreads/iv` en `POST /api/put-spreads/iv/stop`; `GET/POST /api/put-spreads/blocked`; `GET/POST /api/put-spreads/schedule`. Nieuwe `POST /api/put-spreads` vereist zowel `selectionId` als `ivSelectionId`; servercontrole bindt de twee aan elkaar. `/api/iv-scan` blijft een compatibiliteitsroute naar stap 2 en kan geen ongefilterde brede IV-scan meer starten. Origin-controle en `X-Requested-With: trading-monitor` blijven verplicht bij mutaties.

## Historisch: twee stappen in 0.35.0

1. Kies **Alle Amerikaanse aandelen** of maximaal 50 eigen tickers. Stel minimumkoers, maximumkoers en minimumdagvolume in. Standaard: $5–$150 en minimaal **5.000.000 aandelen**. Klik **Aandelenfilter starten**. Dit vraagt geen IV, optieketens of optiequotes op.
2. Bekijk de opgeslagen selectie met slotkoers, dagvolume, handelsdag, bron en ophaaltijd. Na afronding start je desgewenst **Optiescan starten**. Alleen de geselecteerde aandelen worden via de bestaande IBKR-optiescanner verwerkt; een brede selectie heeft geen limiet van 50. De optiecriteria, waaronder gemiddeld optievolume in contracten, blijven onafhankelijk instelbaar.

Het aandelenfilter gebruikt de slotkoers en het volume van de laatste afgesloten reguliere handelsdag. De huidige dag telt vanaf 16:15 New York mee; vóór die tijd wordt de vorige beschikbare dag gebruikt. Zo worden aandelen niet vroeg op de dag afgewezen op nog onvolledig volume. De tabel vermeldt de gebruikte handelsdag. Data ouder dan zeven kalenderdagen en ontbrekende waarden leveren geen goedgekeurd aandeel op. Dagvolume is geen marktkapitalisatie: dit filter garandeert niet dat alle small caps zijn uitgesloten.

Yahoo Finance levert maximaal vijf dagen dagdata, drie aandelen tegelijk met 500 ms tussen netwerkgroepen. Dit is dezelfde experimentele bron als in Martin-scan; beschikbaarheid en responstijd zijn niet gegarandeerd. De ruwe waarnemingen worden per New York-datum en slotperiode bewaard. Andere koers-/volumegrenzen op dezelfde periode worden lokaal opnieuw toegepast; oorspronkelijke ophaaltijden blijven staan. Een eerste volledige marktverkenning vraagt nog steeds duizenden aandelen op. Alleen een nieuwe selectie met dezelfde dagdata kan vrijwel geheel uit cache komen.

Bij ontbrekende Yahoo-data probeert de scanner IBKR-dagbars (`TRADES`, vijf dagen, reguliere uren), seriëel met de bestaande historische pacing en één verbinding. Deze terugval vereist een bereikbare Gateway en passende historische datarechten. Na een mislukte IBKR-terugval worden verdere onbekende aandelen overgeslagen, met zichtbare melding. Yahoo 401/403/429 en 5xx pauzeren de scan om een stortvloed aan IBKR-aanvragen te vermijden; **Aandelenfilter hervatten** vervolgt de cursor. Geen automatische Gateway-start of MFA.

IBKR-volume-eenheden hangen van de Gateway/API-instellingen af. `IBKR_STOCK_VOLUME_MULTIPLIER` is standaard `1` voor aandelen; gebruik alleen `100` als daadwerkelijk is vastgesteld dat jouw Gateway historische volumes in lots levert. De terugval is met brokermocks getest, niet met de echte Gateway. IBKR kan een ander handelsvolume rapporteren doordat het transacties filtert; zie [IBKR historische data](https://interactivebrokers.github.io/tws-api/historical_data.html).

Selectie en ruwe dagcache staan naast `IBKR_SNAPSHOT_PATH` in `stock-filter/selection.json` en `stock-filter/observations.json`. Ze overleven vernieuwen en een API-herstart. Voortgang wordt tijdens de run na circa 25 aandelen en bij afsluiten opgeslagen; bij een harde processtop kunnen de laatste maximaal 26 beoordelingen opnieuw worden uitgevoerd. Stoppen via de knop bewaart alle al afgeronde beoordelingen. Een onleesbare selectie wordt niet stilzwijgend overschreven. Ontbrekende data blijven zichtbaar uitgesloten; bij **Afgerond met ontbrekende data** kan de bruikbare deelverzameling worden gescand.

In 0.35.0 vereisten nieuwe optiescans een afgeronde, niet-lege selectie-ID uit de huidige dag/slotperiode. Dit is vanaf 0.36.0 vervangen door de zeven-dagencontrole en de tussenliggende IV Scan hierboven. Een optiescan bewaart zijn eigen selectie, koersgrenzen en selectie-ID; bestaande hervatbare optiescans blijven hervatbaar. De aandelen-, IV- en optiescan gebruiken niet tegelijkertijd IBKR.

API: `GET/POST /api/stock-filter`, `POST /api/stock-filter/stop`. `POST /api/put-spreads` vereist bij een nieuwe scan `selectionId`; hervatten gebruikt de bestaande optiejob. De bestaande Origin-controle en aanvraagheader blijven verplicht.

## Eerdere werking en technische optiecriteria

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

Vanaf 0.41.0 kan bijwerken via **Updates** in de webapp. De uitbreiding en updateservice moeten eerst één keer handmatig worden geïnstalleerd met onderstaande stappen. Zie [updateknop en herstel](app-updates.md).

Alle ontwikkel- en bouwcommando’s vanuit `source/`:

```powershell
npm ci
npm test
npm run test:frontend
npm run build
npm run dev:lan
```

Gebruik de bestaande IB Gateway-configuratie en datarechten; zie [IBKR](IBKR.md). Zonder bereikbare API/broker zijn geen actuele scanresultaten te verifiëren. Lokale frontend apart: `npm run dev -- --host 127.0.0.1 --port 5197`; Node-API apart: `npm run start:api`. Zorg dat die frontend-origin toegestaan is voor de Node-API. De gebruikelijke LAN-launcher regelt dit voor zijn eigen origin.

Serverupdate vereist frontend (`dist/`), Node (`server/`, `shared/`) en de bestaande bijgewerkte Python-LAN-proxy. Het bestaande script `bash deploy/update-options.sh` controleert nu versie 0.42.0, bouwt/test, publiceert en herstart de bestaande services. Er is geen serverinstallatie vanuit deze ontwikkelomgeving uitgevoerd. Het script controleert `/api/put-spreads`, `/api/stock-filter`, `/api/put-spreads/iv`, `/api/put-spreads/blocked` en `/api/put-spreads/schedule`. De bestaande algemene `/api/`-proxy ondersteunt deze routes. Volg de [bestaande installatiehandleiding](installatie.md) voor een nieuwe installatie.

De kop **Gevonden spreads** toont **v0.42.0**. Ontbreken die versie en het vergrootglas met overige spreads, dan wordt nog een oude frontend geleverd. Alleen een GitHub-push vervangt de serverbestanden niet. Voer op de bestaande Linux-server vanuit de repository-root uit:

```bash
git pull --ff-only
cd source
bash deploy/update-options.sh
```

Vernieuw daarna met Ctrl+F5 en controleer de versie in de tabelkop.

## Validatie

Gericht: `node --test tests/put-spread.test.mjs tests/put-spread-api.test.mjs tests/spread-universe-cache.test.mjs`. Browser met expliciete testquotes: start de frontend op poort 5197 en voer `npm run test:spreads` uit. Screenshots staan uitsluitend lokaal in de genegeerde map `source/data/private/spread-validation/`. Dit zijn testgegevens, geen echte gevonden handelsmogelijkheden. Zie [validatie](validatie.md) voor de uitgevoerde controles.
