# Validatie

## Resultaat 6 oktober 2026 — versie 0.26.2 (lokaal)

- Regressies controleren winst en verlies op gekochte opties, waardeloze expiratie en een synthetic waarvan beide legs in dezelfde resultaatperiode sluiten.
- Gesimuleerde Gateway-sluitingen controleren dat ook een actuele long-optiesluiting in maand, jaar en maandgemiddelde terechtkomt.
- De private Flex-import is opnieuw berekend; de basis t/m 2 oktober 2026 geeft een gerealiseerd jaarresultaat van `$ +7.715,02`, gelijk aan de som van de getoonde maandresultaten uit alle afgesloten optielegs plus aandelenverkopen.
- `npm test`: 72 van 72 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.

## Resultaat 5 oktober 2026 — versie 0.26.1 (lokaal)

- Kalendertests controleren pre-market vanaf 04:00 ET, slotcontrole om 16:00 ET, Amerikaanse zomer-/wintertijd, weekenden, NYSE-feestdagen in 2026–2028 en vroege sluiting om 13:00 ET.
- De geplande service gebruikt uitsluitend de lokale beveiligde refreshroute; hij bevat geen IBKR-inloggegevens en kan IB Key niet automatisch goedkeuren.
- `npm test`: 72 van 72 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.
- Systemd-units en installatie-/controlecommando's zijn toegevoegd; live-installatie op de server staat nog open.

## Resultaat 5 oktober 2026 — versie 0.26.0 (lokaal)

- De aangeleverde Flex YTD-bronnen van 2026 zijn verwerkt: saldo en trades lopen t/m 2 oktober, de dashboardmaand is oktober en de Gateway-overlapgrens staat op 2 oktober.
- De gegenereerde basis toont oktober als actuele maand; volgende Gateway-uitvoeringen worden vanaf de nieuwe overlapgrens zonder dubbeltelling toegevoegd. Exacte portefeuillebedragen blijven buiten Git.
- Regressiesnapshot van 5 oktober 2026 controleert dat **Deze maand** oktober toont en september naar **Vorige maand** schuift.
- Dezelfde synchronisatie verwerkt een gerealiseerde optiesluiting en aandelenverkoop in maand, jaar, gemiddelde, premie, maandgrafiek, saldohistorie en het actuele doel.
- `npm test`: 68 van 68 tests geslaagd. `npm run build`: TypeScript- en Vite-productiebuild geslaagd.
- Live-publicatie en controle tegen de eigen IBKR Gateway staan nog open.

## Resultaat 2 oktober 2026 — versie 0.25.1 (lokaal)

- De werkelijke lokale bron is gereproduceerd: saldohistorie t/m 24 september 2026, laatste Flex-trade op 23 september 2026. De oude overlapgrens sloot daardoor Gateway-mutaties van 24 september ten onrechte uit.
- `npm run import:flex` schrijft nu 23 september 2026 als `tradesThroughDate`; de private samenvatting is opnieuw gegenereerd.
- `npm test`: 67 van 67 tests geslaagd. Nieuwe regressies controleren zowel de berekende overlapgrens als een Gateway-sluiting op de daaropvolgende saldodag.
- `npm run build`: TypeScript- en Vite-productiebuild geslaagd. Live-publicatie en controle tegen de eigen IBKR Gateway staan nog open.

## Resultaat 30 september 2026 — versie 0.25.0 (lokaal)

- `npm test`: 65 van 65 tests geslaagd. TypeScript/Vite-productiebuild geslaagd; `git diff --check` zonder whitespacefouten.
- Gesimuleerde Gateway controleert de rekeningfilter zonder clientfilter, wachten op uitvoeringen en later ontvangen commissies, en weigeren van afgebroken uitvoeringsdownloads.
- Regressies voor twee rolls, gedeeltelijke sluitingen, heropenen dezelfde dag, opgeslagen historie, herhaalde refresh, uitvoeringscorrecties, latere Flex-overlap, ontbrekende openingsgegevens en IBKR-sentinelwaarden.
- React/TypeScript-integratie controleert dat Gateway-sluitingen in de portefeuille en handelsaantallen verschijnen en bij herladen niet verdubbelen.
- De eigen IBKR Gateway is in deze omgeving niet getest. Serverpublicatie, Master API client ID en zichtbaarheid van de twee werkelijke rolls moeten na installatie worden gecontroleerd; geen live-publicatie geclaimd.

