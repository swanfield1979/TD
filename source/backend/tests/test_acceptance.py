import ast
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.analysis.leadership import analyze
from app.core.settings import Settings
from app.db.repository import Repository
from app.main import create_app
from app.schemas.scanner import SyncRequest
from app.services.scanner import Scanner
from app.services.universe import parse_universe
from .fixtures import FakeBroker, bars, setup_fixture
from .test_cache_api import HEADERS


@pytest.mark.parametrize(
    "kind,status",
    [
        ("forming", "forming"),
        ("ready", "ready"),
        ("breakout", "breakout"),
        ("failed", "failed"),
        ("no_move", "forming"),
        ("insufficient", "insufficient_data"),
    ],
)
def test_deterministic_synthetic_scenarios(kind, status):
    data = setup_fixture(kind)
    assert data == setup_fixture(kind)
    assert [b["date"] for b in data] == sorted({b["date"] for b in data})
    row = analyze("TEST", data)
    assert row["status"] == status
    if kind == "forming":
        assert row["move"]["pct"] >= 30 and row["base"]["sessions"] < 10
    if kind == "failed":
        assert row["base"]["depthPct"] > 25
    if kind == "no_move":
        assert row["move"] is None
    if kind == "insufficient":
        assert row["returns"][2] is None


def test_duplicate_analysis_bars_are_rejected_and_cache_upsert_is_unique(tmp_path):
    data = bars()
    with pytest.raises(ValueError, match="Dubbele handelsdatum"):
        analyze("TEST", data + [data[-1]])
    repo = Repository(tmp_path / "duplicates.sqlite")
    try:
        repo.import_universe(
            parse_universe("symbol,exchange,currency\nTEST,NASDAQ,USD")
        )
        item = repo.universe()[0]
        repo.store_bars(item.id, "TRADES", data)
        repo.store_bars(item.id, "TRADES", data)
        assert repo.bars(item.id, "TRADES") == data
    finally:
        repo.close()


async def test_duplicate_broker_response_preserves_valid_cache(tmp_path):
    s = Settings(database_path=tmp_path / "duplicate-response.sqlite")
    repo = Repository(s.database_path)
    broker = FakeBroker(s, s.default_broker())
    scanner = Scanner(repo, broker)
    try:
        repo.import_universe(
            parse_universe("symbol,exchange,currency\nTEST,NASDAQ,USD")
        )
        item = repo.universe()[0]
        repo.store_bars(item.id, "TRADES", bars())
        previous = repo.bars(item.id, "TRADES")

        async def duplicate(*_):
            return previous + [previous[-1]]

        broker.history = duplicate
        await scanner.prepare(SyncRequest(force_refresh=True))
        await scanner.task
        assert scanner.state["state"] == "partial"
        assert repo.bars(item.id, "TRADES") == previous
        assert "unieke" in repo.universe()[0].last_error
    finally:
        await scanner.close()
        repo.close()


class CachedOnlyBroker(FakeBroker):
    is_demo = False

    async def connect(self):
        raise AssertionError("Offline cached mode mag niet automatisch verbinden.")

    async def history(self, *_):
        raise AssertionError("Cached read mag geen brokerrequest verzenden.")


def test_disconnected_cached_mode_health_and_recalculation(tmp_path):
    path = tmp_path / "offline.sqlite"
    repo = Repository(path)
    repo.import_universe(
        parse_universe("symbol,exchange,currency,company\nTEST,NASDAQ,USD,Test company")
    )
    repo.store_bars(repo.universe()[0].id, "TRADES", bars())
    repo.put("last_successful_sync", "2026-10-09T22:00:00+00:00")
    timestamp = repo.universe()[0].synced_at
    repo.close()
    for _ in range(
        2
    ):  # A process-style reopen retains data and the exact acquisition timestamp.
        with TestClient(
            create_app(Settings(database_path=path), CachedOnlyBroker)
        ) as client:
            assert client.get("/api/health").json()["storage"] == "sqlite"
            state = client.get("/api/sync/status").json()
            assert state["broker"]["connected"] is False
            assert state["dataMode"] == "cached_ibkr" and "Cached" in state["dataLabel"]
            assert state["lastDataUpdateAt"] == timestamp
            assert datetime.fromisoformat(timestamp).tzinfo is not None
            assert state["lastSuccessfulSyncAt"] == "2026-10-09T22:00:00+00:00"
            assert (
                client.get("/api/leaders?status=breakout&exchange=NASDAQ").json()[0][
                    "symbol"
                ]
                == "TEST"
            )
            assert client.get("/api/leaders?status=failed").json() == []
            assert client.get("/api/leaders?min_price=1000").json() == []
            assert (
                client.post("/api/analysis/recalculate", headers=HEADERS).status_code
                == 200
            )
            assert client.get("/api/stocks/TEST").json()["lastUpdatedAt"] == timestamp


def test_csv_metadata_duplicate_contract_keys_and_invalid_symbols():
    csv = "symbol,exchange,currency,company_name,sector\nTEST,NASDAQ,USD,Test Co,Tech\nTEST,NASDAQ,USD,Duplicate,Tech\nTEST,NYSE,USD,Other venue,Tech"
    rows = parse_universe(csv)
    assert len(rows) == 2 and rows[0]["company"] == "Test Co"
    with pytest.raises(ValueError):
        parse_universe("symbol,exchange,currency\nBAD<script>,SMART,USD")


def test_scanner_has_no_order_operations():
    prohibited = {
        "placeOrder",
        "place_order",
        "cancelOrder",
        "cancel_order",
        "reqAllOpenOrders",
        "reqOpenOrders",
        "exerciseOptions",
    }
    app = Path(__file__).resolve().parents[1] / "app"
    for file in app.rglob("*.py"):
        parsed = ast.parse(file.read_text(encoding="utf-8"))
        assert not any(
            isinstance(n, ast.Attribute) and n.attr in prohibited
            for n in ast.walk(parsed)
        ), file
