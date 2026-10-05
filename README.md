# Trading Monitor

Lokaal portfolio-dashboard voor het volgen van saldo, handelsresultaten en voortgang op basis van Interactive Brokers Flex-rapporten.

**Versie/status:** 0.26.0. Synchroniseren werkt nu alle beschikbare actuele IBKR-data bij, inclusief de kalendermaand, maand- en jaarresultaten, premie, aandelenresultaat, saldohistorie, handelsstatistieken en doelen. Productiebuild en tests zijn lokaal gecontroleerd; deze versie is nog niet op de liveserver geïnstalleerd.

| Map | Inhoud |
| --- | --- |
| [`source/`](source/) | React/TypeScript-broncode, importscript en ontwikkelcommando's |
| [`release/`](release/) | Uit te leveren distributies; momenteel nog leeg |
| [`docs/`](docs/) | Installatie, gebruik, architectuur en validatie |

## Starten

Zie [bijwerken via PuTTY](docs/installatie.md#volledige-synchronisatie-bijwerken-versie-0260) voor het installeren van 0.26.0. Publiceer frontend en backend samen en herstart de API-service.

Zie [`docs/installatie.md`](docs/installatie.md) voor de installatie en [`source/README.md`](source/README.md) voor alle ontwikkelcommando's.

## Functies

- Licht, responsief dashboard met groene accenten, herkenbare Trading Monitor-navigatie en IBKR-status.
- Totale winst sinds start 2025 gecorrigeerd voor netto inleg, met winstpercentage over ingebracht kapitaal en huidig (live) saldo.
- Saldo en nettoresultaatstatistieken uit lokale IBKR Flex XML-rapporten.
- Saldoverandering volgt het actuele IBKR-saldo, in dollars en procenten tegenover de vorige beschikbare dagstand, met zichtbare vergelijkingsdatum.
- Maand- en jaarresultaat uitsluitend uit gerealiseerde short-optiepremie en aandelenverkopen; FIFO-kosten en commissies tellen mee op de sluitingsdatum.
- Portefeuilleverdeling voor aandelen, opties inclusief gereserveerd CSP-bedrag en vrij geld/overig.
- Stocks-pagina met open aandelen, covered-call-dekking, nettokostprijs, actuele nettowaarde, winst/verlies en procentuele koersbeweging van vandaag.
- Options-pagina met open contracten, long/short-richting, strategie, strike, expiratie, gekozen DTE, resterende dagen, CSP-reservering, vrij te besteden bedrag en actueel winst/verlies.
- Jaarlijkse stortingsimport, met geplande Inleg en werkelijk Ingelegd naast elkaar in Goals.
- Goals-pagina met historische jaarresultaten, een jaarlijks doel van 30% rendement boven op de vorige jaarafsluiting, $ 12.000 inleg, voortgang ten opzichte van het jaarschema en een vijfjarenplanning.
- Stats-pagina met analyse per jaar, standaard op 2026, meerjarig portefeuilleverloop, kerncijfers, maandresultaten, winst/verliesverdeling, resultaat per onderliggende waarde en verdeling van de aanhoudduur.
- Trades-pagina met jaarkeuze 2025/2026, afgesloten optieposities, nettoresultaat, trade-rendement, lineair geannualiseerd rendement en paginering van maximaal 50 regels.
- Gateway-gegevens worden elke minuut opgehaald en lokaal bewaard; **Vernieuwen** werkt saldo, posities, trades en alle daarvan afleidbare dashboardcijfers samen bij.
- Portefeuilleverloop met jaarkeuze, maandeindsaldi en grijze referentiebalken voor het voorgaande kalenderjaar.
- Netto maandgrafiek op basis van gerealiseerde short-optiepremie en aandelenverkopen, inclusief kosten; jaardoel met saldovoortgang en jaarschema.
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
