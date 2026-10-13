# Trading Monitor

Lokaal portfolio-dashboard voor het volgen van saldo, handelsresultaten en voortgang op basis van Interactive Brokers Flex-rapporten.

**Versie/status:** 0.31.5. Breakout in de webapp vervangen door IV Scan (IV-rank > 40) en Leaps met een handmatige, op de server opgeslagen shortlist. Vergelijking van 30–50 met 300–700 DTE en circa 50%-winstexit. IV Scan gebruikt aandelenlijsten zonder IBKR-marktscanner, met 25 aandelen per klik en zichtbare dekking. Rustige IBKR-wachtrij, IV-historiecache en Scan stoppen. Laatste scans en IV-voortgang blijven bewaard na een API-herstart. IV Scan heeft IV-ranksortering en prijsfilters. Tests, productiebuild en browserworkflow met testdata geslaagd; echte IBKR-marktdata en serverupdate nog niet bevestigd.

| Map | Inhoud |
| --- | --- |
| [`source/`](source/) | React/TypeScript, Python/FastAPI, importscript en ontwikkelcommando's |
| [`release/`](release/) | Distributies en release-informatie |
| [`docs/`](docs/) | Installatie, gebruik, architectuur en validatie |

## Starten

Ontwikkeling: `npm run dev:lan`; productie: `npm run serve:lan`, vanuit source na dependency-installatie. Zie [LAN-handleiding](docs/breakout-lan.md). Optionele systemd-service wordt handmatig geïnstalleerd.


