# Versiehistorie

## 0.17.0 – meerjarig portefeuilleverloop

- Stats toont het werkelijke portefeuillesaldo per maandeinde over alle beschikbare Flex-jaren.
- Met 2024, 2025, 2026 en Alles kan de grafiek onafhankelijk van de trade-analyse worden gefilterd.
- De kerncijfers en alle handelsgrafieken blijven vast gebaseerd op 2026; ook het portefeuilleverloop opent standaard op 2026.
- Beginwaarde, eindwaarde, dollarverschil en procentuele verandering geven directe context bij de lijn.
- Benchmarklijnen worden pas geactiveerd wanneer een betrouwbare koersbron beschikbaar is; er worden geen voorbeeldgegevens als echte prestaties getoond.

## 0.16.0 – historisch doelresultaat 2025

- Goals toont 2025 als afgesloten jaar met het werkelijke startsaldo uit 2024, het berekende doel en het gerealiseerde resultaat.
- De jaarlijkse geplande inleg is gecorrigeerd naar `$ 12.000` en wordt consequent toegepast op 2025, 2026 en de meerjarenplanning.
- Afgesloten, actuele en toekomstige jaren zijn visueel en semantisch van elkaar onderscheiden.
- Gecombineerde synthetische optielegs zijn op de Options-pagina herkenbaar aan een samenvoegicoon, strategie-accent en gekoppelde rijkleur.

## 0.15.0 – statistiekenpagina

- Stats is als menuoptie tussen Goals en Trades toegevoegd.
- Een jaarkeuze schakelt alle analyses tussen 2025 en 2026.
- Zes kerncijfers tonen trades, winratio, nettoresultaat, gemiddeld resultaat, profit factor en gemiddelde looptijd.
- Grafieken tonen maandresultaten, winst/verliesverdeling, resultaatimpact per onderliggende waarde en de verdeling van de aanhoudduur.

## 0.14.2 – navigatievolgorde

- Het hoofdmenu staat nu in de volgorde Dashboard, Stocks, Options, Goals en Trades.

## 0.14.1 – saldo-opmaak

- De primaire saldowaarde is vergroot voor een duidelijkere visuele hiërarchie en betere benutting van de kaart.

## 0.14.0 – dagelijkse winst en verlies

- Tussen Saldo en Portefeuilleverdeling staat een afzonderlijke kaart voor Dagelijkse W&V.
- De kaart toont het dagresultaat in dollars en als percentage van het saldo van de vorige handelsdag.
- Positieve, negatieve en ongewijzigde dagresultaten gebruiken dezelfde semantische statusweergave als de rest van het dashboard.
- De kleine dubbele dagwaarde is uit het midden van de portefeuilledonut verwijderd.

## 0.13.0 – meerjarige trades en jaarreferentie

- De importer leest meerdere jaarbestanden per Flex-brontype en voorkomt dubbeltellingen van overlappende saldodagen en IBKR-executies.
- De trades uit 2025 zijn toegevoegd naast 2026; de Trades-pagina heeft een jaarkeuze en eigen samenvatting en paginering per jaar.
- Jaarverloop toont de maandbedragen van 2025 als grijze referentiebalken achter de lijn van 2026.
- De meerjarige import is gecontroleerd met 453 unieke saldodagen, 1.430 uitvoeringen en 390 afgesloten optiecycli.

## 0.12.0 – afgesloten trades

- Trades is als laatste navigatieoptie toegevoegd.
- Alle afgesloten optiecycli worden van nieuw naar oud getoond met maximaal 50 regels per pagina.
- Per trade zijn positie, strike, openings- en sluitingsdatum, aanhoudduur, openingspremie en nettoresultaat zichtbaar.
- Trade-rendement en lineair geannualiseerd rendement worden afzonderlijk getoond en uitgelegd.
- Oudere trades zonder opening in het Flex-bereik blijven zichtbaar zonder ontbrekende percentages te schatten.

## 0.11.0 – jaarlijkse doelen

- Goals is als derde navigatieoptie toegevoegd tussen Options en Stocks.
- Het jaardoel gebruikt de werkelijke eindstand van het voorgaande jaar, 30% rendementsdoel en `$ 1.200` jaarlijkse inleg.
- De pagina toont actueel saldo, resterend doelbedrag, lineaire voortgang en voor- of achterstand op het jaarschema.
- Een vijfjarenplanning rekent toekomstige startsaldi, rendement, inleg en doelen door.
- Een echte nieuwe jaarafsluiting vervangt automatisch het eerder geplande startsaldo.

## 0.10.0 – open optieposities

- Een afzonderlijke Options-pagina en navigatieoptie tonen alle open optiecontracten.
- Per positie zijn strategie, call/put, long/short, aantal, strike, expiratie, gekozen DTE, resterende dagen en openingspremie beschikbaar.
- Live IBKR-data vult huidige prijs, marktwaarde en ongerealiseerd winst/verlies aan.
- Synthetische long- en shortcombinaties worden op basis van onderliggende waarde, strike en expiratie als `SYNT` herkend.
- Korte resterende looptijden krijgen een zichtbare waarschuwing zonder uitsluitend op kleur te vertrouwen.

## 0.9.0 – dagelijkse koersbeweging

- De Stocks-tabel toont als laatste kolom de procentuele koersverandering ten opzichte van de vorige slotkoers.
- Positieve dagbewegingen zijn groen, negatieve rood en een ongewijzigde koers wordt expliciet als `0,0%` getoond.
- De read-only IBKR-refresh haalt de vorige slotkoers via live of beschikbare vertraagde marktdata op.
- Ontbrekende slotkoersen worden als niet beschikbaar getoond en niet als een onjuiste nulwaarde.

