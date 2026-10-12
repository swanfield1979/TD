import time

import pytest
from fastapi.testclient import TestClient

from app.analysis.leadership import analyze, higher_lows
from app.core.settings import Settings
from app.main import create_app
from app.schemas.scanner import AnalysisConfig
from app.db.repository import Repository
from app.services.scanner import Scanner
from .fixtures import FakeBroker, bars
from .test_cache_api import HEADERS


def test_complete_api_contract_and_structured_errors(tmp_path):
    app = create_app(Settings(database_path=tmp_path / "api.sqlite"), FakeBroker)
    with TestClient(app) as client:
        config = {
            "filters": {"minimumPrice": 5, "minimumAverageDollarVolume": 1000},
            "pacing": {
                "intervalSeconds": 0,
                "maxRequests": 50,
                "windowSeconds": 600,
                "concurrency": 1,
            },
        }
        assert (
            client.put("/api/settings", headers=HEADERS, json=config).status_code == 200
        )
        assert client.get("/api/settings").json()["filters"]["minimumPrice"] == 5
        invalid = client.put(
            "/api/settings", headers=HEADERS, json={"pacing": {"concurrency": 2}}
        )
        assert invalid.status_code == 422
        assert invalid.json()["error"]["code"] == "validation_error"
        assert client.get("/api/leaders?min_price=NaN").status_code == 422
        assert (
            client.put(
                "/api/settings", headers=HEADERS, json={"unknown": 3}
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/api/universe/import",
                headers=HEADERS,
                files={
                    "file": (
                        "x.csv",
                        "symbol,exchange,currency,company\nTEST,NASDAQ,USD,Test company",
                    )
                },
            ).status_code
            == 200
        )
        assert (
            client.post("/api/sync/start", headers=HEADERS, json={}).status_code == 202
        )
        for _ in range(100):
            state = client.get("/api/sync/status").json()
            if state["state"] != "running":
                break
            time.sleep(0.01)
        assert state["state"] == "complete"
        assert state["lastSuccessfulSyncAt"] and state["lastDataUpdateAt"]
        assert state["sufficientSymbols"] == 1
        assert state["dataMode"] == "demo"
        row = client.get("/api/stocks/test").json()
        assert row["checklist"]["tighteningRange"]
        assert row["maSupport"] == "MA10/20"
        assert row["lastUpdatedAt"] and row["calculatedAt"]
        candle_data = client.get("/api/stocks/TEST/bars?limit=21").json()
        assert len(candle_data["bars"]) == 21
        assert candle_data["dataMode"] == "demo"
        assert (
            client.get(
                "/api/stocks/TEST/bars?start=2026-10-12&end=2026-01-01"
            ).status_code
            == 422
        )
        assert client.get("/api/stocks/UNKNOWN").status_code == 404
        assert (
            client.post("/api/analysis/recalculate", headers=HEADERS).status_code == 200
        )
        assert client.post("/api/sync/cancel", headers=HEADERS).status_code == 200
        client.post(
            "/api/universe/import",
            headers=HEADERS,
            files={"file": ("x.csv", "symbol,exchange,currency\nTEST,NYSE,USD")},
        )
        assert client.get("/api/stocks/TEST").status_code == 409
        assert (
            client.get("/api/stocks/TEST?exchange=NASDAQ&currency=USD").status_code
            == 200
        )
    with TestClient(
        create_app(Settings(database_path=tmp_path / "api.sqlite"), FakeBroker)
    ) as restored:
        assert restored.get("/api/settings").json()["pacing"]["maxRequests"] == 50


@pytest.mark.parametrize("period", [21, 63, 126])
def test_all_return_periods(period):
    data = bars()
    actual = analyze("TEST", data)["returns"][[21, 63, 126].index(period)]
    assert actual == pytest.approx(
        (data[-1]["close"] / data[-period - 1]["close"] - 1) * 100
    )


def test_consolidation_contraction_and_ma_rules():
    ready = analyze("TEST", bars(False))
    assert 10 <= ready["base"]["sessions"] <= 42
    assert (
        ready["checklist"]["tighteningRange"]
        and ready["checklist"]["decliningVolatility"]
    )
    assert ready["checklist"]["movingAverageSupport"]
    assert all(ready["indicators"][f"slope{p}"] > 0 for p in [10, 20, 50])
    assert (
        analyze("TEST", bars(False), AnalysisConfig(baseMinSessions=42))["status"]
        != "ready"
    )
    assert not analyze("TEST", bars(False), AnalysisConfig(maxRangeRatio=0.0001))[
        "checklist"
    ]["tighteningRange"]
    assert not analyze("TEST", bars(False), AnalysisConfig(minSlopePct=100))[
        "checklist"
    ]["movingAverageSupport"]


def test_confirmed_swing_lows_and_tolerance():
    data = bars(False)
    for idx, low in [(153, 79), (160, 80), (168, 81)]:
        data[idx]["low"] = low
    assert analyze("TEST", data)["base"]["higherLows"] is True
    data[168]["low"] = 74
    assert higher_lows(data[150:-1], 2, 2) is False
    assert higher_lows(data[150:-1], 2, 10) is True


@pytest.mark.asyncio
async def test_missing_sessions_exclude_misleading_momentum(tmp_path):
    repo = Repository(tmp_path / "gaps.sqlite")
    repo.import_universe(
        [
            {
                "symbol": "TEST",
                "exchange": "NASDAQ",
                "currency": "USD",
                "company": "",
                "sector": "",
            }
        ]
    )
    data = bars()
    del data[-3]
    repo.store_bars(repo.universe()[0].id, "TRADES", data)
    config = Settings(database_path=tmp_path / "gaps.sqlite")
    scanner = Scanner(repo, FakeBroker(config, config.default_broker()))
    await scanner.recalculate()
    row = scanner.state["rows"][0]
    assert row["missingSessionDates"]
    assert row["status"] == "insufficient_data"
    assert row["ranks"] == [None, None, None]
    repo.close()


def test_env_aliases_and_read_only_enforcement(monkeypatch, tmp_path):
    monkeypatch.setenv("IBKR_PORT", "7497")
    monkeypatch.setenv("IBKR_READ_ONLY", "true")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path.as_posix()}/db.sqlite")
    s = Settings()
    assert s.broker_port == 7497 and s.read_only
    assert s.database_path == tmp_path / "db.sqlite"
    monkeypatch.setenv("IBKR_READ_ONLY", "false")
    with pytest.raises(ValueError):
        Settings()
