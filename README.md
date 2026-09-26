# Trading Monitor

Lokaal portfolio-dashboard voor het volgen van saldo, handelsresultaten en voortgang op basis van Interactive Brokers Flex-rapporten.

**Versie/status:** 0.3.1, lokaal dashboard gebaseerd op Flex-data tot en met 24 september 2026. Een rechtstreekse IBKR-koppeling volgt later.

| Map | Inhoud |
| --- | --- |
| [`source/`](source/) | React/TypeScript-broncode, importscript en ontwikkelcommando's |
| [`release/`](release/) | Uit te leveren distributies; momenteel nog leeg |
| [`docs/`](docs/) | Installatie, gebruik, architectuur en validatie |

## Starten

Zie [`docs/installatie.md`](docs/installatie.md) voor de installatie en [`source/README.md`](source/README.md) voor alle ontwikkelcommando's.

## Functies

- Donker, responsief dashboard met het Trading Monitor-logo.
- Saldo en winststatistieken uit lokale IBKR Flex XML-rapporten.
- Optietrades, premiebehoud, gemiddelde looptijd en ontvangen maandpremies.
- Positieve en negatieve resultaten met tekst, pictogram en kleur.
- Lokale verwerking: de ruwe financiële bestanden worden niet aan Git toegevoegd.

## Documentatie

- [Installatie](docs/installatie.md)
- [Gebruik en berekeningen](docs/gebruik.md)
- [Architectuur](docs/architectuur.md)
- [Validatie](docs/validatie.md)
- [Versiehistorie](docs/versiehistorie.md)
