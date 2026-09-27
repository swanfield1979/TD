# Inleg en rendement

## Berekeningen

- **Netto inleg / Ingelegd:** stortingen min opnames, in de basisvaluta van het dashboard (USD).
- **Totale winst sinds 2025:** huidig saldo − startsaldo op 31 december 2024 − netto inleg vanaf 2025. Inleg uit 2024 zit al in het startsaldo en wordt niet opnieuw afgetrokken.
- **Winstpercentage:** winst / (startsaldo + netto inleg) × 100. Dit is eenvoudig totaalrendement, niet tijdgewogen en niet geannualiseerd. Bij een nul- of negatieve noemer wordt geen percentage getoond.
- **Jaarwinst in Goals:** eind- of actueel saldo − startsaldo van het jaar − werkelijke netto jaarinleg. Het jaarpercentage gebruikt dezelfde formule als Totale winst.

Deze saldo-gebaseerde winst bevat open posities en verschilt van de uitsluitend gerealiseerde nettoresultaatkaarten op het Dashboard. Stortingen veranderen die gerealiseerde handelsresultaten niet.

## Doel en verwachting

**Inleg** is de geplande jaarlijkse $ 12.000. **Ingelegd** is de werkelijke netto inleg uit het jaarlijkse Cash Report, met peildatum. Toekomstige jaren tonen een streepje voor werkelijke inleg.

Het saldojaardoel is start + 30% van start + geplande inleg. Als werkelijk netto ingelegd méér is dan gepland, vervangt het werkelijke bedrag de geplande inleg in de verwachting. Deze hogere verwachting werkt door in toekomstige geplande startsaldi.

De voortgang vergelijkt winst na inlegcorrectie met het rendementsdoel. Voor/achter op schema vergelijkt die winst met het verstreken deel van het jaarlijkse rendementsdoel. Winst nodig per maand verdeelt de resterende benodigde winst over de nog volledige kalendermaanden. Nog in te leggen toont apart het resterende bedrag van de inlegplanning. De voortgangsbalk begrenst negatieve voortgang op nul; het verlies blijft afzonderlijk zichtbaar.

## Import

Plaats jaarlijkse exports als `Storting_2024.xml`, `Storting_2025.xml` enzovoort in `source/data/private/`. Voer vanuit `source/` opnieuw `npm run import:flex` en daarna `npm run build` uit. Deze exports en de gegenereerde data blijven buiten Git.

De aangeleverde exports bevatten geen transactiedatums, transactie-ID's of wisselkoersen. Daarom wordt uitsluitend per jaar gerekend. Het Cash Report bevat eerst het geconsolideerde basistotaal en daarna valutauitsplitsingen: die regels worden nooit bij elkaar opgeteld. In deze export ontbreekt ook het valutalabel van de Cash Report-regels; de eerste rij wordt volgens de IBKR-rapportvolgorde als basistotaal behandeld in de ingestelde dashboardvaluta USD. Deze afgeleide valutatoewijzing staat als `currencyInferred` in de samenvatting. Zie de [IBKR Cash Report-definitie](https://www.ibkrguides.com/reportingreference/reportguide/cash%20reportfq.htm).

CashTransaction-regels worden daarnaast per oorspronkelijke valuta als stortingen, opnames en netto bedrag bewaard. Gelijke bedragen zijn afzonderlijke transacties en worden niet weggedupliceerd. Dubbele jaarrapporten tellen één keer; een uitgebreider cumulatief rapport vanaf dezelfde begindatum vervangt een korter rapport. Tegenstrijdige of verschillend beginnende rapporten worden geweigerd. Jaarbedragen worden naar centen afgerond vóór optelling, zodat zichtbare bedragen op elkaar aansluiten.

Voor Totale winst zijn volledige jaarperioden sinds het startsaldo nodig. Bij ontbrekende historie wordt geen ongecorrigeerd rendement getoond. De huidige kasstroomperiode en saldodag kunnen verschillen: de kaart toont dan ≈ en beide peildatums zijn zichtbaar. De jaarwinst in Goals is in dat geval eveneens voorlopig. Een live saldo-update neemt geen nieuwe stortingen automatisch over; vernieuw daarvoor ook het Cash Report.

Voor precieze dagrendementen of tijdgewogen rendement moet een nieuwe export ook transactiedatum, valuta, bedrag, FXRateToBase en transactionID bevatten. Ontbrekende datums of wisselkoersen worden niet verzonnen.
