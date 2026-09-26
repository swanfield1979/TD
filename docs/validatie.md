# Validatie

De eerste versie wordt gecontroleerd met:

- parser-tests via `npm test`;
- strikte TypeScript-controle en productiebuild via `npm run build`;
- visuele controle op breed desktopformaat en compacte mobiele breedte;
- controle van het lokale gegenereerde JSON-bestand tegen de bronwaarden.

## Resultaat 26 september 2026

- `npm test`: 3 van 3 tests geslaagd.
- `npm run build`: geslaagd met TypeScript 7 en Vite 8.
- XML-import: 192 dagsaldi, 637 trades en 35 optie-events verwerkt.
- Desktopweergave: visueel gecontroleerd in de lokale browser.
- Browserconsole: geen fouten of waarschuwingen.
- Compacte weergave: responsieve éénkolomsopmaak en overlaymenu zijn in de stylesheet afgedekt; een aparte gesimuleerde mobiele viewport was in de beschikbare browser niet actief.
- Jaargrafiek: januari–september met bronwaarden gecontroleerd; oktober–december tonen expliciet dat data ontbreekt.
- Exacte maandtabel: uitklappen en alle twaalf maandregels gecontroleerd.
- Schone browsercontrole na de grafiekwijziging: geen fouten of waarschuwingen.
