# Gebruik en berekeningen

Het dashboard toont vijf bedragen uit `flex_net_liq_into_db.xml`:

- **Saldo:** het laatste beschikbare totaal van `EquitySummaryByReportDateInBase`.
- **Winst 2026:** laatste saldo minus het startsaldo van 2026. Waar aanwezig wordt 31 december 2025 als nulmeting gebruikt.
- **Winst deze maand:** laatste saldo minus het laatste beschikbare saldo vóór de eerste dag van de huidige rapportmaand.
- **Winst vorige maand:** eindsaldo van de vorige maand minus het eindsaldo van de maand daarvoor.
- **Gemiddeld per maand:** winst 2026 gedeeld door het aantal verstreken kalendermaanden, inclusief de lopende maand.

## Jaarverloop

De lijngrafiek toont voor alle twaalf kalendermaanden het verschil tussen het laatste beschikbare saldo van een maand en het laatste saldo van de voorgaande maand. De lijn verbindt alleen beschikbare maandresultaten. Toekomstige maanden blijven op de tijdas staan met de status `Nog geen data`.

Een positief bedrag krijgt het label `Positief` en een groen accent. Een negatief bedrag krijgt `Negatief` en een rood accent. De tekst en pijliconen zorgen dat betekenis niet alleen via kleur wordt overgebracht.

## Data verversen

Vervang de XML-bestanden in `source/data/private/` en voer vanuit `source/` opnieuw uit:

```powershell
npm run import:flex
```

Herlaad daarna het dashboard.

## Aandachtspunt

De eerste versie behandelt veranderingen in netto liquidatiewaarde als winst of verlies, precies volgens de gekozen definitie. Stortingen, opnames en valutabewegingen kunnen die uitkomst beïnvloeden. Een latere versie kan deze kasstromen apart corrigeren.
