# Optiecombinaties in Options

Versie 0.42.5 van 28 oktober 2026. Inclusief de Stats-uitbreiding; serverinstallatie nog niet uitgevoerd.

## Gebruik

Options toont passende putspreads en synthetische posities als één hoofdregel. Klik op de pijl bij de ticker om de twee benen er direct onder te tonen. De knop werkt ook met Enter en Spatie en meldt de open/dicht-status aan hulpsoftware. Combinaties beginnen ingeklapt; de keuze blijft tijdens het gebruik van deze pagina in het geheugen.

De hoofdregel behoudt de belangrijkste waarden:

- Aantal **sets**; één set bestaat uit twee contractbenen. De samenvattingskaarten en totaalregel blijven de oorspronkelijke aantallen contracten tellen.
- Beide strikes, met long/short-aanduiding als ze verschillen.
- **Week 44**, bijvoorbeeld, vóór de openingsdatum. Dit is een ISO-weeknummer; maandag is de eerste weekdag. Het weeknummer staat ook bij losse posities en uitgeklapte benen. Bij verschillende openingsdatums blijven beide datums en weken zichtbaar.
- Gemeenschappelijke expiratie en resterende looptijd. Gekozen DTE blijft per been zichtbaar als de twee waarden verschillen.
- Netto gemiddelde openingspremie per set: shortpremie minus longpremie. Positief is credit, negatief is debet.
- Netto actuele sluitprijs per set: shortprijs minus longprijs. Positief betekent netto betalen bij sluiten; negatief betekent netto ontvangen. Dit is een combinatie van de bestaande positieprijzen, geen uitvoerbare bid/ask-quote of ordervoorstel.
- Marktwaarde en winst/verlies zijn de som van de toegewezen benen. Bij ontbrekende waarden staat een streepje; er wordt geen schijnbaar volledig resultaat berekend. De hoofdregel toont geen gecombineerd winstpercentage omdat de benen verschillende grondslagen kunnen hebben. De bestaande percentages blijven zichtbaar bij de benen.

## Herkenning en aantallen

De weergave herkent posities uit de beschikbare open benen, zonder de onderliggende brokerdata te wijzigen:

1. **SYNT long:** long call en short put, zelfde aandeel, strike en expiratie.
2. **SYNT short:** short call en long put, zelfde aandeel, strike en expiratie.
3. **Put Spread:** short put en long put op hetzelfde aandeel en dezelfde expiratie, met verschillende strikes. Dit omvat credit- en debetvarianten.

SYNT wordt eerst gematcht. Een toegewezen contract wordt niet opnieuw in een putspread gebruikt. Bij meerdere kandidaten krijgen dezelfde openingsdatum, vervolgens de kleinste strikeafstand en tot slot de contract-ID voorrang. De koppeling is een deterministische indeling van de huidige blootstelling; er is geen bewijs van een oorspronkelijke combinatieorder nodig. Onbekende strikes/expiraties of niet-passende benen worden niet gegroepeerd.

Per koppeling wordt het kleinste beschikbare aantal toegewezen. Bij drie short puts en één passende long put ontstaat één spreadset plus twee losse short puts. Marktwaarde en resultaat worden evenredig verdeeld; prijs, openingsdatum en DTE blijven op de oorspronkelijke basis staan. De invoer wordt niet gemuteerd. Een resterend been krijgt zijn zelfstandige long/short-call/putlabel.

De bestaande CSP-reservering, vrij besteedbaar geld, contracttotalen en financiële berekeningen zijn niet gewijzigd. De UI-groepering is geen nieuwe margincalculatie.

## Ontwikkeling en validatie

Vanuit `source/`:

```powershell
npm run test:frontend
npm run build
# Vite in een aparte terminal:
npm run dev -- --host 127.0.0.1 --port 5197
node scripts/verify-option-groups-browser.mjs
node scripts/verify-stats-browser.mjs
node scripts/verify-financial-browser.mjs
npm run test:layout
```

De groepering en ISO-week staan in `src/option-groups.ts`; de tabelweergave in `src/OptionsPage.tsx` en `src/option-groups.css`. Zeven nieuwe berekeningstests dekken het SMCI-voorbeeld, ongelijke aantallen, SYNT-prioriteit, debetposities, ontbrekende data, deterministische matching en ISO-weken rond de jaarwisseling.

Browsercontrole gebruikt expliciete testbenen voor een SMCI-putspread, een SYNT met verschillende openingsweken/DTE's en een losse long put. Getest: eenmaal ingeklapt tonen, twee benen uitklappen, toetsenbordbediening, hoofdregelbedragen, ongewijzigde totalen en beide thema's op 375/768/1440 pixels zonder pagina-overloop of JavaScript-paginafouten. De tabel heeft een eigen horizontaal scrollvak met zichtbare eerste kolom; layout containment voorkomt dat uitgeklapte rijen de mobiele paginabreedte vergroten. Screenshots blijven privé in `source/data/private/option-groups-validation/`. Geen live brokerorders uitgevoerd.
