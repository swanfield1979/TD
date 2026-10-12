"""Pure analysis: completed, ordered daily bars in; diagnostics out. No broker/HTTP I/O."""

from math import ceil
from statistics import fmean

from ..schemas.scanner import AnalysisConfig, DailyBar


def pct(a, b):
    return (a / b - 1) * 100


def ratio(a, b):
    return a / b if b > 0 else None


def higher_lows(base, radius, tolerance):
    """Confirmed pivots only; the supplied base excludes the breakout candle."""
    lows = [
        b["low"]
        for i, b in enumerate(base)
        if radius <= i < len(base) - radius
        and all(x["low"] >= b["low"] for x in base[i - radius : i + radius + 1])
    ]
    return (
        all(v >= lows[i - 1] * (1 - tolerance / 100) for i, v in enumerate(lows) if i)
        if len(lows) >= 2
        else None
    )


def analyze(symbol, input_bars, config=None):
    c = config or AnalysisConfig()
    bars = [
        DailyBar.model_validate(b).model_dump(mode="json")
        for b in sorted(input_bars, key=lambda b: b["date"])
    ]
    if len({b["date"] for b in bars}) != len(bars):
        raise ValueError("Dubbele handelsdatum.")
    n, last = len(bars), bars[-1] if bars else None
    required = (
        max(*c.periods, 50 + c.slopeSessions, c.moveMaxSessions + c.baseMinSessions) + 1
    )
    result = dict(
        symbol=symbol,
        asOf=last["date"] if last else None,
        close=last["close"] if last else None,
        sessions=n,
        returns=[
            pct(last["close"], bars[n - 1 - p]["close"]) if n > p else None
            for p in c.periods
        ],
        status="insufficient_data",
        reasons=[],
        move=None,
        base=None,
        indicators=None,
        chart=bars[-150:],
    )
    result["averageDollarVolume"] = (
        fmean(b["close"] * b["volume"] for b in bars[-20:])
        if n >= 20 and all(b["volume"] is not None for b in bars[-20:])
        else None
    )
    if n < required:
        result["reasons"].append(f"Minimaal {required} sessies nodig; {n} beschikbaar.")
        return result

    def ma(p, end):
        return fmean(b["close"] for b in bars[end - p + 1 : end + 1])

    def span(values):
        return max(b["high"] for b in values) - min(b["low"] for b in values)

    tr = [
        max(
            b["high"] - b["low"],
            abs(b["high"] - bars[i - 1]["close"]),
            abs(b["low"] - bars[i - 1]["close"]),
        )
        if i
        else b["high"] - b["low"]
        for i, b in enumerate(bars)
    ]
    atr = fmean(tr[n - 21 : n - 1])
    volumes = [b["volume"] for b in bars[n - 21 : n - 1]]
    volume_ratio = (
        ratio(last["volume"], fmean(volumes))
        if last["volume"] is not None and all(v is not None for v in volumes)
        else None
    )
    indicators = dict(
        atr20=atr,
        trueRange=tr[-1],
        rangeExpansion=ratio(tr[-1], atr),
        volumeConfirmation=volume_ratio >= c.volumeRatio
        if volume_ratio is not None
        else None,
    )
    for p in [10, 20, 50]:
        indicators[f"ma{p}"] = ma(p, n - 1)
        indicators[f"slope{p}"] = pct(ma(p, n - 2), ma(p, n - 2 - c.slopeSessions))
        indicators[f"distance{p}"] = pct(last["close"], indicators[f"ma{p}"])
    result["indicators"] = indicators
    candidates = []
    for end in range(max(c.moveMaxSessions, n - 1 - c.moveLookback), n - 2):
        duration = n - 2 - end
        if not 1 <= duration <= c.baseMaxSessions:
            continue
        for length in range(c.moveMinSessions, min(c.moveMaxSessions, end) + 1):
            gain = pct(bars[end]["close"], bars[end - length]["close"])
            if gain < c.moveMinPct or any(
                b["close"] > bars[end]["close"] for b in bars[end - length : end]
            ):
                continue
            base = bars[end + 1 : n - 1]
            high = max(bars[end]["high"], *(b["high"] for b in base))
            low = min(b["low"] for b in base)
            depth, advance = (high - low) / high * 100, pct(high, bars[end]["high"])
            k = c.contractionSessions
            range_ratio = (
                ratio(span(base[-k:]), span(base[:k])) if duration >= 2 * k else None
            )
            volatility_ratio = (
                ratio(fmean(tr[n - 1 - k : n - 1]), fmean(tr[end + 1 : end + 1 + k]))
                if duration >= 2 * k
                else None
            )
            higher = higher_lows(base, c.swingRadius, c.lowerLowTolerancePct)
            edge_lows = duration >= 2 * k and min(b["low"] for b in base[-k:]) >= min(
                b["low"] for b in base[:k]
            ) * (1 - c.lowerLowTolerancePct / 100)
            orderly = higher is True or higher is None and edge_lows
            tight = range_ratio is not None and range_ratio <= c.maxRangeRatio
            surfing = all(
                indicators[f"slope{p}"] >= c.minSlopePct
                and abs(pct(bars[n - 2]["close"], ma(p, n - 2))) <= c.maxMaDistancePct
                for p in ([10, 20, 50] if c.requireMa50 else [10, 20])
            )
            risk = (
                last["close"] < low
                or pct(last["close"], indicators["ma20"]) < -c.failureMa20Pct
            )
            failed = depth > c.maxDepthPct or higher is False or risk
            valid = (
                duration >= c.baseMinSessions
                and advance <= c.maxBaseAdvancePct
                and not failed
                and orderly
                and tight
                and volatility_ratio is not None
                and volatility_ratio <= c.maxVolatilityRatio
                and surfing
            )
            breakout = (
                valid
                and last["close"] > high
                and indicators["rangeExpansion"] is not None
                and indicators["rangeExpansion"] >= c.expansionRatio
                and (not c.requireVolume or indicators["volumeConfirmation"] is True)
            )
            ready = (
                valid
                and last["close"] <= high
                and (high - last["close"]) / high * 100 <= c.readyDistancePct
            )
            status = (
                "failed"
                if failed
                else "breakout"
                if breakout
                else "ready"
                if ready
                else "forming"
            )
            reasons = []
            for condition, reason in [
                (
                    duration < c.baseMinSessions,
                    f"Basis nog te kort: {duration} van minimaal {c.baseMinSessions} sessies.",
                ),
                (depth > c.maxDepthPct, "Consolidatie te diep."),
                (higher is False, "Materieel lagere swingbodem in de consolidatie."),
                (not orderly, "Hogere bodems nog niet bevestigd."),
                (not tight, "Range nog niet voldoende vernauwd."),
                (
                    volatility_ratio is None or volatility_ratio > c.maxVolatilityRatio,
                    "Volatiliteit nog niet voldoende afgenomen.",
                ),
                (not surfing, "Steun op stijgende gemiddelden ontbreekt."),
                (
                    advance > c.maxBaseAdvancePct,
                    "Te veel nieuwe stijging binnen de consolidatie.",
                ),
                (risk, "Actuele koers schendt de risicogrens."),
                (
                    last["close"] > high
                    and (
                        indicators["rangeExpansion"] is None
                        or indicators["rangeExpansion"] < c.expansionRatio
                    ),
                    f"Range-expansie blijft onder {c.expansionRatio}× ATR20.",
                ),
                (
                    c.requireVolume and indicators["volumeConfirmation"] is not True,
                    "Verplichte volumebevestiging ontbreekt.",
                ),
                (
                    valid and last["close"] <= high and not ready,
                    f"Slot ligt meer dan {c.readyDistancePct}% onder het breakoutniveau.",
                ),
                (
                    last["close"] > high and not breakout,
                    "Uitbraak zonder alle vereiste bevestigingen.",
                ),
            ]:
                if condition:
                    reasons.append(reason)
            candidates.append(
                dict(
                    status=status,
                    reasons=reasons,
                    checklist={
                        "impulse": True,
                        "duration": c.baseMinSessions <= duration <= c.baseMaxSessions,
                        "depth": depth <= c.maxDepthPct,
                        "higherLows": higher,
                        "orderlyLows": bool(orderly),
                        "tighteningRange": tight,
                        "decliningVolatility": volatility_ratio is not None
                        and volatility_ratio <= c.maxVolatilityRatio,
                        "movingAverageSupport": surfing,
                        "riskIntact": not failed,
                        "closeAboveHigh": last["close"] > high,
                        "rangeExpansion": indicators["rangeExpansion"] is not None
                        and indicators["rangeExpansion"] >= c.expansionRatio,
                        "volume": indicators["volumeConfirmation"],
                    },
                    maSupport="MA10/20/50"
                    if surfing and c.requireMa50
                    else "MA10/20"
                    if surfing
                    else None,
                    move=dict(
                        pct=gain,
                        start=bars[end - length]["date"],
                        end=bars[end]["date"],
                        sessions=length,
                    ),
                    base=dict(
                        start=base[0]["date"],
                        end=base[-1]["date"],
                        sessions=duration,
                        weeks=duration / 5,
                        high=high,
                        low=low,
                        depthPct=depth,
                        advancePct=advance,
                        rangeRatio=range_ratio,
                        volatilityRatio=volatility_ratio,
                        higherLows=higher,
                        orderlyLows=bool(orderly),
                        tighteningRange=tight,
                        distanceToHighPct=(high - last["close"]) / high * 100,
                    ),
                )
            )
    priority = dict(breakout=3, ready=2, forming=1, failed=0)
    if candidates:
        result.update(
            max(
                candidates,
                key=lambda v: (
                    priority[v["status"]],
                    v["base"]["sessions"],
                    v["move"]["pct"],
                ),
            )
        )
    else:
        result.update(
            status="forming",
            reasons=[
                "Geen kwalificerende voorafgaande impuls met recente consolidatie."
            ],
        )
    return result


def rank(rows, config):
    output = [
        dict(r, ranks=[None] * 3, percentiles=[None] * 3, score=None) for r in rows
    ]
    for p in range(3):
        eligible = sorted(
            (
                r
                for r in output
                if r["returns"][p] is not None
                and not r.get("stale")
                and not r.get("corporateActionReview")
            ),
            key=lambda r: (-r["returns"][p], r.get("id", r["symbol"])),
        )
        for i, row in enumerate(eligible):
            row["ranks"][p] = i + 1
            row["percentiles"][p] = (
                100 if len(eligible) == 1 else (1 - i / (len(eligible) - 1)) * 100
            )
    for row in output:
        if all(v is not None for v in row["percentiles"]):
            row["score"] = sum(
                v * w for v, w in zip(row["percentiles"], config.weights)
            )
    return sorted(
        output,
        key=lambda r: (
            -(r["score"] if r["score"] is not None else -1),
            r.get("id", r["symbol"]),
        ),
    )


def select_leaders(rows, top=2, period=0):
    eligible = sorted(
        (r for r in rows if r["ranks"][period] is not None),
        key=lambda r: r["ranks"][period],
    )
    return eligible if top is None else eligible[: ceil(len(eligible) * top / 100)]
