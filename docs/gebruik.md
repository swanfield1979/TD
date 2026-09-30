# Gebruik en berekeningen

## Dashboardindeling vanaf 0.24.0

De vier bovenste kaarten tonen portefeuillesaldo, totale winst na netto inleg, saldoverandering tegenover de vorige beschikbare dagstand en het gerealiseerde jaarresultaat. Daaronder staan het portefeuilleverloop met jaarkeuze en de portefeuilleverdeling inclusief vrij besteedbaar vermogen. De verdeling bewaart de bestaande nettoberekening: opties omvatten zowel de actuele optiewaarde als CSP-reservering en mogen daarom niet uitsluitend als CSP worden gelabeld.

De volgende rij toont netto maandresultaten en het jaardoel. De netto maandgrafiek gebruikt dezelfde FIFO-resultaten en commissies als het jaarresultaat: uitsluitend gerealiseerde short-optiepremie en aandelenverkopen, geboekt op de sluitingsdatum. Long-optieresultaten tellen hierin niet mee. De huidige rapportmaand is voorlopig; toekomstige maanden blijven leeg. De saldografiek toont maandeindsaldi, inclusief inleg en open posities, en is dus geen grafiek van gerealiseerde winst.

Het jaardoel toont actueel saldo gedeeld door de doelwaarde. Het verschil met het jaarschema gebruikt de bestaande Goals-berekening: startsaldo plus werkelijke netto inleg plus het rendementsdoel naar verstreken deel van het jaar. Zonder stortingsgegevens wordt geen voorsprong/achterstand verzonnen. De link opent de volledige Goals-planning.

Onder deze rij staan de handelsdetails. Deze en vorige maand combineren nettoresultaat, premie/aandelen en ontvangen premie, terugkoop en commissie in één kaart per maand. Er zijn geen afzonderlijke dubbele netto-premiekaarten. Daaronder staan maandgemiddelde, aantal trades, premiebehoud en gemiddelde aanhoudduur. Groen en rood ondersteunen het teken in de bedragen; de betekenis blijft ook zonder kleur leesbaar.

## IBKR-gegevens vernieuwen

Linksonder staat de IBKR-status. Klik op **Verbinden** wanneer Gateway niet actief is. De webapp start dan IBC en toont **IB Key bevestigen**. Keur de melding binnen drie minuten goed in IBKR Mobile.

Na verbinding toont de bediening **IBKR verbonden**. Met **Vernieuwen** worden de actuele netto liquidatiewaarde, open posities, marktprijzen en ongerealiseerde winst/verlies opnieuw opgehaald. Tijdens het ophalen is de knop geblokkeerd om dubbele aanvragen te voorkomen.

Wanneer de koppeling niet beschikbaar is, blijven de laatst geïmporteerde Flex-gegevens zichtbaar. Er worden via deze koppeling geen orders geplaatst.

Het dashboard combineert saldoreeksen en gerealiseerde transactieresultaten uit de lokale Flex-bronnen:

- **Totale winst:** huidig saldo − startsaldo − netto inleg sinds 2025. Netto inleg is stortingen min opnames. Het percentage is winst / (startsaldo + netto inleg) × 100. Dit is eenvoudig totaalrendement, niet tijdgewogen of geannualiseerd. De inleg van 2024 zit al in het startsaldo van 2025. Bij ontbrekende jaarhistorie verschijnt een streepje; bij verschillende peildatums verschijnt ≈. Open posities tellen via het saldo mee.
- **Saldo:** het laatste beschikbare totaal van `EquitySummaryByReportDateInBase`.
- **Saldoverandering live:** actueel IBKR-saldo min de vorige beschikbare dagstand. Het percentage deelt dit verschil door de absolute vorige dagstand. De kaart verandert mee bij iedere IBKR-vernieuwing. Zonder live snapshot blijft de vergelijking tussen de twee laatste rapportdagen zichtbaar.
- **Nettoresultaat jaar:** alle gerealiseerde short-optiepremies en aandelenresultaten met een sluitingsdatum in het rapportjaar. Ongerealiseerde koersbewegingen en stortingen tellen niet mee.
- **Nettoresultaat deze maand:** netto optiepremie plus gerealiseerde winst/verlies uit aandelenverkopen in de huidige rapportmaand.
- **Nettoresultaat vorige maand:** dezelfde gerealiseerde berekening voor de voorgaande kalendermaand.
- **Gemiddeld per maand:** gerealiseerd jaarresultaat gedeeld door het aantal verstreken kalendermaanden, inclusief de lopende maand.