## Resultaat 30 september 2026 — versie 0.24.0

- `npm run import:flex`: lokale Flex-import geslaagd; de nieuwe maandreeks is opgenomen in de gegenereerde private samenvatting.
- `npm test`: 55 van 55 tests geslaagd. `npm run build`: TypeScript en Vite-productiebuild geslaagd. `git diff --check`: geen whitespacefouten.
- Regressie controleert dat maandresultaten dezelfde sluitingsdatum, kosten en peildatum gebruiken als het jaarresultaat; toekomstige transacties blijven uitgesloten en de som van maanden sluit aan op het jaarresultaat.
- React-rendercontrole: jaardoel zonder inleg verzint geen jaarschema; een oud doel past niet op een nieuwjaarsaldo; historische netto-premie blijft zichtbaar; oude JSON zonder maandreeks geeft een herimportmelding.
- Lokale browsercontrole: dashboard, jaarkeuze 2025/2026, navigatie naar Stocks, Options, Goals, Stats en Trades; mobiele weergave op 390 × 844 en desktopweergave. Positieve maandbalken zijn groen, negatieve rood.
- De liveserver is bereikbaar maar SSH-aanmelding via de huidige omgeving is geweigerd. Publicatie op de server wordt door de gebruiker via PuTTY uitgevoerd; geen live IBKR-refresh of serverpublicatie geclaimd.

## Resultaat 28 september 2026 — live saldoverandering (lokaal)

- `npm test`: 53 van 53 tests geslaagd. `npm run build`: TypeScript en productiebuild geslaagd.
- Getest: live bedrag/percentage, recentere referentie, meerdere updates, dezelfde rapportdag, ontbrekende referentie, nulbasis, dagwissel, herstart en verschillende valuta.
- React-rendercontroles verifiëren bedragen, percentages, datums en bronlabels. Geen nieuwe visuele browsercontrole of live IBKR-aanvraag uitgevoerd.
- Nog niet gepubliceerd; backendupdate vereist herstart van `trading-monitor-api.service`.


## Resultaat 27 september 2026 — versie 0.23.1

- `npm test`: 49 van 49 tests geslaagd. `npm run build`: geslaagd.
- React-renderregressie: saldo 86.097,12 tegenover jaardoel 119.204,50 toont een gevulde balk van 72,2%, terwijl het negatieve rendement na inleg afzonderlijk behouden blijft.

## Resultaat 27 september 2026 — versie 0.23.0

- `npm test`: 48 van 48 tests geslaagd. `npm run build`: TypeScript en productiebuild geslaagd.

- Regressies voor herhaalde en afsluitende IBKR-updates, behoud van koersreferenties, ontdubbeling van oude snapshots, OCC-expiratie en ongeldige datums.
- Integratietests laden de echte TypeScript/React-modules via Vite: beide laadvolgordes, herladen, oude snapshots, valuta, actuele aantallen, dagpercentage en Goals-jaarovergang.
- EAE-aandelenlevering plus verkoop op dezelfde dag gecontroleerd via zowel het realisatieregister als de volledige Flex-import. Geen fantoompositie achteraf.
- Nettoverdeling gecontroleerd met negatieve verplichtingen en negatieve cash; de bedragen tellen op tot de netto liquidatiewaarde.
- Alle twaalf lokale XML-bronnen opnieuw geïmporteerd. Privébronnen, financiële JSON en bouwuitvoer blijven buiten Git.
- Browsercontrole met de bestaande IBKR-snapshot en bewust 1,5 seconde vertraagde Flex-response: het actuele saldo blijft behouden. Dashboard toont zeven open posities; SOFI-expiratie is 23 oktober 2026. Er zijn geen orders of nieuwe IBKR-synchronisaties gestart.
- Dashboard visueel gecontroleerd op desktop en bij een viewport van 390 pixels; geen horizontale pagina-overloop. Options, Goals, Stats en Trades gecontroleerd op labels, datums en waarden. Browserconsole zonder fouten.