Zie [IV Scan / Leaps-serverupdate 0.31.5](docs/iv-leaps.md#serverupdate-via-github): publiceer frontend en API samen en herstart de services. Een nieuwe Flex-import is voor deze uitbreiding niet vereist.

Zie [`docs/installatie.md`](docs/installatie.md) voor de installatie en [`source/README.md`](source/README.md) voor alle ontwikkelcommando's.

## Historische breakoutscanner

Deze functie is vervallen in de webappnavigatie; bestaande broncode en historie blijven bewaard. Gebruik [IV Scan en Leaps](docs/iv-leaps.md) voor de actuele optiescan. Onderstaande informatie beschrijft de oudere scanner.

De scanner zoekt leiders op cross-sectionele 21/63/126-sessierendementen en beoordeelt impuls, consolidatie en range-expansie. React/TypeScript en Lightweight Charts tonen een sorteerbare tabel en candlestickdetails; FastAPI, SQLAlchemy/SQLite en een read-only IBKR-adapter verzorgen API, analyse en incrementele cache. Dit is een educatief onderzoeksinstrument, geen financieel advies.

Installeer Node 22.12+/24/26+ en Python 3.12+ en voer vanuit source uit:

```bash
npm ci
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
cp .env.example .env
npm run serve:lan
```

Productie opent op http://localhost:8000/#iv; de launcher print het LAN-IP. Ontwikkeling: `npm run dev:lan`. Expliciete testdemo: `npm run dev:demo`. Zonder broker blijft bestaande historie zichtbaar als Cached met exact timestamp. Er worden geen orders uitgevoerd.

Installeer en configureer TWS of IB Gateway handmatig voor paper en read-only API volgens [IBKR.md](docs/IBKR.md); daar staan ook subscriptions, reconnect, pacing en veelvoorkomende verbindingsfouten. Importeer CSV met symbol, exchange, currency en optioneel company_name/sector. De [voorbeeldlijst](source/data/example-universe.csv) is geen volledig marktuniversum. De scanner cachet contract-ID's en bars en vraagt bij volgende syncs alleen ontbrekende dagen met beperkte overlap op. Mislukte requests behouden bestaande data.

[SETUP_LOGIC.md](docs/SETUP_LOGIC.md) verklaart ieder criterium en corporate-actionbeleid. [DEPLOYMENT.md](docs/DEPLOYMENT.md) bevat Linux/Windows-installatie, tests, LAN-hosting en de GitHub-serverupdate. Tests vanuit source: `backend/.venv/bin/python -m pytest backend/tests -q`, `npm run test:frontend`, `npm test`; na starten van dev:demo voert `npm run test:e2e` de browserworkflow uit. De productiebuild gebruikt `npm run build`.

## Functies

- [IV Scan](docs/iv-leaps.md): NASDAQ-/S&P 500-marktshortlist met IV-rank boven 40.
- [Leaps](docs/iv-leaps.md): handmatig gekozen aandelen, putvergelijking bij vergelijkbare delta, jaarlijks premierendement, break-even en 50%-exitprijs.


- Donkere modus als standaard, met onthouden donker/licht-keuze, responsieve navigatie en IBKR-status.
- Scans: CSP’s op bestaande onderliggende portfoliowaarden eerst, daarnaast een NASDAQ/S&P 500-shortlist van $ 10–$ 50; sorteren op jaarrendement, rendement of premie. Zie [CSP-scans](docs/scans.md) voor criteria, datavereisten en dekking.
- Totale winst sinds start 2025 gecorrigeerd voor netto inleg, met winstpercentage over ingebracht kapitaal en huidig (live) saldo.
- Saldo en nettoresultaatstatistieken uit lokale IBKR Flex XML-rapporten.
- Saldoverandering volgt het actuele IBKR-saldo, in dollars en procenten tegenover de vorige beschikbare dagstand, met zichtbare vergelijkingsdatum.
- Maand- en jaarresultaat uit alle gerealiseerde long- en short-opties en aandelenverkopen; FIFO-kosten en commissies tellen mee op de sluitingsdatum.
- Portefeuilleverdeling voor aandelen, opties inclusief gereserveerd CSP-bedrag en vrij geld/overig.
- Stocks-pagina met open aandelen, covered-call-dekking, nettokostprijs, actuele nettowaarde, winst/verlies en procentuele koersbeweging van vandaag.
- Options-pagina met open contracten, long/short-richting, strategie, strike, expiratie, gekozen DTE, resterende dagen, CSP-reservering, vrij te besteden bedrag en actueel winst/verlies.
- Jaarlijkse stortingsimport, met geplande Inleg en werkelijk Ingelegd naast elkaar in Goals.
- Goals-pagina met historische jaarresultaten, een jaarlijks doel van 30% rendement boven op de vorige jaarafsluiting, $ 12.000 inleg, voortgang ten opzichte van het jaarschema en een vijfjarenplanning.
- Stats-pagina met analyse per jaar, standaard op 2026, meerjarig portefeuilleverloop, kerncijfers, maandresultaten, winst/verliesverdeling, resultaat per onderliggende waarde en verdeling van de aanhoudduur.
- Trades-pagina met jaarkeuze 2025/2026, afgesloten optieposities, nettoresultaat, trade-rendement, lineair geannualiseerd rendement en paginering van maximaal 50 regels.
- Gateway-gegevens worden elke minuut opgehaald en lokaal bewaard; **Vernieuwen** werkt saldo, posities, trades en alle daarvan afleidbare dashboardcijfers samen bij.
- Uurlijkse verbindingscontrole van 04:00 t/m 16:00 New York-tijd, inclusief pre-market, met automatische zomertijd en uitsluiting van gepubliceerde NYSE-feestdagen.
- Portefeuilleverloop met jaarkeuze, maandeindsaldi en grijze referentiebalken voor het voorgaande kalenderjaar.
- Netto maandgrafiek op basis van gerealiseerde long- en short-opties en aandelenverkopen, inclusief kosten; jaardoel met saldovoortgang en jaarschema.
- Aanvullende maanddetails en handelsstatistieken onder de grafieken, zonder afzonderlijke dubbele netto-premiekaarten.
- Optietrades, premiebehoud, gemiddelde looptijd en netto maandpremies.
- Positieve en negatieve resultaten met tekst, pictogram en kleur.
- Lokale verwerking: de ruwe financiële bestanden worden niet aan Git toegevoegd.
- Read-only live-update van saldo en posities via IBC, IB Gateway en IBKR Mobile MFA.

## Documentatie

- [Installatie](docs/installatie.md)
- [Gebruik en berekeningen](docs/gebruik.md)
- [Architectuur](docs/architectuur.md)
- [Validatie](docs/validatie.md)
- [Versiehistorie](docs/versiehistorie.md)
