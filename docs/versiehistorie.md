# Versiehistorie

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
