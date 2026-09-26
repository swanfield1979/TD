# Gebruik en berekeningen

## IBKR-gegevens vernieuwen

Linksonder staat de IBKR-status. Klik op **Verbinden** wanneer Gateway niet actief is. De webapp start dan IBC en toont **IB Key bevestigen**. Keur de melding binnen drie minuten goed in IBKR Mobile.

Na verbinding toont de bediening **IBKR verbonden**. Met **Vernieuwen** worden de actuele netto liquidatiewaarde, open posities, marktprijzen en ongerealiseerde winst/verlies opnieuw opgehaald. Tijdens het ophalen is de knop geblokkeerd om dubbele aanvragen te voorkomen.

Wanneer de koppeling niet beschikbaar is, blijven de laatst geïmporteerde Flex-gegevens zichtbaar. Er worden via deze koppeling geen orders geplaatst.

Het dashboard combineert saldoreeksen en gerealiseerde transactieresultaten uit de lokale Flex-bronnen:

- **Saldo:** het laatste beschikbare totaal van `EquitySummaryByReportDateInBase`.
- **Dagelijkse W&V:** het verschil tussen de twee laatste beschikbare handelsdagsaldi, zowel in dollars als als percentage van het saldo van de vorige handelsdag.
- **Nettoresultaat 2026:** laatste netto liquidatiewaarde minus de startwaarde van 2026. Waar aanwezig wordt 31 december 2025 als nulmeting gebruikt.
- **Nettoresultaat deze maand:** netto optiepremie plus gerealiseerde winst/verlies uit aandelenverkopen en gesloten synthetische posities in de huidige rapportmaand.
- **Nettoresultaat vorige maand:** dezelfde gerealiseerde berekening voor de voorgaande kalendermaand.
- **Gemiddeld per maand:** winst 2026 gedeeld door het aantal verstreken kalendermaanden, inclusief de lopende maand.

Bij een gesloten synthetic zit het resultaat van de korte optieleg al in netto premie. Daarom telt de aanvullende component **SYNT** uitsluitend het gerealiseerde resultaat van de lange leg. Aandelenverkopen gebruiken FIFO-winst/verlies inclusief commissie. Onder iedere maandkaart staat de uitsplitsing `premie · aandelen · SYNT`, zodat de optelling controleerbaar blijft.

## Portefeuilleverdeling

Naast het saldo staat een donutgrafiek met aandelen, opties en geld/overig. Het nettosaldo in het midden komt rechtstreeks uit het laatste Flex-dagsaldo.
Tussen het saldo en de donut staat **Dagelijkse W&V** als afzonderlijke kaart. Positief, negatief en ongewijzigd worden met zowel kleur als een expliciet teken en tekstalternatief weergegeven.

De huidige Flex-bestanden bevatten geen actuele marktwaarde per afzonderlijke positie. Daarom is de verdeling indicatief: aandelen gebruiken de resterende FIFO-kostprijs van open aandelentrades, opties gebruiken de absolute `totalShort`-waarde uit het laatste saldorapport en geld/overig is het resterende bedrag. Zodra een Open Positions-rapport beschikbaar is, kan deze berekening worden vervangen door actuele marktwaarden.

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

De pagina **Goals** toont afgesloten jaarresultaten en gebruikt de laatste netto liquidatiewaarde van het voorgaande jaar als startpunt voor het actuele jaardoel. De vaste formule is:

`jaardoel = eindstand vorig jaar + 30% rendement + $ 12.000 jaarlijkse inleg`

Voor 2025 is het startsaldo op basis van de jaarafsluiting van 2024 `$ 35.772,47`. Met `$ 10.731,74` rendementsdoel en `$ 12.000,00` inleg komt het doel op `$ 58.504,21`. De werkelijke eindstand van 2025 is `$ 82.465,00`, oftewel `$ 23.960,79` boven doel.

Voor 2026 is de eindstand van 2025 `$ 82.465,00` het startsaldo. Het rendementsdoel is `$ 24.739,50` en het jaardoel voor 2026 `$ 119.204,50`.

