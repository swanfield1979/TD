# Trading Monitor

Lokaal portfolio-dashboard voor het volgen van saldo, handelsresultaten en voortgang op basis van Interactive Brokers Flex-rapporten.

**Versie/status:** 0.15.0, intern dashboard met meerjarige Flex-import, dagelijkse winst/verlies in dollars en procenten, afzonderlijke Stocks-, Options-, Goals-, Stats- en Trades-overzichten, automatische strategieherkenning, jaarlijkse doelplanning, Nginx-hosting op poort 80 en een read-only IBKR Gateway-koppeling met mobiele IB Key MFA.

| Map | Inhoud |
| --- | --- |
| [`source/`](source/) | React/TypeScript-broncode, importscript en ontwikkelcommando's |
| [`release/`](release/) | Uit te leveren distributies; momenteel nog leeg |
| [`docs/`](docs/) | Installatie, gebruik, architectuur en validatie |

## Starten

Zie [`docs/installatie.md`](docs/installatie.md) voor de installatie en [`source/README.md`](source/README.md) voor alle ontwikkelcommando's.

## Functies

- Donker, responsief dashboard met het Trading Monitor-logo.
- Saldo en nettoresultaatstatistieken uit lokale IBKR Flex XML-rapporten.
- Afzonderlijke kaart voor dagelijkse winst/verlies in dollars en als percentage van de vorige handelsdag.
- Indicatieve portefeuilleverdeling voor aandelen, opties en geld/overig.
- Stocks-pagina met open aandelen, covered-call-dekking, nettokostprijs, actuele nettowaarde, winst/verlies en procentuele koersbeweging van vandaag.
- Options-pagina met open contracten, long/short-richting, strategie, strike, expiratie, gekozen DTE, resterende dagen en actueel winst/verlies.
- Goals-pagina met een jaarlijks doel van 30% rendement boven op de vorige jaarafsluiting, $ 1.200 inleg, voortgang ten opzichte van het jaarschema en een vijfjarenplanning.
- Stats-pagina met jaarkeuze, kerncijfers, maandresultaten, winst/verliesverdeling, resultaat per onderliggende waarde en verdeling van de aanhoudduur.
- Trades-pagina met jaarkeuze 2025/2026, afgesloten optiecycli, nettoresultaat, trade-rendement, lineair geannualiseerd rendement en paginering van maximaal 50 regels.
- Jaarverloop met de actuele jaarlijn en grijze referentiebalken voor het voorgaande kalenderjaar.
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