### Alleen gerealiseerde resultaten

De openingsdatum bepaalt nooit de resultaatmaand. Een CSP geopend op 31 januari en teruggekocht op 5 februari geeft in januari geen premie of resultaat; de ontvangen openingspremie minus de terugkoop en beide commissies komt volledig in februari. Hetzelfde geldt over een jaargrens. De rapportmaand volgt de laatste Flex-saldodatum; transacties daarna worden nog niet meegenomen.

- **Netto premie:** uitsluitend afgesloten short opties (waaronder CSP, CC en short synthetische legs). Ontvangen premie minus terugkoop en evenredige openings-/sluitingscommissies wordt geboekt bij sluiten, bevestigde expiratie of assignment. Een open geschreven optie telt nog niet mee.
- **Aandelen:** verkoopopbrengst minus de FIFO-aanschafwaarde van de verkochte aandelen, inclusief kosten. Dit geldt voor gewone verkopen, verkoop door CC-assignment en ETF's zoals SPCX. Een aankoop verlaagt het nettoresultaat niet. Een toegewezen CSP realiseert zijn premie; de aangekochte aandelen krijgen afzonderlijk hun werkelijke aanschafkosten.
- **Gekochte opties:** verkoopopbrengst minus aanschafpremie en kosten blijft zichtbaar in de optiehistorie (Trades/Stats), maar telt niet mee in de nettoresultaatkaarten, het jaarresultaat of het maandgemiddelde. Dit geldt ook voor losse gekochte calls en lange synthetische legs die op een andere dag sluiten. Ook het verlies van een waardeloos verlopen long optie blijft buiten deze nettoresultaten. Bij uitoefening gaan de kosten mee naar de resulterende aandelentransactie en komen ze bij aandelenverkoop in het resultaat.
- **Gedeeltelijke sluiting:** alleen het afgesloten aantal realiseert resultaat. Openingspremie en openingskosten worden per FIFO-lot naar rato toegerekend; het resterende deel blijft open. Een roll sluit de oude optie en opent een nieuwe: uitsluitend het oude deel realiseert resultaat.

De maandkaarten tonen de optelling **premie · aandelen**. Premie en aandelenwinst bij assignment worden apart uit de werkelijke transacties berekend, zodat doorgeschoven premies uit IBKR's fiscale kostprijs niet dubbel tellen. Expiratie wordt alleen verwerkt bij een sluitingstransactie of expliciet OptionEAE-event, nooit alleen omdat een expiratiedatum verstreken is. Events die ook in Trades staan worden op contract, datum, richting, prijs en aantal gematcht en eenmaal verwerkt.

Wanneer een historische opening buiten het beschikbare rapportbereik valt, gebruikt de importer het door IBKR gerapporteerde FIFO-nettoresultaat. Dat bevat al commissies; die worden niet nogmaals afgetrokken. De premiekaart toont dit deel afzonderlijk als **historisch netto (opening ontbreekt)**; openingsprijs en rendement worden niet verzonnen. Voor een volledige scheiding van historische assignmentpremies en aandelenkosten zijn ook de bijbehorende openingsrapporten nodig.

Als voor een afsluiting zowel de opening als een bruikbaar IBKR-nettoresultaat ontbreekt, stopt de import met een concrete melding. Dat gebeurt ook bij onvolledig gematchte openingsaantallen of assignment/uitoefening zonder openingshistorie. Importeer dan eerdere Flex-bestanden; een onbekend resultaat wordt niet als nulwinst gepubliceerd.

