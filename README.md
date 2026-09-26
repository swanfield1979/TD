# Trading Monitor

Lokaal portfolio-dashboard voor het volgen van saldo, handelsresultaten en voortgang op basis van Interactive Brokers Flex-rapporten.

**Versie/status:** 0.6.2, lokaal dashboard met Dashboard- en Stocks-pagina en een Nginx-productieconfiguratie voor de webroot op poort 80. De data is gebaseerd op Flex-rapporten tot en met 24 september 2026; een rechtstreekse IBKR-koppeling volgt later.

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
- Indicatieve portefeuilleverdeling voor aandelen, opties en geld/overig.
- Stocks-pagina met open aandelen, nettokostprijs en aparte actuele nettowaarde en winst/verlies zodra koersen beschikbaar zijn.
- Optietrades, premiebehoud, gemiddelde looptijd en netto maandpremies.
- Positieve en negatieve resultaten met tekst, pictogram en kleur.
- Lokale verwerking: de ruwe financiële bestanden worden niet aan Git toegevoegd.

## Documentatie

- [Installatie](docs/installatie.md)
- [Gebruik en berekeningen](docs/gebruik.md)
- [Architectuur](docs/architectuur.md)
- [Validatie](docs/validatie.md)
- [Versiehistorie](docs/versiehistorie.md)
