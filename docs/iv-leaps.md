# IV Scan en Leaps — Trading Monitor 0.31.3

Breakout vervalt als menupagina. `#iv` opent **IV Scan** en `#leaps` opent **Leaps**. Bestaande `#breakout`-links en het pad `/breakout` openen IV Scan. Historische breakoutbroncode, cache en zelfstandige TradingView-bestanden blijven bewaard; de oude scanner wordt vanuit het menu niet meer gestart.

## Rustige IBKR-aanvragen (0.31.1)

De optiescans delen per Gateway een wachtrij in de Node-service. Maximaal één optiequote tegelijk (voorheen 15), minimaal 500 ms tussen nieuwe aanvragen en minimaal 11 seconden tussen historische downloads. Historie krijgt een conservatief budget van 55 requests per 10 minuten en 15 seconden tussen identieke aanvragen. Dit is ons voorzorgsbeleid voor dagelijkse IV-historie, geen claim dat de officiële small-bar-limieten rechtstreeks op dagbars gelden. Andere API-processen en TWS gebruiken dezelfde accountcapaciteit; deze wachtrij regelt alleen de optiescans in deze Node-service.

Geldige IV-historie wordt in het procesgeheugen voor dezelfde New York-beursdatum hergebruikt, maximaal 24 uur, met maximaal 500 cache-items. Na API-herstart is deze cache leeg. De actuele aandelen-IV en optiequotes worden opnieuw opgehaald. De shortlist blijft op schijf bewaard.

**Scanner type ... is disabled** betekent dat dat type niet beschikbaar is; het is geen pacing violation. Het type wordt één uur in het procesgeheugen overgeslagen, ook bij volgende scans of de andere marktlocatie. MOST_ACTIVE wordt hoogstens eenmaal geprobeerd als beide typen uitgeschakeld blijken. De app verwijst naar dezelfde scanner in TWS. Dit geldt voor de oudere CSP-marktverkenning. IV Scan gebruikt sinds 0.31.2 rechtstreeks aandelenlijsten en vraagt deze scannertypen niet meer aan. Leaps gebruikt de handmatige lijst. Voor beide blijven IBKR-marktdatarechten nodig.

Bij code 100/420 of een expliciete pacing-/message-rate-melding stopt de optiescan en volgt een pauze van minstens één minuut. Geen automatische retry of andere scannertypen na een snelheidslimiet. **Scan stoppen** breekt wachttijden en actieve aanvragen af en sluit de scanverbinding; reeds gevonden resultaten blijven zichtbaar. Stoproutes: `POST /api/iv-scan/stop`, `/api/leaps/stop` en `/api/scans/stop`, met dezelfde origin-/headercontrole.

