# Jaaroverzicht in Handelsdetails

Vanaf 0.43.1 toont het dashboard **Dit jaar · 2026** en **Vorig jaar · 2025** met jaarlijkse nettoresultaten, short/long opties, aandelen en premiedetails. De jaren volgen de laatste portefeuillemeting. Het huidige jaar loopt tot de peildatum; vorig jaar omvat het kalenderjaar. Gateway-resultaten worden aan het juiste jaar toegevoegd zonder dubbeltelling.

Gemiddeld per maand, totaal trades, premie behouden, gemiddeld aangehouden en de maandgrafiek blijven op het huidige rapportjaar gebaseerd.

## Installatie

Herimporteer bestaande Flex-historie voor volledige jaarbedragen en premiedetails. Een nieuwe export is niet nodig als de privéhistorie beide jaren bevat. Vanuit `source/`, na het ophalen van de broncode:

```powershell
npm ci
npm run import:flex
npm run build
```

Publiceer daarna volgens de [installatiehandleiding](installatie.md). Dit geldt ook na bijwerken via Updates: de updater kopieert de bestaande samenvatting en importeert de XML niet opnieuw. Zonder herimport blijft de huidige jaarsom uit de maandhistorie beschikbaar; ontbrekende jaarhistorie toont een streepje met herimportmelding.

## Validatie

Vanuit `source/`: `npm test`, `npm run test:frontend`, `npm run build`. Met Vite op 5197: `node scripts/verify-year-details-browser.mjs` en `node scripts/verify-option-groups-browser.mjs`. Jaarregressies dekken premiedetails, aandelen, Gateway-aanvulling, herhaald verversen, jaarwisseling en oudere imports. Browsercontrole: beide thema’s op 375/1440 pixels, bedragen, behoud maandgemiddelde en geen pagina-overloop of paginafouten. Desktop-screenshot visueel gecontroleerd. Serverinstallatie nog niet uitgevoerd.
