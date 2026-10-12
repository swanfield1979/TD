import asyncio
from datetime import timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.settings import Settings
from app.db.repository import Repository
from app.main import create_app
from app.schemas.scanner import SyncRequest
from app.services.scanner import Scanner, incremental_duration, latest_completed_day
from app.services.universe import parse_universe

from .fixtures import FakeBroker, bars

HEADERS = {"Origin": "http://127.0.0.1:5173", "X-Requested-With": "trading-monitor"}
CSV = "symbol,exchange,currency,company,sector\nTEST,NASDAQ,USD,Test company,Tech\nBAD,NYSE,USD,Bad company,Health\n"


def test_api_security_csv_and_settings(tmp_path):
    assert Settings.model_fields["database_path"].default == (
        Path(__file__).resolve().parents[2] / "data" / "private" / "breakout.sqlite"
    )
    app = create_app(Settings(database_path=tmp_path / "scan.sqlite"), FakeBroker)
    with TestClient(app) as client:
        assert client.get("/api/health").json()["readOnly"]
        assert client.get("/api/settings").json()["broker"]["port"] == 4002
        assert client.get("/api/settings").json()["broker"]["mode"] == "paper"
        assert client.post("/api/broker/connect").status_code == 403
        assert (
            client.put(
                "/api/settings/broker", headers=HEADERS, json={"client_id": 0}
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/api/universe/upload",
                headers=HEADERS,
                files={"file": ("x.csv", "symbol\nAAPL")},
            ).status_code
            == 422
        )
        uploaded = client.post(
            "/api/universe/upload", headers=HEADERS, files={"file": ("x.csv", CSV)}
        )
        assert uploaded.json()["total"] == 2
        assert (
            client.get("/api/broker/status").json()["safetyLabel"]
            == "Read-only — geen orderuitvoering"
        )
        assert client.get("/api/openapi.json").status_code == 200
        assert client.post("/api/broker/connect", headers=HEADERS).status_code == 202
        assert client.post("/api/broker/disconnect", headers=HEADERS).status_code == 200
        assert (
            client.post(
                "/api/breakout",
                headers=HEADERS,
                json={"config": {"weights": [1, 1, 1]}},
            ).status_code
            == 422
        )


async def test_cache_first_incremental_and_retry_preserves_history(tmp_path):
    settings = Settings(database_path=tmp_path / "scan.sqlite")
    repo = Repository(settings.database_path)
    broker = FakeBroker(settings, settings.default_broker())
    scanner = Scanner(repo, broker)
    try:
        repo.import_universe(parse_universe(CSV))
        broker.fail_symbols.add("BAD")
        await scanner.prepare(SyncRequest())
        await scanner.task
        assert scanner.state["state"] == "partial"
        test = next(i for i in repo.universe() if i.symbol == "TEST")
        assert len(repo.bars(test.id, "TRADES")) == 175
        assert (
            next(r for r in scanner.state["rows"] if r["symbol"] == "TEST")["status"]
            == "breakout"
        )
        original_calls = len(broker.calls)
        original_resolves = len(broker.resolves)
        await scanner.prepare(SyncRequest())
        await scanner.task
        assert (
            len(broker.calls) == original_calls + 1
        )  # Only BAD; current TEST history is served entirely from cache.
        assert (
            len(broker.resolves) == original_resolves
        )  # conIds cached, including failed history contracts.
        broker.fail_symbols.clear()
        await scanner.prepare(SyncRequest(retry_failed=True))
        await scanner.task
        assert scanner.state["state"] == "complete"
        assert broker.calls[-1][0] == "BAD"
        before = repo.bars(test.id, "TRADES")
        broker.fail_symbols.add("TEST")
        await scanner.prepare(SyncRequest(force_refresh=True))
        await scanner.task
        assert repo.bars(test.id, "TRADES") == before
        assert next(r for r in scanner.state["rows"] if r["symbol"] == "TEST")[
            "lastError"
        ]
        reloaded = Scanner(repo, broker)
        assert reloaded.state["rows"]
    finally:
        await scanner.close()
        repo.close()


def test_missing_only_duration_and_overlap():
    target = latest_completed_day()
    history = [dict(date=(target - timedelta(days=4)).isoformat())]
    assert incremental_duration(history, target) == "6 D"
    assert incremental_duration([dict(date=target.isoformat())], target) is None
    assert incremental_duration(history, target, True) == "3 Y"


def test_cache_partitions_and_atomic_import(tmp_path):
    repo = Repository(tmp_path / "scan.sqlite")
    try:
        repo.import_universe(parse_universe(CSV))
        item = repo.universe()[0]
        repo.store_bars(item.id, "TRADES", bars())
        assert not repo.bars(item.id, "ADJUSTED_LAST")
        repo.import_universe(
            parse_universe("symbol,exchange,currency\nOTHER,NYSE,USD"), replace=True
        )
        assert len(repo.universe()) == 1
        assert (
            len(repo.bars(item.id, "TRADES")) == 175
        )  # Deactivated universe members retain cached history.
    finally:
        repo.close()


async def test_cancellation_retains_cached_bars(tmp_path):
    settings = Settings(database_path=tmp_path / "scan.sqlite")
    repo = Repository(settings.database_path)
    broker = FakeBroker(settings, settings.default_broker())
    scanner = Scanner(repo, broker)
    try:
        repo.import_universe(parse_universe(CSV))
        item = repo.universe()[0]
        repo.store_bars(item.id, "TRADES", bars())
        entered = asyncio.Event()

        async def blocked(*_):
            entered.set()
            await asyncio.sleep(100)

        broker.history = blocked
        await scanner.prepare(SyncRequest(force_refresh=True))
        await entered.wait()
        await scanner.cancel()
        assert scanner.state["state"] == "cancelled"
        assert len(repo.bars(item.id, "TRADES")) == 175
    finally:
        await scanner.close()
        repo.close()