De voortgangsbalk toont welk deel van de benodigde totale groei al is gerealiseerd. **Voor/achter op schema** vergelijkt het actuele saldo met een lineair doelpad vanaf 1 januari tot en met 31 december. **Nodig per resterende maand** verdeelt het bedrag tot het jaardoel over de nog volledige kalendermaanden.

De meerjarenplanning projecteert vijf jaar vooruit met dezelfde 30% en `$ 12.000` inleg. Voor toekomstige jaren wordt het geplande doel van het voorgaande jaar als voorlopig startsaldo gebruikt. Zodra een nieuw kalenderjaar in de Flex-data is afgesloten, gebruikt de import automatisch die werkelijke eindstand en verschijnt het jaar als afgesloten resultaat.

## Handelsactiviteit en optiepremie

- **Totaal trades:** op het Dashboard uitsluitend de in het actuele kalenderjaar afgesloten optiecycli plus alle momenteel open optieposities. Voor 2026 zijn dit 171 gesloten en 10 open, samen 181. Een cyclus begint bij de eerste opening en eindigt wanneer de positie weer nul is; een trade die eerder opende maar in 2026 sloot, telt correct mee in 2026.
- **Premie behouden:** netto optiepremie gedeeld door alle ontvangen brutopremie. Netto is ontvangen premie minus terugkoopkosten en commissies.
- **Gemiddeld aangehouden:** gemiddelde kalenderduur van gesloten optiecycli waarvan zowel de openings- als sluitingsdatum in het rapport staat. Het getoonde bereik gebruikt dezelfde gemeten trades.
- **Netto premie per maand:** ontvangen brutopremie minus terugkoop en commissie. De drie onderdelen blijven afzonderlijk onder het nettobedrag zichtbaar.

Alle geldbedragen worden uitsluitend met het `$`-teken getoond. De totalen uit het Flex-rapport worden als dollars geïnterpreteerd; het dashboard voert geen aanvullende valutaconversie uit.

Een positief resultaat of een opbrengst wordt groen weergegeven. Een negatief resultaat of een kostenpost wordt rood weergegeven. Terugkoop en commissie krijgen daarom een minteken en rode kleur. Tekst en tekens zorgen dat betekenis niet alleen via kleur wordt overgebracht.

## Trades

De pagina **Trades** toont alle afgesloten optiecycli, gesorteerd van nieuw naar oud en verdeeld over pagina's van maximaal 50 regels. Met de jaarkeuze wissel je tussen 2025 en 2026; aantallen, winstpercentage, gerealiseerd resultaat, gemiddelde aanhoudduur en paginering worden voor het gekozen sluitingsjaar opnieuw berekend. Per trade staan de onderliggende waarde, long/short en call/put, strike, openings- en sluitingsdatum, aanhoudduur, openingspremie en netto winst of verlies.

Het nettoresultaat van een volledig gemeten trade is de som van alle verkoop- en aankoopstromen plus commissies binnen de cyclus. **Rendement** is dit resultaat gedeeld door de absolute openingspremie. Daarmee is de berekening consistent voor zowel gekochte als geschreven opties.

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

Alle traderesultaten zijn gebaseerd op de afsluitdatum en nettocashflow van de gesloten optiecycli. Hierdoor sluiten de Stats-jaarkeuze en de Trades-jaarkeuze inhoudelijk op elkaar aan.

## Data verversen

Vervang of voeg de XML-bestanden in `source/data/private/` toe en voer vanuit `source/` opnieuw uit. Jaarbestanden mogen bijvoorbeeld `_2025` achter het vaste voorvoegsel krijgen; alle passende bestanden worden samengevoegd en overlappende bronregels worden gededupliceerd.

```powershell
npm run import:flex
```

Herlaad daarna het dashboard.

## Aandachtspunt

De eerste versie behandelt veranderingen in netto liquidatiewaarde als winst of verlies, precies volgens de gekozen definitie. Stortingen, opnames en valutabewegingen kunnen die uitkomst beïnvloeden. Een latere versie kan deze kasstromen apart corrigeren.
