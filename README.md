# Trading Monitor

Lokaal portfolio-dashboard voor het volgen van saldo, handelsresultaten en voortgang op basis van Interactive Brokers Flex-rapporten.

**Versie/status:** 0.8.1, intern dashboard met een strak uitgelijnd overzichtsraster, covered-call-dekking per aandelenpositie, Nginx-hosting op poort 80 en een read-only IBKR Gateway-koppeling met mobiele IB Key MFA.

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
- Stocks-pagina met open aandelen, covered-call-dekking, nettokostprijs en aparte actuele nettowaarde en winst/verlies.
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
