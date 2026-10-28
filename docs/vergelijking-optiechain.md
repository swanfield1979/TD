# Vergelijking optiechains en verbeteringen in 0.40.0

Onderzocht op 28 oktober 2026: de door de gebruiker aangeleverde `option_chains.zip` en schermafbeelding, vergeleken met Trading Monitor 0.39.2. De externe Python-bestanden zijn alleen gelezen; er is geen externe applicatie uitgevoerd of broncode uit het archief opgenomen.

## Hoe de aangeleverde code werkt

`scrapers/yf_api_scraper.py` leest een ingestelde watchlist, haalt met yfinance de aandeelkoers en beschikbare expiraties op en vraagt per expiratie een volledige chain op. Alleen expiraties binnen de ingestelde DTE-grenzen en rond de derde vrijdag worden verwerkt. Calls en puts met positieve open interest worden voorzien van lokaal berekende Black-Scholes-greeks; contracten met absolute delta tussen 0,05 en 0,95 gaan naar SQLite. `db/mutations.py` bewaart de contractgegevens; `db/queries.py` en `db/master_queries.py` lezen die weer voor de toepassing. Onderliggende gegevens kunnen daardoor vooraf worden verzameld en later lokaal worden gefilterd.

De optiechainfunctie zelf verwerkt tickers en expiraties achtereenvolgens. De multithreading in hetzelfde bestand betreft andere aandelenanalyses. De zip bevat geen implementatie van het getoonde scherm, geen volledige toepassing en geen vergelijkbare snelheidsmeting. Een claim dat deze scanner integraal sneller of beter is, valt daarom niet te bevestigen.

De afbeelding toont **Short Put Results**, dus losse verkochte puts. Het rendement daarvan kan niet rechtstreeks worden vergeleken met het rendement op het maximale verlies van een bull-put-spread. Ook de exacte berekening van “Prob. Worthless” is met deze bestanden niet te controleren.

## Overgenomen principes

- **Vroeg filteren:** koers, DTE, IV-rank, buffer, delta-indicatie en bied-laatgrens worden vóór de dure paarberekening getoetst. Long-strikes worden gesorteerd; alleen lagere strikes worden gecombineerd. Beide benen blijven alle bestaande contract- en quotevalidaties doorlopen.
- **Minder herberekenen:** resultaten worden eenmaal per groep van maximaal vier contractquotes bijgewerkt, in plaats van na ieder contract.
- **Begrensde gelijktijdigheid:** maximaal vier optiequotes tegelijk. De bestaande aanvraagpacer, historische budgetten, brokerpauzes en stopfunctie blijven van kracht. Iedere fallbackronde gebruikt één markt-datatype; pas nadat alle aanvragen zijn afgerond of opgeruimd wordt de verbinding omgeschakeld. CSP en Leaps behouden hun bestaande verwerking.
- **Compact overzicht:** sector en aandeelgebonden volumes staan achter **Uitgebreide tabel**. Buffer, DTE en het grootste bied-laatverschil van beide puts staan direct in de tabel. De tabel heeft afwisselende rijen en een vaste kop binnen een begrensd scrollgebied.
- **Vergelijking tussen looptijden:** **Jaar-R/R** is rendement op risico × 365 / DTE, vóór kosten. Dit is een lineaire vergelijkingsmaat, geen rendementsprognose. Sorteren op jaarlijks rendement/risico, buffer en DTE is toegevoegd. CSV bevat ook `annualizedReturnOnRisk`; de bestaande ruwe quotevelden blijven behouden.

## Bewust behouden

IBKR blijft de optiebron. De bestaande lokale chaincache en herfiltering waren al aanwezig. Yahoo-koersen of zelf berekende greeks vervangen geen brokerquotes. De conservatieve credit blijft short-bied minus long-laat; maximaal verlies blijft (strikebreedte − credit) × 100. De delta-indicatie blijft **OTM-proxy**, zonder claim van exacte winstkans.

De beperking tot maandexpiraties is niet overgenomen: dat zou geldige weekopties uitsluiten. De eenvoudige donderdagregel in het archief bewijst bovendien geen beursfeestdag. Positieve open interest wordt geen nieuw verplicht criterium zolang de huidige quotes geen betrouwbare open-interestdekking leveren. Scanfilters en de bestaande dekking van maximaal 32 strikes per expiratie/handelsklasse blijven behouden.

## Validatie en beperkingen

De geoptimaliseerde selectie is vergeleken met uitputtend combineren in 40 reproduceerbare, gevarieerde chains, inclusief ongeldige waarden. Een lokale synthetische vergelijking met de vorige implementatie op 640 contracten leverde in beide gevallen exact 420 spreads: mediaan circa 7,84 ms tegenover 3,80 ms over 20 uitvoeringen. Dit meet alleen CPU-tijd voor de selectie, niet de totale broker- of internetsnelheid.

Brokersimulaties controleren de grens van vier abonnementen, opruimen, fallbacktypen, annulering en snelheidslimieten. De totale liveversnelling is afhankelijk van IBKR-responstijden en de bestaande pacing; er is geen livevergelijking met de externe toepassing uitgevoerd. De GitHub-versie moet nog afzonderlijk op de productieserver worden geïnstalleerd.
