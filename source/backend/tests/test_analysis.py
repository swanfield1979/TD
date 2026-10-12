import pytest

from app.analysis.leadership import analyze, rank, select_leaders
from app.schemas.scanner import AnalysisConfig

from .fixtures import bars


def test_breakout_ready_failed_and_insufficient():
    row = analyze("TEST", bars())
    assert row["status"] == "breakout"
    assert row["base"]["high"] < row["close"]
    assert row["base"]["depthPct"] < 10
    assert row["base"]["end"] == bars()[-2]["date"]
    assert row["move"]["pct"] >= 30
    assert analyze("TEST", bars(False))["status"] == "ready"
    failed = bars()
    failed[-1].update(open=60, high=61, low=59, close=60)
    assert analyze("TEST", failed)["status"] == "failed"
    insufficient = analyze("TEST", bars()[-50:])
    assert insufficient["status"] == "insufficient_data"
    assert insufficient["returns"][2] is None


def test_no_candidate_lookahead_in_high_or_atr():
    original = bars()
    base = analyze("TEST", original)
    changed = bars()
    changed[-1]["high"] = 150
    current = analyze("TEST", changed)
    assert current["base"]["high"] == base["base"]["high"]
    assert current["indicators"]["atr20"] == base["indicators"]["atr20"]
    future = original + [
        dict(date="2099-01-01", open=900, high=901, low=899, close=900, volume=10)
    ]
    assert analyze("TEST", future[: len(original)]) == base


def test_volume_optional_and_no_infinite_ratios():
    missing = bars()
    for b in missing:
        b["volume"] = None
    assert analyze("TEST", missing)["status"] == "breakout"
    assert (
        analyze("TEST", missing, AnalysisConfig(requireVolume=True))["status"]
        == "forming"
    )
    flat = [
        {**b, "open": 50, "high": 50, "low": 50, "close": 50, "volume": 0}
        for b in bars()
    ]
    assert analyze("TEST", flat)["indicators"]["rangeExpansion"] is None


def test_cross_sectional_weights_periods_and_stale():
    c = AnalysisConfig()
    rows = rank(
        [dict(symbol=f"S{i:03}", returns=[i, 200 - i, i]) for i in range(200)], c
    )
    assert len(select_leaders(rows, 1)) == 2
    assert len(select_leaders(rows, 2)) == 4
    assert len(select_leaders(rows, 5)) == 10
    assert select_leaders(rows, 1, 0)[0]["symbol"] == "S199"
    assert select_leaders(rows, 1, 1)[0]["symbol"] == "S000"
    assert rows[0]["score"] == pytest.approx(
        sum(p * w for p, w in zip(rows[0]["percentiles"], c.weights))
    )
    assert (
        rank([dict(symbol="OLD", returns=[1, 2, 3], stale=True)], c)[0]["score"] is None
    )


@pytest.mark.parametrize(
    "input",
    [
        {"periods": [0, 21, 63]},
        {"weights": [1, 1, 1]},
        {"baseMinSessions": 0},
        {"baseMaxSessions": 5},
        {"expansionRatio": 0},
        {"unknown": 1},
    ],
)
def test_configuration_validation(input):
    with pytest.raises(ValueError):
        AnalysisConfig.model_validate(input)


def test_momentum_session_count_and_large_move_not_capped():
    original = bars()
    assert analyze("TEST", original)["returns"][0] == pytest.approx(
        (original[-1]["close"] / original[-22]["close"] - 1) * 100
    )
    for b in original[140:]:
        for k in ["open", "high", "low", "close"]:
            b[k] *= 3
    assert analyze("TEST", original)["move"]["pct"] > 100
