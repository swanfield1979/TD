from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from app.core.settings import Settings
from app.db.repository import Repository
from app.main import create_app
from app.schemas.scanner import SyncRequest
from app.services.scanner import Scanner, latest_completed_day
from app.services.universe import parse_universe

from .fixtures import FakeBroker, bars
from .test_broker import adapter
from .test_cache_api import HEADERS


async def test_bounded_exponential_backoff(monkeypatch):
    broker, ib = adapter()
    broker.settings.backoff_base = 2
    broker.settings.backoff_cap = 3
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    monkeypatch.setattr("app.broker.client.asyncio.sleep", sleep)
    ib.errors = [RuntimeError("one"), RuntimeError("two")]
    await broker.history({"conId": 10}, "3 Y", "TRADES")
    assert sleeps == [2, 3]


async def test_invalid_response_keeps_cache_and_flags_split_revisions(tmp_path):
    settings = Settings(database_path=tmp_path / "scan.sqlite")
    repo = Repository(settings.database_path)
    broker = FakeBroker(settings, settings.default_broker())
    scanner = Scanner(repo, broker)
    try:
        repo.import_universe(
            parse_universe("symbol,exchange,currency\nTEST,NASDAQ,USD")
        )
        await scanner.prepare(SyncRequest())
        await scanner.task
        item = repo.universe()[0]
        before = repo.bars(item.id, "TRADES")

        async def invalid(*_):
            return [
                dict(date="2026-10-01", open=10, high=9, low=8, close=10, volume=100)
            ]

        broker.history = invalid
        await scanner.prepare(SyncRequest(force_refresh=True))
        await scanner.task
        assert repo.bars(item.id, "TRADES") == before
        revised = [
            {
                **b,
                "open": b["open"] / 2,
                "high": b["high"] / 2,
                "low": b["low"] / 2,
                "close": b["close"] / 2,
            }
            for b in before[-3:]
        ]
        repo.store_bars(item.id, "TRADES", revised)
        await scanner.recalculate()
        assert scanner.state["rows"][0]["corporateActionReview"]
        assert scanner.state["rows"][0]["score"] is None
        repo.store_bars(item.id, "TRADES", bars(), full=True)
        await scanner.recalculate()
        assert scanner.state["rows"][0]["score"] is not None
    finally:
        await scanner.close()
        repo.close()


def test_nyse_holidays_and_weekends():
    assert (
        latest_completed_day(
            datetime(2026, 12, 26, tzinfo=ZoneInfo("America/New_York"))
        ).isoformat()
        == "2026-12-24"
    )
    assert (
        latest_completed_day(
            datetime(2026, 10, 12, tzinfo=ZoneInfo("America/New_York"))
        ).isoformat()
        == "2026-10-09"
    )


def test_real_http_scan_and_leader_filters(tmp_path):
    app = create_app(Settings(database_path=tmp_path / "scan.sqlite"), FakeBroker)
    with TestClient(app) as client:
        client.post(
            "/api/universe/upload",
            headers=HEADERS,
            files={
                "file": (
                    "test.csv",
                    "symbol,exchange,currency,company,sector\nTEST,NASDAQ,USD,Test,Tech",
                )
            },
        )
        assert client.post("/api/sync", headers=HEADERS, json={}).status_code == 202
        import time

        for _ in range(100):
            state = client.get("/api/breakout").json()
            if state["state"] != "running":
                break
            time.sleep(0.01)
        assert state["state"] == "complete"
        leaders = client.get(
            "/api/leaders?top=1&status=breakout&exchange=NASDAQ&sector=Tech"
        ).json()
        assert len(leaders) == 1
        assert leaders[0]["averageDollarVolume"] > 0
        assert client.get("/api/leaders?min_price=1000").json() == []
        assert client.get("/api/leaders?min_dollar_volume=999999999999").json() == []
        assert client.get("/api/leaders?top=7").status_code == 422
        assert client.get("/api/leaders?status=wrong").status_code == 422
