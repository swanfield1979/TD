# Architectuur

Trading Monitor bestaat uit een React/TypeScript-interface met Vite en een kleine lokale Node-backend voor de read-only IBKR-koppeling.

1. De privé Flex XML-rapporten staan uitsluitend lokaal in `source/data/private/`.
2. `source/scripts/import-flex.mjs` leest alle jaarbestanden met de vaste Flex-voorvoegsels, dedupliceert overlappende saldodagen en IBKR-executies en berekent saldo-, maand-, open en afgesloten trade-, looptijd-, premie-, allocatie- en jaardoelstatistieken.
3. De samenvatting wordt lokaal geschreven naar `source/public/data/portfolio-summary.json`.
4. De React-app haalt dit JSON-bestand op en toont de gegevens op de Dashboard-, Stocks-, Options-, Goals-, Stats- en Trades-pagina.

Ruwe trades, rekeningidentificatie en andere XML-inhoud worden niet naar de browser gekopieerd. De live IBKR-koppeling loopt uitsluitend via de lokale server-API; inloggegevens en rekeningidentificatie blijven op de server.

## Productiehosting

De productiebuild gebruikt `/` als basispad en wordt vanuit `/var/www/trading-monitor` door Nginx aangeboden. Nginx luistert als standaardserver op poort 80. HTML en financiële JSON-data worden niet gecachet; gehashte statische assets krijgen langdurige caching.

## Live IBKR-gegevens

De read-only Node-backend luistert uitsluitend op `127.0.0.1:8787`. De browser bereikt deze via dezelfde Nginx-origin onder `/api/`. Een refreshopdracht start zo nodig de vaste `ibc-gateway.service`; vrije shellopdrachten of door de browser bepaalde unitnamen zijn niet mogelijk.

IBC start IB Gateway op een afgeschermd virtueel X-scherm. De gebruiker bevestigt de IB Key MFA in IBKR Mobile. Daarna vraagt de backend met een eigen client-ID accountupdates op. De browser ontvangt geen rekeningnummer of inloggegevens, maar alleen de netto liquidatiewaarde en genormaliseerde positiegegevens.

De live snapshot vervangt in de interface uitsluitend actuele waarden: saldo, portefeuilleverdeling en open aandelen- en optieposities. Expiratie, strike en call/put komen uit het IBKR-contract; openingsdatum en gekozen DTE worden waar mogelijk aangevuld vanuit de lokale Flex-import. Historische maand- en jaarcijfers blijven afkomstig uit de lokale Flex-import.

## Gerealiseerde resultaten

`source/scripts/realized-results.mjs` vormt het gezamenlijke FIFO-register voor resultaatkaarten, jaarpremie en afgesloten optietrades. `mergeOptionEvents` vult ontbrekende OptionEAE-sluitingen en aandelentransacties aan zonder dezelfde uitvoering opnieuw te boeken. `realizedResults` bewaart aanschafkosten en commissies in open lots, verwerkt gedeeltelijke afsluitingen op hun eigen datum en scheidt short-premie, aandelen en gekochte opties. Uitoefeningskosten van long opties worden aan de resulterende aandelentransactie gekoppeld. De Flex-import begrenst dit register op de laatste beschikbare saldodag. Historische saldo- en doelgrafieken blijven op netto liquidatiewaarde gebaseerd.

## Inleg en saldorendement

De Flex-import levert `contributionPeriods` met netto basistotalen en bruto stortingen/opnames per bronvaluta. Alleen niet-identificerende jaargegevens gaan naar de browser; ruwe exports blijven privé. `shared/contribution-return.mjs` berekent winst en eenvoudig rendement na inlegcorrectie en controleert of de jaarreeks sinds het startsaldo compleet is. Live saldorefresh herberekent de UI-waarden met dezelfde kasstroomhistorie; peildatumverschillen blijven zichtbaar. Zie [Inleg en rendement](inleg.md).