## 0.8.1 – uitgelijnd dashboardraster

- Saldo en portefeuilleverdeling vullen samen dezelfde breedte als Jaarverloop in een rustige 40/60-verdeling.
- Resultaat- en handelskaarten verdelen de volledige beschikbare rij gelijkmatig.
- Middelbrede en compacte schermen laten geen lege laatste kaartpositie meer achter.

## 0.8.0 – covered-call-dekking

- De Stocks-tabel toont per aandeel hoeveel open short calls tegenover volledige pakketten van 100 aandelen staan.
- Volledige dekking wordt groen getoond; ontbrekende, gedeeltelijke en overmatige dekking worden rood en met tekst gemarkeerd.
- Puts, gekochte calls en opties op andere symbolen tellen niet mee als covered call.

## 0.7.0 – read-only IBKR-koppeling

- Linksonder is een toegankelijke IBKR-status- en refreshbediening toegevoegd.
- De backend kan via een vaste systemd-service IBC en IB Gateway starten.
- IB Key MFA wordt door de gebruiker in IBKR Mobile bevestigd.
- Actuele netto liquidatiewaarde, posities, marktprijzen en ongerealiseerde winst/verlies worden read-only opgehaald.
- Nginx geeft `/api/` uitsluitend door aan de backend op localhost.
- Systemd-, Xvfb-, sudoers- en omgevingsconfiguraties zijn toegevoegd.

## 0.6.2 – productie op webroot

- De productiebuild gebruikt expliciet `/` als basispad.
- Een Nginx-configuratie voor de standaard webroot op poort 80 is toegevoegd.
- De installatiehandleiding beschrijft bouwen, installeren en veilig bijwerken op Linux.
- Financiële JSON-data en `index.html` worden niet gecachet; gehashte assets wel.

## 0.6.1 – netto portefeuillewaarden

- De premiekaarten tonen netto premie als hoofdwaarde; ontvangen premie, terugkoop en commissie blijven zichtbaar als controleerbare uitsplitsing.
- De resultaatkaarten benoemen expliciet dat zij de mutatie van de netto liquidatiewaarde tonen.
- Het aandelenoverzicht onderscheidt nettokostprijs, actuele netto positiewaarde en aandelenwinst/-verlies.
- Commissies op aandelenaankopen worden in de resterende FIFO-kostprijs verwerkt.
- Actuele positiewaarde en ongerealiseerd resultaat blijven leeg totdat actuele IBKR-koersen beschikbaar zijn.

## 0.6.0 — 26 september 2026

- Tweede navigatiepagina `Stocks` toegevoegd.
- Open aandelenposities met aantallen, FIFO-aankoopprijs en aankoopwaarde uit Flex-trades berekend.
- Kolommen voor huidige prijs, huidige waarde en verschil voorbereid op de toekomstige IBKR-koppeling.
- Responsieve, horizontaal begrensde aandelentabel en lege toestand toegevoegd.

## 0.5.2 — 26 september 2026

- Positieve resultaten en opbrengsten consequent groen weergegeven.
- Negatieve resultaten, terugkoop en commissie consequent rood met minteken weergegeven.

## 0.5.1 — 26 september 2026

- Tekst, kaarthoogtes en tussenruimtes compacter gemaakt.
- Brede statistiekkolommen begrensd zodat ze niet langer over het volledige scherm uitrekken.
- Navigatie en paginamarges verkleind voor evenwichtigere dashboardverhoudingen.

## 0.5.0 — 26 september 2026

- Donutgrafiek met aandelen, opties en geld/overig naast het saldo toegevoegd.
- Dagrendement in het midden van de verdelingsgrafiek toegevoegd.
- Indicatieve allocatie uit open aandelenkostprijs en de laatste Flex-saldowaarden berekend.

## 0.4.0 — 26 september 2026

- Alle dashboardstatistieken in compacte, gelijkmatige kaarten geplaatst.
- Gecentreerde titel, waarde en toelichting met een semantische linker accentlijn.
- Responsieve indeling met vijf, twee of één kaart per rij, afhankelijk van de beschikbare breedte.

## 0.3.1 — 26 september 2026

- Saldo, winst, jaargrafiek en optiepremies consequent als dollars weergegeven.
- Compact `$`-teken gebruikt voor alle geldbedragen.

## 0.3.0 — 26 september 2026

- Blokken toegevoegd voor totaal trades, gesloten/open trades en gemiddelde aanhoudduur.
- Premiebehoud en ontvangen brutopremie voor het jaar toegevoegd.
- Ontvangen premie, terugkoop, commissie en netto toegevoegd voor de huidige en vorige maand.
- Bestaande statistiekblokken compacter gemaakt voor de uitgebreidere dashboardindeling.

## 0.2.2 — 26 september 2026

- Bovenlabel `Portfolio-overzicht` uit de dashboardkop verwijderd.
- Toelichtingszin onder de dashboardtitel verwijderd.

## 0.2.1 — 26 september 2026

- Samenvattingsbalk met beste en laagste maand verwijderd.
- Uitklapbare tabel met exacte maandbedragen verwijderd.

## 0.2.0 — 26 september 2026

- Lijngrafiek met saldoverandering per maand voor het volledige kalenderjaar.
- Positieve, negatieve en nog ontbrekende maandgegevens visueel onderscheiden.

## 0.1.0 — 26 september 2026

- Eerste lokaal werkende dashboardopzet.
- Donkere responsieve navigatie met Trading Monitor-logo.
- Saldo, winst 2026, huidige maand, vorige maand en gemiddeld per maand.
- Lokale, privacybewuste import van IBKR Flex XML-rapporten.