Publicatie op de Linux-server vereist naast import/build ook een herstart van `trading-monitor-api.service`, omdat de eventverwerking in de backend is gewijzigd.

## Resultaat 27 september 2026 — versie 0.20.0

- `npm test`: 31 van 31 tests geslaagd. De nieuwe regressies controleren sluitingsmaand/jaargrens, open posities, gedeeltelijke FIFO-sluitingen, rolls, gekochte calls, aandelen/ETF-verkopen, CC/CSP-assignment, expiratie, dubbele OptionEAE-events, uitoefening en commissies.
- `npm run import:flex`: alle negen beschikbare lokale jaarbronnen opnieuw verwerkt; alle gerealiseerde posities hebben bijbehorende openingshistorie.
- Onafhankelijke controle op de lokale bronnen: bij 444 volledig gesloten contracten/aandelenposities is de som van de resultaten gelijk aan de volledige transactiekasstroom inclusief commissies (tolerantie $ 0,001).
- Jaarresultaat gecontroleerd tegen het realisatieregister. De JSON in de productiebuild is identiek aan de opnieuw geïmporteerde samenvatting.
- `npm run build`: TypeScript-controle en Vite-productiebuild geslaagd.
- Deze wijziging is functioneel en via de build gecontroleerd; er is geen nieuwe visuele browsercontrole uitgevoerd.
- Ruwe XML, gegenereerde financiële JSON en tijdelijke bouwuitvoer blijven lokaal en buiten Git.

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

## Versie 0.21.0 — totale winst

- 32 tests geslaagd, inclusief startsaldo op de jaargrens, eerste beschikbare dag in 2025, nul en ontbrekende startgegevens.
- Flex-import, TypeScript-controle en productiebuild geslaagd.
- Kaart in de browser gecontroleerd op desktop en mobiel; geen horizontale pagina-overloop of afgeknipte kaarten op 1720, 1400, 1024, 768 en 360 pixels. Geen browserfouten of waarschuwingen tijdens de controle.
- Het actuele saldo wordt rechtstreeks uit dezelfde state gelezen als de Saldokaart, zodat een live update automatisch doorwerkt.

## Versie 0.21.1 — uitsluiting gekochte opties

- 33 tests geslaagd; expliciete regressies voor winst én verlies op gekochte opties, inclusief maand- en jaarafbakening.
- Import en TypeScript/Vite-build geslaagd. De maandkaarten bevatten uitsluitend premie en aandelen; jaarresultaat en maandgemiddelde gebruiken dezelfde selectie.

## Versie 0.21.2 — centrering

- Dashboardkaarten in de browser gecontroleerd op 1720, 768 en 360 pixels. De inhoud heeft per kaart gelijke ruimte boven en onder; geen horizontale pagina-overloop.
- 33 bestaande tests en de TypeScript/Vite-build geslaagd. Alleen uitlijning gewijzigd.

## Versie 0.22.0 — inleg en rendement

- 38 tests geslaagd, inclusief valutauitsplitsing zonder dubbeltelling, gelijke stortingen, opnames, cumulatieve rapportvervanging, ontbrekende jaarhistorie, verschillende peildatums en doelen bij extra inleg.
- Alle twaalf lokale XML-bronnen opnieuw geïmporteerd; jaartotalen gecontroleerd tegen de aangeleverde Cash Reports. Productie-JSON is gelijk aan de geïmporteerde samenvatting.
- TypeScript/Vite-build geslaagd. Dashboard en Goals gecontroleerd in de browser; geen horizontale pagina-overloop op desktop, tablet en mobiel (1720, 1024, 768 en 360 pixels voor Goals). Geen browserfouten tijdens de controle.
- Stortingsbestanden zijn uitgesloten van Git. De huidige winst is expliciet voorlopig omdat saldo- en inlegpeildatum één dag verschillen.
