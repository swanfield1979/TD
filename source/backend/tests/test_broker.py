import asyncio
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from ib_async.wrapper import RequestError

from app.broker.client import Broker, BrokerError
from app.broker.pacing import Pacer
from app.core.settings import Settings


class Event:
    def __init__(self):
        self.callbacks = []

    def __iadd__(self, callback):
        self.callbacks.append(callback)
        return self

    def emit(self, *args):
        for callback in self.callbacks:
            callback(*args)


class FakeWrapper:
    def __init__(self):
        self.futures = {}

    def startReq(self, key, contract=None):
        future = asyncio.get_running_loop().create_future()
        self.futures[key] = future
        return future

    def _endReq(self, key):
        self.futures.pop(key, None)


class FakeIB:
    def __init__(self):
        self.connected = False
        self.disconnectedEvent = Event()
        self.errorEvent = Event()
        self.wrapper = FakeWrapper()
        self.client = self
        self.cancelled = []
        self.requests = []
        self.connects = []
        self.sequence = 0
        self.errors = []
        self.hold = False

    def isConnected(self):
        return self.connected

    async def connectAsync(self, host, port, **kwargs):
        self.connects.append((host, port, kwargs))
        self.connected = True

    def reqMarketDataType(self, value):
        self.market_type = value

    def disconnect(self):
        self.connected = False
        self.disconnectedEvent.emit()

    def getReqId(self):
        self.sequence += 1
        return self.sequence

    def reqHistoricalData(
        self, id, contract, end, duration, size, kind, rth, format, update, options
    ):
        self.requests.append((id, size, kind, rth, update))
        if self.hold:
            return
        future = self.wrapper.futures[id]
        if self.errors:
            future.set_exception(self.errors.pop(0))
        else:
            future.set_result(
                [
                    SimpleNamespace(
                        date=date.today() - timedelta(days=2),
                        open=10,
                        high=11,
                        low=9,
                        close=10,
                        volume=500,
                    ),
                    SimpleNamespace(
                        date=date.today() + timedelta(days=1),
                        open=10,
                        high=11,
                        low=9,
                        close=10,
                        volume=500,
                    ),
                ]
            )

    def cancelHistoricalData(self, id):
        self.cancelled.append(id)


def adapter():
    settings = Settings(request_interval=0, backoff_base=0, request_timeout=0.5)
    ib = FakeIB()
    broker = Broker(settings, settings.default_broker(), ib)

    # Pacing itself is tested below; remove 15s real wall-clock from adapter retry tests.
    async def immediate(*_):
        pass

    broker.pacer.wait = immediate
    return broker, ib


async def test_readonly_paper_daily_bars_and_cancellation():
    broker, ib = adapter()
    rows = await broker.history(
        {
            "conId": 10,
            "symbol": "TEST",
            "secType": "STK",
            "exchange": "SMART",
            "currency": "USD",
        },
        "3 Y",
        "TRADES",
    )
    assert len(rows) == 1
    assert ib.connects[0][1] == 4002
    assert ib.connects[0][2]["readonly"] is True
    assert ib.connects[0][2]["fetchFields"].value == 0
    assert ib.market_type == 3
    assert ib.requests[0][1:] == ("1 day", "TRADES", True, False)
    assert ib.cancelled == [1]
    assert not broker.historical_requests
    await broker.disconnect()
    assert not broker.public_status()["connected"]


async def test_bounded_retries_missing_subscription_and_redaction():
    broker, ib = adapter()
    ib.errors = [RuntimeError("transient"), RuntimeError("transient")]
    await broker.history({"conId": 10}, "3 Y", "TRADES")
    assert len(ib.requests) == 3
    assert broker.retry_count == 2
    ib.errors = [RequestError(4, 354, "account SECRET")]
    with pytest.raises(BrokerError, match="Marktdatasubscriptie ontbreekt") as error:
        await broker.history({"conId": 10}, "3 Y", "TRADES")
    assert "SECRET" not in str(error.value)
    assert len(ib.requests) == 4
    ib.errors = [RuntimeError("fail")] * 3
    with pytest.raises(BrokerError):
        await broker.history({"conId": 10}, "3 Y", "TRADES")
    assert len(ib.requests) == 7


async def test_socket_reconnect_and_active_request_cleanup():
    broker, ib = adapter()
    await broker.connect()
    ib.connected = False
    ib.disconnectedEvent.emit()
    assert broker.public_status()["state"] == "reconnecting"
    await broker.history({"conId": 10}, "3 Y", "TRADES")
    assert len(ib.connects) == 2
    ib.hold = True
    task = asyncio.create_task(broker.history({"conId": 10}, "3 Y", "TRADES"))
    while not broker.historical_requests:
        await asyncio.sleep(0)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not broker.historical_requests
    assert not ib.wrapper.futures
    assert len(ib.cancelled) == 2


async def test_rolling_pacing_interval_and_identical_request_limit():
    now = [0.0]
    sleeps = []

    async def sleep(value):
        sleeps.append(value)
        now[0] += value

    pacer = Pacer(2, 2, 10, clock=lambda: now[0], sleep=sleep)
    await pacer.wait()
    await pacer.wait()
    await pacer.wait()
    assert sleeps == [2, 8]
    assert list(pacer.requests) == [2, 10]
    pacer = Pacer(0, 55, 600, clock=lambda: now[0], sleep=sleep)
    await pacer.wait("TEST")
    await pacer.wait("TEST")
    assert sleeps[-1] == 15