Zie de [IBKR Flex-velddefinitie](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm) voor het reeds in FIFO P/L opgenomen kostenbedrag en de [assignment-definitie](https://www.ibkrguides.com/reportingreference/reportguide/trades.htm) voor de door IBKR doorgeschoven optiepremie.

## Portefeuilleverdeling

Naast het saldo staat een donutgrafiek met aandelen, opties en geld/overig. Het nettosaldo in het midden komt rechtstreeks uit het laatste Flex-dagsaldo.
Tussen het saldo en de donut staat **Saldoverandering live** zodra een actuele IBKR-snapshot beschikbaar is. Bedrag en percentage gebruiken dezelfde actuele saldostand. De referentie is de meest recente beschikbare datum vóór de snapshotdatum: een Flex-rapportsaldo of de laatste opgeslagen IBKR-meting van een eerdere dag. Bij gelijke datum heeft het rapportsaldo voorrang. Een opgeslagen meting is niet noodzakelijk een officiële dagsluiting. De kaart vermeldt de bron en datum; ontbreekt gisteren, dan wordt de oudere datum zichtbaar gebruikt. Zonder eerdere dagstand verschijnen streepjes; bij een vorige stand van nul is het percentage onbekend. De bestaande knop **Vernieuwen** haalt de actuele gegevens op; er is geen continue koersstream toegevoegd. Dit is een saldoverandering en kan stortingen, opnames en ongerealiseerde koersbewegingen bevatten; het is geen gerealiseerd handelsresultaat.

Zonder live snapshot is de verdeling indicatief: aandelen gebruiken de resterende FIFO-kostprijs en opties de negatieve shortwaarde uit het laatste saldorapport. Afzonderlijke marktwaarden van gekochte opties zijn daarin niet beschikbaar en blijven onderdeel van geld/overig. Met een live snapshot gebruiken aandelen en opties hun getekende IBKR-marktwaarden. Short-verplichtingen blijven negatief. De CSP-reservering wordt van geld/overig naar opties verplaatst. Geld/overig is het sluitstuk tot de netto liquidatiewaarde en omvat ook overige waarderingsposten. Bij een negatieve categorie vervalt de donutverdeling; de bedragen blijven zichtbaar.

Actuele posities en historische resultaten hebben aparte peildatums in de header. Stats en Trades tonen uitsluitend de Flex-peildatum. Hun **optieresultaat** omvat alle gesloten long- en short-opties, exclusief aandelen. Het **nettoresultaat** op het dashboard omvat uitsluitend gerealiseerde short-premie en aandelenverkopen. Goals en Totale winst volgen juist het saldo inclusief open posities, gecorrigeerd voor netto inleg. Bij een nieuw kalenderjaar vereist Goals eerst een bijgewerkte Flex-jaarafsluiting. Een onbekende openingsdatum of vorige slotkoers blijft onbekend; gekozen DTE en dagkoersverschil worden dan niet verzonnen.

## Jaarverloop

De lijngrafiek toont voor alle twaalf kalendermaanden het verschil tussen het laatste beschikbare saldo van een maand en het laatste saldo van de voorgaande maand. De lijn verbindt alleen beschikbare maandresultaten. Toekomstige maanden blijven op de tijdas staan met de status `Nog geen data`. Grijze balken achter de lijn tonen per kalendermaand het bedrag van het voorgaande jaar als vaste referentie op dezelfde schaal.

## Stocks

De pagina **Stocks** toont alle open aandelenposities die uit de aangeleverde Flex-trades kunnen worden gereconstrueerd. Per aandeel worden symbool, naam, aantal, gemiddelde resterende FIFO-aankoopprijs en aankoopwaarde getoond.

Na een live IBKR-update toont **CC-dekking** per aandeel het aantal open short calls tegenover het aantal volledige pakketten van 100 aandelen. `3/3` betekent volledig gedekt. Gekochte calls, puts en opties op een ander symbool tellen niet mee. Minder of meer short calls dan beschikbare aandelenpakketten wordt expliciet als deels gedekt of overgedekt gemarkeerd.

De laatste kolom **Vandaag** vergelijkt de huidige IBKR-marktprijs met de vorige slotkoers. Een stijging krijgt een plusteken en groene kleur, een daling een minteken en rode kleur en een ongewijzigde koers wordt als `0,0%` getoond. De waarden worden bij **Vernieuwen** opnieuw opgehaald. Wanneer IBKR geen vorige slotkoers beschikbaar stelt, toont de tabel `—` in plaats van een berekend nultarief. Zonder live abonnement kan IBKR een vertraagde koers leveren.

De huidige Flex-bestanden bevatten geen actuele marktprijzen. Daarom blijven **Huidige prijs**, **Netto positiewaarde**, **Winst/verlies** en **Vandaag** leeg totdat actuele positie- en koersgegevens via de IBKR-koppeling beschikbaar zijn. Een oude transactieprijs wordt bewust niet als actuele koers gebruikt.

## Options

De pagina **Options** toont uitsluitend nog open optiecontracten. Openings- en sluitingstransacties uit het Flex-rapport worden per contract tegen elkaar weggestreept. De tabel toont de onderliggende waarde, strategie, call/put, long/short, aantal, strike, expiratie, gekozen DTE en gemiddelde openingspremie.

**DTE gekozen** is het aantal kalenderdagen tussen de opening en expiratie. Bij meerdere resterende openingslots in hetzelfde contract wordt dit gewogen naar het aantal contracten. Onder de expiratiedatum staat het aantal dagen dat op de getoonde peildatum resteert. Zeven dagen of minder wordt rood gemarkeerd; maximaal dertig dagen krijgt een gele waarschuwing.

Een long call en short put met dezelfde onderliggende waarde, strike en expiratie worden als **SYNT long** herkend. De omgekeerde combinatie wordt als **SYNT short** getoond. Andere legs worden benoemd als short call, short put, long call of long put.

Na **Vernieuwen** vult IBKR de huidige optieprijs, marktwaarde en het ongerealiseerde winst/verlies in. Zolang geen actuele snapshot beschikbaar is, blijven deze velden `—`; de Flex-openingspremie wordt niet als actuele prijs gebruikt.

**Gereserveerd voor CSP** telt voor iedere open short put het volledige bedrag voor eventuele assignment: `strike × 100 × aantal contracten`. De short put binnen een **SYNT long** telt daarbij volledig mee. Calls en gekochte puts reserveren geen cash. **Vrij te besteden** is `netto saldo − aandelenwaarde − CSP-reservering`.

Op het Dashboard wordt de CSP-reservering bij **Opties** opgeteld en tegelijk uit **Geld / overig** gehaald. Daardoor blijft het netto saldo ongewijzigd, maar is zichtbaar welk geld niet meer vrij beschikbaar is.

## Goals

De voortgangsbalk toont het actuele saldo als percentage van het totale jaardoel, inclusief startkapitaal en inleg. De aparte winstberekening trekt netto inleg wel af. De balk wordt begrensd op 0–100%; het bijschrift kan meer dan 100% tonen als het jaardoel is overschreden.

Goals toont geplande **Inleg**, werkelijke **Ingelegd** (netto na opnames) en **Winst / %** naast elkaar. De voortgang en benodigde winst per maand worden voor inleg gecorrigeerd. Het rendementsdoel blijft 30% van het startsaldo; de geplande jaarlijkse inleg blijft $ 12.000. Werkelijke inleg boven de planning verhoogt de saldoverwachting zonder als rendement te tellen. Zie [Inleg en rendement](inleg.md) voor formules, import en peildatums.

## Handelsactiviteit en optiepremie

- **Totaal trades:** afsluitingen van opties in het rapportjaar plus momenteel open optieposities. Gedeeltelijke afsluitingen tellen afzonderlijk mee.
- **Premie behouden:** netto gerealiseerde short-optiepremie gedeeld door de bekende brutopremie van die afgesloten opties. Open posities tellen niet mee. Zonder openingshistorie is deze verhouding niet volledig onderbouwd.
- **Gemiddeld aangehouden:** gemiddelde kalenderduur van afgesloten optieposities met bekende openingsdatum; bij meerdere FIFO-lots geldt de oudste gematchte opening.
- **Netto premie per maand:** gerealiseerde premie op sluitingsdatum, met ontvangen premie, terugkoopkosten en commissies uit dezelfde afgesloten aantallen.

Alle geldbedragen worden uitsluitend met het `$`-teken getoond. De totalen uit het Flex-rapport worden als dollars geïnterpreteerd; het dashboard voert geen aanvullende valutaconversie uit.

Een positief resultaat of een opbrengst wordt groen weergegeven. Een negatief resultaat of een kostenpost wordt rood weergegeven. Terugkoop en commissie krijgen daarom een minteken en rode kleur. Tekst en tekens zorgen dat betekenis niet alleen via kleur wordt overgebracht.

## Trades

De pagina **Trades** toont alle afgesloten optieposities, gesorteerd van nieuw naar oud en verdeeld over pagina's van maximaal 50 regels. Met de jaarkeuze wissel je tussen 2025 en 2026; aantallen, winstpercentage, gerealiseerd resultaat, gemiddelde aanhoudduur en paginering worden voor het gekozen sluitingsjaar opnieuw berekend. Per trade staan de onderliggende waarde, long/short en call/put, strike, openings- en sluitingsdatum, aanhoudduur, openingspremie en netto winst of verlies.

Het nettoresultaat van een volledig gemeten afsluiting is de verkoopopbrengst minus de gematchte FIFO-aankoopkosten en beide commissies. Elke gedeeltelijke afsluiting verschijnt in zijn eigen sluitingsmaand. **Rendement** is dit resultaat gedeeld door de absolute openingspremie. Daarmee is de berekening consistent voor zowel gekochte als geschreven opties.

**Geannualiseerd (lineair)** rekent het trade-rendement om met:

`trade-rendement × 365 ÷ aantal aangehouden dagen`

Voor een trade die op dezelfde kalenderdag opent en sluit, wordt voor de jaaromrekening minimaal één dag gebruikt. Het geannualiseerde percentage is uitsluitend een theoretische vergelijking; het veronderstelt dat dezelfde trade steeds opnieuw beschikbaar is en is geen voorspelling van toekomstig rendement.

Van trades die vóór het beschikbare Flex-bereik zijn geopend, zijn het gerealiseerde dollarresultaat en de sluitingsgegevens wel zichtbaar. Openingspremie, aanhoudduur en percentages blijven dan `—`, omdat de ontbrekende opening niet wordt geschat.

## Stats

De pagina **Stats** staat tussen Goals en Trades. Met **Analysejaar** wissel je tussen 2024, 2025 en 2026; alle kerncijfers en handelsgrafieken volgen die selectie. Bij het openen staat de analyse standaard op **2026**.

De zes kerncijfers tonen het aantal afgesloten trades, de winratio, het gerealiseerde nettoresultaat, het gemiddelde resultaat per trade, de profit factor en de gemiddelde looptijd. De profit factor is de totale brutowinst gedeeld door het absolute brutoverlies.

De grafieken tonen:

- het portefeuillesaldo per maandeinde, met een afzonderlijke keuze voor 2024, 2025, 2026 of alle beschikbare jaren;
- gerealiseerde winst of verlies per sluitingsmaand;
- het aantal winst-, verlies- en neutrale trades;
- de acht onderliggende waarden met de grootste absolute resultaatimpact;
- de verdeling van volledig gemeten trades over vijf looptijdcategorieën.

Het portefeuilleverloop gebruikt uitsluitend werkelijke maandeindsaldi uit de Flex-rapporten en toont beginwaarde, eindwaarde en verandering. Deze historische context heeft een eigen periodekeuze voor 2024, 2025, 2026 of alle jaren en staat los van het gekozen analysejaar voor trades. De grafiek opent standaard op 2026. Een benchmarkvergelijking wordt pas toegevoegd zodra daarvoor een betrouwbare koersbron is gekoppeld.

Alle traderesultaten zijn gebaseerd op de afsluitdatum en nettocashflow van de gesloten optieposities. Hierdoor sluiten de Stats-jaarkeuze en de Trades-jaarkeuze inhoudelijk op elkaar aan.

## Data verversen

Vervang of voeg de XML-bestanden in `source/data/private/` toe en voer vanuit `source/` opnieuw uit. Jaarbestanden mogen bijvoorbeeld `_2025` achter het vaste voorvoegsel krijgen; alle passende bestanden worden samengevoegd en overlappende bronregels worden gededupliceerd.

```powershell
npm run import:flex
```

Herlaad daarna het dashboard.

## Aandachtspunt

Saldo, saldoverandering per rapportdag, saldoverloop en Goals blijven gebaseerd op netto liquidatiewaarde; stortingen, opnames en ongerealiseerde koersbewegingen kunnen die cijfers beïnvloeden. Nettoresultaat en het maandgemiddelde gebruiken uitsluitend gerealiseerde short-optiepremies en aandelenresultaten. Netto premie bevat uitsluitend afgesloten short opties. Stats en Trades analyseren uitsluitend optieafsluitingen; aandelenresultaten staan in het totale nettoresultaat op het Dashboard.
