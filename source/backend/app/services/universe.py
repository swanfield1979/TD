import csv
import io
import re


def parse_universe(text: str):
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if not {"symbol", "exchange", "currency"}.issubset(reader.fieldnames or []):
        raise ValueError(
            "CSV vereist symbol, exchange en currency; company en sector zijn optioneel."
        )
    rows, seen = [], set()
    for number, row in enumerate(reader, 2):
        if number > 5001:
            raise ValueError("Maximaal 5000 aandelen per universum.")
        symbol, exchange, currency = (
            str(row.get(k) or "").strip().upper()
            for k in ["symbol", "exchange", "currency"]
        )
        if (
            not re.fullmatch(r"[A-Z0-9][A-Z0-9. -]{0,19}", symbol)
            or not re.fullmatch(r"[A-Z0-9._-]{1,30}", exchange)
            or not re.fullmatch(r"[A-Z]{3}", currency)
        ):
            raise ValueError(f"Ongeldige ticker, beurs of valuta op regel {number}.")
        key = (symbol, exchange, currency)
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            dict(
                symbol=symbol,
                exchange=exchange,
                currency=currency,
                company=(row.get("company") or row.get("company_name") or "").strip()[
                    :250
                ],
                sector=(row.get("sector") or "").strip()[:100],
            )
        )
    if not rows:
        raise ValueError("CSV bevat geen aandelen.")
    return rows