Bronnen: [IBKR scanners](https://www.interactivebrokers.com/docs/tws-api/doc/market-scanner/introduction) en [historische beperkingen en soft throttling](https://interactivebrokers.github.io/tws-api/historical_limitations.html).

## IV Scan

Sinds 0.31.2 gebruikt IV Scan **geen IBKR-marktscannertype** meer. De app haalt de [S&P 500-ledenlijst](https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv) en [Nasdaq-symbolenlijst](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt) op. Nasdaq-testnoteringen, ETFs, warrants, units, rechten, preferente aandelen en notes worden uitgesloten op basis van de directoryvelden en naam; common/ordinary shares en ADR/ADS blijven over. Dit is geen beoordeling van bedrijfskwaliteit. Dubbele tickers worden samengevoegd. Eerst S&P 500-leden, daarna overige Nasdaq-aandelen, binnen beide groepen alfabetisch. De S&P 500-lijst is een publieke dataset; Nasdaq levert zijn eigen directory. Zie [Nasdaq-velddefinities](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs).

Klik **Scan starten** voor 25 aandelen. IBKR levert alleen koersen en IV-historie, met de bestaande wachtrij. Daarna ga je met **Volgende 25 scannen** verder. De pagina toont de dekking van deze ronde en behoudt eerder gevonden matches met hun quote-ophaaltijd. Ontbrekende actuele IV leidt direct tot overslaan, zonder nutteloze historiedownload. Geen koersgrens in IV Scan. De resultaten zijn geen volledige marktscan zolang er aandelen overblijven.

De ronde, cursor en matches staan per Gateway in het Node-procesgeheugen. Stoppen hervat bij het nog niet afgeronde aandeel; na een nieuwe New York-beursdatum, API-herstart of volledige ronde begint de volgende scan een nieuwe ronde. Bij één onbereikbare aandelenlijst wordt uitsluitend de andere bron gebruikt, met waarschuwing; als beide bronnen ontbreken, volgt een fout. In de lokale broncontrole waren 3.726 unieke aandelen beschikbaar; dit aantal kan veranderen. Een tickerlijst bevat geen actuele IV, marktdatarechten blijven nodig.

Voor ieder aandeel berekent de API IV-rank met actuele IBKR-aandelen-IV (generic tick 106 / tick 24) en dagelijkse OPTION_IMPLIED_VOLATILITY over een jaar. Minimaal 200 bruikbare waarnemingen, minimaal 330 dagen dekking en een laatste waarneming van maximaal zeven kalenderdagen oud zijn vereist. Alleen **IV-rank > 40** wordt getoond. IV-rank 40 zelf voldoet niet. Zonder voldoende gegevens wordt een aandeel overgeslagen en gemeld.

IV-rank = `(actuele IV − minimum) / (maximum − minimum) × 100`, begrensd op 0–100. IV-percentile is het percentage historische dagen met strikt lagere IV. Dit zijn verschillende maten. De IV uit de aandelenfeed beschrijft de onderliggende waarde en is niet dezelfde maat als de afzonderlijke IV van een langlopende optie.

De resultaten tonen koers, IV-rank, IV-percentile, IV, universum, quote-ophaaltijd en live/vertraagde/bevroren herkomst. **Toevoegen aan Leaps** is een handmatige keuze en geen automatische beoordeling van bedrijfskwaliteit.

## Leaps

Voeg tickers toe die je bij toewijzing wilt bezitten. Meerdere tickers mogen met komma's, spaties of puntkomma's worden ingevoerd. De shortlist is leeg bij eerste gebruik, bevat maximaal 50 unieke tickers en kan worden gewijzigd met **Toevoegen** en **Verwijderen**. Klik daarna **Scan starten**. De scan gebruikt een kopie van de opgeslagen shortlist; de getoonde gescande tickers maken eventuele oudere resultaten herkenbaar.

De shortlist staat standaard naast `IBKR_SNAPSHOT_PATH` in `leaps-shortlist.json`: bij de bestaande systemd-installatie onder `/var/lib/trading-monitor/`, bij de LAN-launcher onder `source/data/private/`. Optioneel overschrijven met `LEAPS_SHORTLIST_PATH`; gebruik een privémap buiten de webroot. Opslaan gebeurt via een tijdelijk bestand en rename. Updates verwijderen dit bestand niet. Een onleesbaar bestaand bestand geeft een fout en wordt niet stilzwijgend overschreven. Scanresultaten en voortgang staan in het geheugen; na API-herstart blijven de shortlist en overige privédata bestaan, maar moet je opnieuw scannen.

### Criteria

- Alleen jouw handmatige shortlist; geen automatische marktverkenning in Leaps.
- IV-rank > 40 en IV-percentile > 50; 60+ percentile wordt als voorkeur aangegeven.
- Standaard USD-puts met multiplier 100; strike onder de actuele koers.
- Absolute delta inclusief 0,10–0,15.
- Kort: 30–50 DTE; lang: 300–700 DTE, grenzen inclusief, op basis van de New York-kalenderdatum.
- Vergelijk binnen hetzelfde aandeel, bij maximaal 0,02 verschil in absolute delta.
- De lange put moet het **hoogste** jaarlijkse premierendement van de beschikbare vergelijkbare korte puts strikt overtreffen. Gelijkheid voldoet niet. Zonder vergelijkbare korte put is de lange put niet toetsbaar en geen match.

De scan controleert alle door de standaard SMART-keten aangeboden strikes onder de koers en expiraties in deze intervallen. Niet-bestaande expiry/strike-combinaties en contracten zonder volledige quotes of Greeks worden overgeslagen en gemeld. Grote ketens kunnen meerdere minuten of langer kosten. Voortgang en gedeeltelijke kandidaten worden tussentijds bijgewerkt; er loopt maximaal één optiescan tegelijk, inclusief de bestaande CSP-scan. Zonder volledige datadekking kun je alleen de gevonden contracten vergelijken, niet aantonen dat er nergens een betere korte put bestaat.

### Berekeningen en afhandeling

Sinds 0.31.3 toont Leaps drie calculatorvelden volgens het aangeleverde voorbeeld:

- **Decrease to break even** = `(break-even / koers − 1) × 100%`. Een daling wordt negatief weergegeven. Dit is de koersafstand tot break-even bij expiratie, geen grens waaronder tussentijds pas risico ontstaat.
- **Return if expired** = `biedpremie / (strike − biedpremie) × 100%`: maximale premieopbrengst als de put waardeloos afloopt, berekend over strike min premie. Toewijzing of aflopen onder de strike geeft niet automatisch dit rendement.
- **Return annualized** = `Return if expired × 365 / DTE`: lineair geannualiseerd, vóór kosten, zonder rente of samengestelde herbelegging.

De twee bestaande kolommen **Lang per jaar (onderpand)** en **Kort per jaar (onderpand)** blijven rekenen over de volledige strike. De selectieregel en de delta-/looptijdvergelijking veranderen niet door het toevoegen van de calculatorvelden. Gebruik dezelfde kapitaalbasis bij vergelijking. Voor het voorbeeld koers $220,28, strike $200, premie $2,94 en 46 DTE zijn de nieuwe waarden −10,54%, 1,49% en 11,84%. De app gebruikt het eigen bestaande kalender-DTE; de voorbeeldtests gebruiken de getoonde DTE uit de afbeelding.

Premie = `biedprijs × 100`; volledig cashonderpand = `strike × 100`; lineair jaarrendement = `premie / onderpand × 365 / DTE × 100%`. Geen cashrente, samengestelde herbelegging, kosten of belasting in deze vergelijking. Het geannualiseerde korte rendement is een vergelijkingsmaatstaf en geen garantie dat die put steeds opnieuw tegen dezelfde voorwaarden kan worden verkocht.

Break-even bij expiratie = `strike − biedprijs`; koersbuffer = `(1 − break-even / koers) × 100%`. De 50%-exitprijs is de helft van de **getoonde biedpremie per aandeel**. Deze referentie is geen vastgelegde transactieprijs. Na uitvoering gebruik je de werkelijk ontvangen premie om je terugkoopdoel te bepalen.

De strategie neemt ongeveer 50% winst, accepteert toewijzing zolang je het bedrijf wilt bezitten en sluit handmatig met verlies wanneer die overtuiging wezenlijk vervalt. Er zijn geen automatische exits of orders. De tool beoordeelt bedrijfskwaliteit, beschikbare cash, portefeuillelimieten en covered-callkeuzes na toewijzing niet.

## API

De bestaande Node-service op 8787 levert:

- `GET /api/iv-scan` en `POST /api/iv-scan`: status en starten.
- `GET /api/leaps` en `POST /api/leaps`: status en shortlist scannen.
- `GET /api/leaps/shortlist` en `PUT /api/leaps/shortlist`: lezen en opslaan met JSON `{"symbols":["HOOD","NVDA"]}`.

Mutaties vereisen de bestaande toegestane Origin en `X-Requested-With: trading-monitor`. Een tweede verschillende optiescan krijgt HTTP 409. De Node-service gebruikt bestaande `IBKR_HOST`, `IBKR_PORT` en `IBKR_CLIENT_ID`; de nieuwe scanverbinding gebruikt client-ID + 21. De portefeuilleverbinding en bestaande CSP-scanner blijven werken. Voor nieuwe IV- en Leaps-data gebruik je de IBKR-koppeling in de sidebar. Nginx en de FastAPI LAN-host sturen deze routes naar Node.

## Serverupdate via GitHub

Op de bestaande Linux-server, vanuit de repository-root:

```bash
git pull --ff-only
cd source
bash deploy/update-options.sh
```

Het script vereist de reeds bestaande `trading-monitor-api.service` en de bijbehorende `WorkingDirectory` voor deze checkout. Het installeert geen services automatisch. Het voert npm-installatie, regressietests, frontendtests en productiebuild uit, bewaart een webroot-/Nginx-back-up, publiceert frontend, werkt Nginx bij en herstart de bestaande Node-API. Een aanwezige historische Python-service wordt herstart voor de bijgewerkte LAN-proxy; die service is niet nodig voor de nieuwe routes achter Nginx. Bestaande `/var/lib/trading-monitor/`-data blijven bewaard. Open `http://192.168.1.22/#iv` of `#leaps` en vernieuw met Ctrl+F5.

Bij gebruik van `npm run serve:lan`: sluit het bestaande proces, pull de repository, voer `npm ci` vanuit source uit en start `npm run serve:lan` opnieuw. Dat bouwt frontend en start de bijgewerkte APIs. Voor een andere webroot of service-opzet pas je het script aan; zie ook [installatie](installatie.md).

## Lokale validatie

Vanuit `source/`:

```bash
npm test
npm run test:frontend
npm run build
```

API-tests verifiëren shortlistopslaan, validatie, origincontrole, herstart en exclusieve scans. Brokerfixtures verifiëren beide scanmodi en abonnementopruiming zonder echte IBKR-login. Een echte IBKR-optieketen blijft een aparte controle op de geïnstalleerde server.

Browsercontrole met herkenbare testfixtures (geen echte koersdata): installeer tijdelijk `npm install --no-save --package-lock=false playwright`. Start `npm run dev -- --port 5199` en voer in een tweede terminal `npm run test:research` uit. Standaard wordt lokaal geïnstalleerde Edge gebruikt; `PLAYWRIGHT_CHANNEL=chrome` kiest Chrome en `RESEARCH_URL` wijzigt het Vite-adres. De controle test menuvervanging, handmatig toevoegen/verwijderen, shortlistbehoud, matching, filters, foutmeldingen en 360/768/1024/1440px. Screenshots staan in de genegeerde `source/data/private/research-validation/`.
