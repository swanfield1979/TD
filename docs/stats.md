# Stats

Stats-uitbreiding vanaf broncodeversie 0.42.4, meegeleverd in 0.42.5 van 28 oktober 2026. Serverinstallatie nog niet uitgevoerd.

De Stats-pagina gebruikt elementen uit de aangeleverde portefeuillereferentie: een prominente resultaatlijn, compacte analysekaarten en een volledig prestatieoverzicht per aandeel. Open holdings en open trades zijn niet toegevoegd.

## Selectie en bedragen

Het analysejaar geldt voor alle gesloten optietrades, de nieuwe resultaatlijn, kaarten, maandgrafiek, verdelingen en prestatietabel. Standaard is het nieuwste jaar uit sluitingen en saldohistorie actief. De bestaande saldografiek houdt zijn eigen periodekeuze, inclusief Alles; deze keuze staat expliciet vermeld. Het saldo omvat inleg en open posities en is geen beleggingsrendement.

De gesloten optiebedragen gebruiken `premiumCurrency` uit de portefeuilledata, met portefeuillevaluta als terugval. De afzonderlijke saldografiek gebruikt `currency`. Er vindt geen nieuwe valutaconversie plaats. De bestaande nettoresultaten bevatten de verwerkte handelskosten.

## Nieuwe onderdelen

- **Cumulatief nettoresultaat:** sluitingen per datum opgeteld, vervolgens chronologisch gecumuleerd vanaf nul op 1 januari van het gekozen jaar. De horizontale positie volgt de werkelijke kalenderafstand. Exacte dagresultaten zijn via een uitklapbare tabel beschikbaar, ook met toetsenbord. Geen open winst/verlies of aandelenverkopen.
- **Opbouw nettoresultaat:** short puts, short calls, long opties en eventueel overige shortopties. Geen aanname dat short calls covered zijn of puts volledig door cash gedekt zijn.
- **Winst & verlies:** som en gemiddelde van positieve en negatieve sluitingen; payoffratio is gemiddelde winst gedeeld door de absolute gemiddelde verliestrade. De ratio ontbreekt wanneer een van beide groepen ontbreekt.
- **Terugval & uitersten:** grootste terugval in het cumulatieve gesloten resultaat vanaf de hoogste dagstand, met nul als startpiek; beste en slechtste afzonderlijke sluiting. Dit is een geldbedrag en geen drawdownpercentage van de portefeuille. Sluitingen op dezelfde dag worden vóór de terugvalmeting gesaldeerd om geen fictieve intraday volgorde te veronderstellen.
- **Prestaties per aandeel:** alle aandelen in het gekozen jaar, standaard op aflopend nettoresultaat. Zoeken op ticker/naam en sorteren op aandeel, nettoresultaat, sluitingen, winratio, gemiddelde winst, dagen en openingsrendement. De tabel telt de zichtbare selectie op. De eerste kolom blijft zichtbaar bij horizontaal scrollen.

## Gemiddelden en ontbrekende gegevens

Een gedeeltelijke sluiting telt als één sluiting. Gemiddelden zijn per sluiting, zonder weging naar contractaantal. Winratio = aantal positieve sluitingen gedeeld door alle sluitingen, inclusief neutrale sluitingen. Bij gemiddelde dagen en openingsrendement is de meetdekking zichtbaar als bekend/totaal. Onbekende waarden tellen niet als nul; een bekende looptijd of rendement van nul telt wel mee.

Openingsrendement gebruikt het bestaande `profitPercentage`: nettoresultaat gedeeld door de openingswaarde van de optie, maal 100. Bij shortopties betreft die openingswaarde de optiepremie. Dit is geen rendement op gereserveerd onderpand (ROC). Onbekende waarden staan onderaan bij sorteren.

De SPY-benchmark, Sharpe, Sortino, geannualiseerd kapitaalrendement, dividend/rente, historische kapitaalinzet en sector-/industrieanalyse uit de referentie zijn niet overgenomen. De huidige Stats-invoer bevat daarvoor geen volledige, betrouwbare tijdreeksen en classificatie. Er zijn geen waarden geschat om die panelen te vullen.

## Ontwikkeling en controle

Vanuit `source/`:

```powershell
npm run test:frontend
npm run build
# In een aparte terminal:
npm run dev -- --host 127.0.0.1 --port 5197
node scripts/verify-stats-browser.mjs
node scripts/verify-financial-browser.mjs
```

Nieuwe berekeningen: `src/stats-analytics.ts`; componenten: `src/StatsPerformance.tsx`; stijl: `src/stats-performance.css`. Vier berekeningstests controleren dagaggregatie, terugval, ontbrekende waarden, nulwaarden, typen, sluitingsweging en behoud van verliezen/totalen. Browsercontrole: beide thema's op 375/768/1440 pixels, zoeken, sorteren, jaarselectie, toetsenbordbediening en lege historie. Lokale Flex-data en afgevangen brokerantwoorden; geen live broker vereist. Screenshots blijven privé onder `source/data/private/stats-validation/`.
