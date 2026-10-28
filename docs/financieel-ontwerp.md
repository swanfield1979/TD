# Financieel ontwerp

Lokale wijziging van 28 oktober 2026, gebaseerd op broncodeversie 0.42.2. Nog niet gepubliceerd.

## Vormgeving

De werkplek gebruikt diepblauwe oppervlakken in donkere modus en koele, lichte oppervlakken in lichte modus. Blauw ondersteunt navigatie en saldografieken; groen en rood tonen financiële resultaten. Valuta, plustekens, mintekens en labels blijven zichtbaar zodat kleur niet de enige informatiedrager is. De bestaande keuze voor licht/donker blijft bewaard.

Het portefeuillesaldo krijgt nadruk binnen vier kerncijfers. Bedragen gebruiken tabellarische cijfers. De bestaande maximale applicatiebreedte van 1760 pixels blijft gelden. De positie-identificatie blijft zichtbaar tijdens horizontaal scrollen in aandelen-, opties- en transactietabellen. Details en toelichtingen krijgen grotere tekst; afwisselende rijen en hovermarkering helpen bij vergelijken.

De dashboardgrafieken bevatten uitklapbare tabellen met de exacte maandsaldi en netto maandresultaten, inclusief valuta. Openen kan via toetsenbord. Op smalle schermen scrollt alleen het grafiekvak horizontaal, terwijl titel, periodekeuze en datatabel op hun plek blijven. Negatief vrij besteedbaar geld wordt rood getoond. Financiële berekeningen en databronnen zijn ongewijzigd.

## Implementatie

- `source/src/financial-theme.css`: gedeelde semantische kleuren, typografie en componentvormgeving, na de bestaande stylesheet geladen.
- `source/src/DashboardPanels.tsx`: grafiekvakken, themakleur voor grafiekvulling en exacte maandtabellen.
- `source/src/PortfolioAllocationCard.tsx`: verlieskleur voor negatief vrij besteedbaar geld.
- `source/scripts/verify-financial-browser.mjs`: herhaalbare browsercontrole; screenshots blijven in `source/data/private/layout-validation/` en horen niet bij een distributie.

De skill ui-ux-pro-max leverde bruikbare aanbevelingen voor een gegevensrijk dashboard en financiële typografie. De voorgestelde marketingpagina-opbouw paste niet bij deze bestaande applicatie en is niet overgenomen. Geen nieuwe runtime-afhankelijkheden of externe lettertypen toegevoegd.

## Uitgevoerde validatie

Vanuit `source/`:

```powershell
npm run build
npm run test:frontend
# Start in een aparte terminal:
npm run dev -- --host 127.0.0.1 --port 5197
npm run test:layout
node scripts/verify-financial-browser.mjs
```

Build en alle 13 frontendtests geslaagd. De bestaande layoutcontrole slaagde op 360–3440 pixels, inclusief mobiele navigatie en 200% zoom. De aanvullende browsercontrole slaagde in licht en donker op Dashboard, Stocks, Options, Trades, Stats en Goals bij 375 × 812, 812 × 375 en 1440 × 1050 pixels, zonder pagina-overloop of JavaScript-paginafouten. De gedeelde primaire, secundaire, gedempte, succes-, verlies- en accenttekstkleur halen minimaal 4,5:1 op de drie hoofdoppervlakken in beide thema's. Toetsenbordbediening van maandtabellen en verminderde beweging gecontroleerd.

Screenshots van dashboard, aandelen, opties en mobiel visueel bekeken. Browsercontroles gebruiken de bestaande lokale Flex-gegevens en afgevangen API-antwoorden; een live brokerverbinding en serverpublicatie maken geen deel uit van deze controle.
