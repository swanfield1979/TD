# Architectuur

Trading Monitor bestaat uit een React/TypeScript-interface met Vite en een kleine lokale Node-backend voor de read-only IBKR-koppeling.

1. De privé Flex XML-rapporten staan uitsluitend lokaal in `source/data/private/`.
2. `source/scripts/import-flex.mjs` leest de rapporten en berekent saldo-, maand-, trade-, looptijd-, premie- en allocatiestatistieken.
3. De samenvatting wordt lokaal geschreven naar `source/public/data/portfolio-summary.json`.
4. De React-app haalt dit JSON-bestand op en toont de statistieken op de Dashboard- en Stocks-pagina.

Ruwe trades, rekeningidentificatie en andere XML-inhoud worden niet naar de browser gekopieerd. De live IBKR-koppeling loopt uitsluitend via de lokale server-API; inloggegevens en rekeningidentificatie blijven op de server.

## Productiehosting

De productiebuild gebruikt `/` als basispad en wordt vanuit `/var/www/trading-monitor` door Nginx aangeboden. Nginx luistert als standaardserver op poort 80. HTML en financiële JSON-data worden niet gecachet; gehashte statische assets krijgen langdurige caching.

## Live IBKR-gegevens

De read-only Node-backend luistert uitsluitend op `127.0.0.1:8787`. De browser bereikt deze via dezelfde Nginx-origin onder `/api/`. Een refreshopdracht start zo nodig de vaste `ibc-gateway.service`; vrije shellopdrachten of door de browser bepaalde unitnamen zijn niet mogelijk.

IBC start IB Gateway op een afgeschermd virtueel X-scherm. De gebruiker bevestigt de IB Key MFA in IBKR Mobile. Daarna vraagt de backend met een eigen client-ID accountupdates op. De browser ontvangt geen rekeningnummer of inloggegevens, maar alleen de netto liquidatiewaarde en genormaliseerde positiegegevens.

De live snapshot vervangt in de interface uitsluitend actuele waarden: saldo, portefeuilleverdeling en open aandelenposities. Historische maand- en jaarcijfers blijven afkomstig uit de lokale Flex-import.
