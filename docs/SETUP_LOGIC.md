# Berekeningen en setupcriteria

De scanner rangschikt uitsluitend het geïmporteerde universum. Dit is een educatief onderzoeksinstrument, geen financieel advies. Een klein voorbeelduniversum vertegenwoordigt niet de gehele markt; er is geen claim van survivorship-vrije selectie.

## Momentum en leiderschap

Voor een periode N is het prijsrendement `100 × (close[T] / close[T−N] − 1)`. Standaardperioden zijn 21, 63 en 126 beschikbare handelssessies, configureerbaar via `AnalysisConfig.periods`. Minimaal N+1 bars zijn nodig. Kalenderdagen worden niet als sessies geteld. Ontbrekende verwachte Amerikaanse sessies maken het betrokken rendement ongeldig; er wordt niet geïnterpoleerd.

Per periode worden geldige aandelen onderling gerangschikt: percentiel `100 × (1 − rangindex / (aantal−1))`, met rangindex vanaf nul. Eén aandeel krijgt 100. Gelijke rendementen worden deterministisch op ticker/instrument-ID geordend; zij krijgen geen gedeeld percentiel. De samengestelde score is standaard `0,40 × P21 + 0,35 × P63 + 0,25 × P126`; alle drie rendementen moeten beschikbaar zijn. De gewichten zijn instelbaar. Top 1%, 2% en 5% selecteren `ceil(aantal × percentage / 100)` op samengestelde score. Overige filters worden daarna toegepast.

## 1. Voorafgaande impuls

Rolling vensters van 5–30 sessies zoeken binnen de laatste 63 sessies een stijging vanaf 30%. Startslot en eindslot bepalen het rendement; er is geen bovengrens van 100%. Startdatum, einddatum, duur en percentage worden opgeslagen. De actuele kandidaatbar telt niet mee bij het vinden van de voorafgaande impuls. Meerdere mogelijke impulsen/bases worden geëvalueerd.

## 2. Geordende consolidatie

Een basis eindigt op T−1 en duurt standaard 10–42 sessies. Weken zijn sessies gedeeld door vijf. De basis-high omvat de impuls-eindhigh en alle volgende basishighs; de low is de laagste basislow. Diepte is `100 × (high−low)/high`, maximaal 25%. De basis-high mag maximaal 5% boven de impuls-eindhigh liggen.

Hogere lows gebruiken bevestigde swing lows met twee omliggende bars aan iedere kant en 2% tolerantie. Alleen binnen de afgesloten basis bevestigde pivots tellen mee. Bij minder dan twee pivots wordt de laagste low van de laatste vijf bars met die van de eerste vijf vergeleken. Contractie vergelijkt high-low-range van de laatste vijf basisbars met de eerste vijf: ratio maximaal 0,85. De overeenkomstige gemiddelde true-range-ratio moet maximaal 0,95 zijn.

MA10, MA20 en MA50 zijn eenvoudige slotkoersgemiddelden. Getoonde actuele MA's gebruiken data tot T. Voor basissteun worden MA10/20 en hun hellingen tot T−1 gebruikt: stijging ten opzichte van vijf sessies eerder, met afstand tot het basisslot maximaal 12%. MA50-steun is optioneel configureerbaar. Afstand is `100 × (prijs/MA−1)`. Een close onder de basislow, meer dan 8% onder actuele MA20, te diepe basis of materieel lagere bevestigde swing lows kan de structuur doen mislukken.

## 3. Uitbraak zonder vooruitkijken

Breakout vereist een geldige basis, close[T] boven de eerder vastgestelde high en true range[T] minstens 1,3 maal ATR20. True range is het maximum van high-low en beide afstanden tot het vorige slot. ATR20 is hier het eenvoudige gemiddelde van de twintig true ranges vóór T, geen Wilder-smoothing. De kandidaatbar zit dus niet in de uitbraakhigh of ATR-referentie. Volume is standaard optioneel; indien verplicht moet volume[T] minstens 1,2 maal het gemiddelde van de vorige twintig volumes zijn. Ontbrekend volume bevestigt geen verplichte volumevoorwaarde.

| Status | Nederlands | Betekenis |
| --- | --- | --- |
| forming | Basis in vorming | Nog geen complete geldige basis; kan ook geen kwalificerende impuls betekenen |
| ready | Consolidatie gereed | Geldige basis, slot onder/op high en maximaal 5% eronder |
| breakout | Breakout actief | Geldige basis met slot boven eerdere high en voldoende range-expansie |
| failed | Setup mislukt | Gevonden structuur schendt risicocriteria |
| insufficient_data | Onvoldoende data | Te weinig of onvolledige historie |

Bij meerdere kandidaten gaat breakout vóór ready, forming en failed; daarna tellen langere basis en sterkere impuls. Dit is een detectieheuristiek, geen garantie dat elke mogelijke basis dezelfde status heeft. Details tonen checklist, redenen, MA's, ATR, contractie, data- en berekendatums. De [volledige configuratietabel](breakout-scanner.md#detectie-en-configuratie) beschrijft alle instelbare drempels; implementatie staat in `source/backend/app/schemas/scanner.py` en de zuivere analysemodule.

## Datakwaliteit en toetsing

Dagdatums zijn beurssessiedatums; opslag- en berekentimestamps zijn UTC. Dubbele datums worden bij analyse afgewezen; database-upserts blijven uniek per instrument, datum en datasoort. Mislukte nieuwe requests verwijderen geen cache. De kalender ondersteunt NYSE-feestdagen 2026–2028; andere beurskalenders vereisen uitbreiding. Niet-USD-volume wordt niet zonder valutaconversie als dollarvolume gepresenteerd.

Standaard wordt IBKR `TRADES` gebruikt: volgens [IBKR](https://www.interactivebrokers.com/campus/contributors/retrieving-historical-data-from-ibkr/) splitgecorrigeerd, zonder dividendcorrectie. `ADJUSTED_LAST` is afzonderlijk configureerbaar en corrigeert ook dividenden. Reeksen worden niet gemengd en krijgen geen tweede correctiefactor. Overlaprevisies boven 5% of koerssprongen boven 45% markeren het instrument voor hercontrole en sluiten het uit van ranking. Een geldige volledige hercontrole vervangt de reeks; dit vervangt geen complete corporate-actionfeed.

Deterministische pytest-fixtures dekken forming, ready, breakout, diepe/mislukte basis, geen impuls en onvoldoende historie. Tests controleren rendementen, percentielen, gewichten, MA's, ranges, hogere lows, duurgrenzen en look-aheadpreventie. Ze gebruiken geen levende IBKR-verbinding.
