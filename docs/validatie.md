# Validatie

## IBKR-koppeling

- De backend bindt alleen aan `127.0.0.1`.
- Een POST-opdracht vereist dezelfde toegestane origin en de applicatieheader.
- De systemd-unitnaam komt uitsluitend uit de serverconfiguratie en wordt gevalideerd.
- De backend gebruikt geen shell voor het starten van Gateway.
- De browser ontvangt geen IBKR-rekeningnummer, gebruikersnaam of wachtwoord.
- De snapshot wordt atomair met bestandsmodus `0600` opgeslagen.
- Er is geen orderfunctionaliteit aanwezig.
- Een tweede refresh wordt genegeerd zolang de eerste nog loopt.
- De normalisatie van netto liquidatiewaarde, positie-P/L, optiecontractgegevens, dagelijkse koersbeweging en strategieherkenning wordt met unit-tests gecontroleerd.

De eerste versie wordt gecontroleerd met:

- parser-tests via `npm test`;
- strikte TypeScript-controle en productiebuild via `npm run build`;
- visuele controle op breed desktopformaat en compacte mobiele breedte;
- controle van het lokale gegenereerde JSON-bestand tegen de bronwaarden.

## Resultaat 26 september 2026

- `npm test`: 16 van 16 tests geslaagd, inclusief meerjarige deduplicatie, referentiemaanden, jaardoelberekening, IBKR-snapshotnormalisatie, optiecontractgegevens, synthetische strategieherkenning, dagelijkse koersbeweging, covered-call-dekking en CSP-reservering.
- `npm run build`: geslaagd met TypeScript 7 en Vite 8.
- Meerjarige XML-import: 453 unieke dagsaldi, 1.430 unieke trades en 156 optie-events uit zes lokale jaarbronnen verwerkt.
- Desktopweergave: visueel gecontroleerd in de lokale browser.
- Browserconsole: geen fouten of waarschuwingen.
- Compacte weergave: responsieve kaartopmaak en begrensde horizontale tabelscroll zijn op een gesimuleerde viewport van 768 pixels gecontroleerd.
- Jaargrafiek: januari–september 2026 met bronwaarden gecontroleerd; oktober–december tonen expliciet dat data ontbreekt en alle twaalf maandbedragen van 2025 staan als grijze referentiebalken op dezelfde schaal.
- Opgeschoonde jaargrafiek: samenvattingsbalk en uitklapbare maandtabel zijn niet meer aanwezig.
- Vereenvoudigde dashboardkop: bovenlabel en toelichtingszin zijn niet meer aanwezig; titel en gegevensstatus blijven uitgelijnd.
- Optieactiviteit: 181 tradecycli, 171 gesloten en 10 open; 167 gesloten cycli hebben een meetbare looptijd.
- Premies: YTD en de huidige/vorige rapportmaand gecontroleerd tegen de sommen uit het Flex-tradesrapport.
- Schone browsercontrole na de dashboarduitbreiding: geen fouten of waarschuwingen.
- Valutaweergave: saldo, winst, jaargrafiek en premiegegevens tonen uitsluitend het `$`-teken, zonder uitgeschreven valutacode.
- Compacte statistiekkaarten: visueel gecontroleerd op brede, middelgrote en mobiele viewport; geen horizontale pagina-overflow en geen consolewaarschuwingen.
- Overzichtsraster: gelijke buitenranden met Jaarverloop en een sluitende kaartverdeling gecontroleerd op brede, middelbrede en compacte weergave.
- Portefeuilleverdeling: bronberekening, percentages, toegankelijk tekstalternatief, brede plaatsing naast Saldo en mobiele stapeling gecontroleerd.
- Compactere verhoudingen: begrensde kaartbreedtes en kleinere typografie op 1920 en 768 pixels gecontroleerd, zonder horizontale overflow.
- Dagelijkse W&V: `$ +32,55` en `+0,04%` gecontroleerd tegen de laatste twee beschikbare handelsdagsaldi; de kaart staat tussen Saldo en Portefeuilleverdeling en de donut bevat geen dubbele dagwaarde meer.
- Semantische kleuren: positieve resultaten en opbrengsten groen; negatieve resultaten, terugkoop, commissie en negatief nettoresultaat rood.
- Stocks-pagina: vijf open posities, FIFO-aankoopwaardes en CC-dekking gecontroleerd; lege koersvelden, lege toestand, desktopweergave en mobiel begrensde tabelscroll getest.
- Dagbeweging: positieve, negatieve, ongewijzigde en ontbrekende waarden hebben een expliciete tekstuele weergave; de vorige slotkoers blijft read-only en ontbrekende data wordt niet als nul geïnterpreteerd.
- Options-pagina: 10 open posities en 37 contracten uit de huidige Flex-data gecontroleerd; strike, expiratie, openingspremie, gekozen en resterende DTE worden correct getoond.
- Strategieherkenning: de gekoppelde long call en short put op dezelfde OUST-strike en expiratie worden beide als `SYNT long` gemarkeerd.
- Strategiepresentatie: synthetische combinaties gebruiken naast het label een Fluent-samenvoegicoon, een amberkleurige strategie-accentlijn en een toegankelijke tekstuele aanduiding.
- Options-layout: alle kolommen passen op breed desktopformaat; op 768 pixels blijft de pagina zelf begrensd en scrolt uitsluitend de tabel horizontaal.
- CSP-reservering: alle open short puts, inclusief de synthetische short-putleg, reserveren strike maal 100 maal contractaantal; compacte IBKR-contractnamen leveren een veilige strike-fallback.
- Vrij te besteden: saldo minus actuele aandelenwaarde minus CSP-reservering; het Dashboard verplaatst dezelfde reservering van Geld / overig naar Opties.
- Goals-resultaat 2025: startsaldo `$ 35.772,47`, 30% rendement `$ 10.731,74`, jaarlijkse inleg `$ 12.000,00`, doel `$ 58.504,21`, eindresultaat `$ 82.465,00` en verschil `$ +23.960,79` gecontroleerd tegen de gegenereerde brondata.
- Goals-berekening 2026: startsaldo `$ 82.465,00`, 30% rendement `$ 24.739,50`, jaarlijkse inleg `$ 12.000,00` en jaardoel `$ 119.204,50` gecontroleerd tegen de gegenereerde brondata.
- Goals-layout: vier compacte bronkaarten, een semantische voortgangsbalk, voor/achter-schema-indicator en vijfjarenplanning visueel gecontroleerd in de bestaande dashboardstijl.
- Trades-import: 404 afgesloten optiecycli gevonden: 14 gesloten in 2024, 219 gesloten in 2025 en 171 gesloten in 2026.
- Trades-jaarkeuze en paginering: 2025 toont 219 trades op vijf pagina's en 2026 toont 171 trades op vier pagina's, steeds maximaal 50 regels en met toegankelijke vorige-, volgende- en paginanummerknoppen.
- Trades-berekening: netto cashflow inclusief commissies, rendement op openingspremie en lineaire jaaromrekening gecontroleerd met een gesloten short-puttest.
- Trades-layout: numerieke kolommen rechts uitgelijnd, semantische winst/verliesweergave en uitsluitend tabelscroll op compacte breedtes.
- Stats 2026: 171 afgesloten trades, 84,8% winratio, `$ +6.155,29` nettoresultaat, `$ +36,00` gemiddeld per trade, profit factor 1,42 en 13,1 dagen gemiddelde looptijd gecontroleerd.
- Stats 2025: 219 afgesloten trades, 83,1% winratio, `$ +19.439,52` nettoresultaat, `$ +88,76` gemiddeld per trade, profit factor 1,83 en 8,4 dagen gemiddelde looptijd gecontroleerd.
- Dashboard-scope 2026: 171 afgesloten trades en 10 actuele open posities leveren 181 totaal; premiebehoud 25,0%, `$ 39.981,00` ontvangen brutopremie en 13,1 dagen gemiddelde looptijd zijn uitsluitend uit 2026 berekend.
- Gerealiseerd maandresultaat september 2026: premie `$ -490,21`, aandelenverkopen `$ 0,00` en gesloten SYNT `$ +1.984,52` leveren samen `$ +1.494,31`.
- Gerealiseerd maandresultaat augustus 2026: premie `$ +2.665,70`, aandelenverkopen `$ 0,00` en gesloten SYNT `$ +1.771,57` leveren samen `$ +4.437,27`; een aparte regressietest voorkomt dubbeltelling van de korte synthetische leg.
- Stats-jaarkeuze: kerncijfers, maandgrafiek, winst/verliesdonut, grootste resultaatimpact en looptijdverdeling wisselen tussen 2024, 2025 en 2026 en openen standaard op 2026.
- Portefeuilleverloop: 26 werkelijke maandeindsaldi van augustus 2024 tot en met september 2026 verwerkt; de grafiek opent op 2026 en de filters 2024, 2025, 2026 en Alles veranderen uitsluitend deze historische grafiek.
