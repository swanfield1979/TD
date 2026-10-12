from datetime import date, timedelta

from app.core.calendar import HOLIDAYS
from app.services.scanner import latest_completed_day


def bars(breakout=True, end=date(2026, 10, 9)):
    """Fixed prices and dates; demo may explicitly shift the session anchor."""
    values = (
        [45 + i * 0.025 for i in range(140)]
        + [48.5 + i * 3.5 for i in range(1, 11)]
        + [82 + i * 0.1 for i in range(24)]
        + [90 if breakout else 84.5]
    )
    dates, day = [], end
    while len(dates) < len(values):
        if day.weekday() < 5 and day.isoformat() not in HOLIDAYS:
            dates.append(day.isoformat())
        day -= timedelta(days=1)
    dates.reverse()
    output = []
    for i, (value, day) in enumerate(zip(values, dates)):
        spread = (
            1
            if i < 140
            else 2
            if i < 150
            else 6 - (i - 150) * 0.21
            if i < 174
            else 5
            if breakout
            else 1
        )
        output.append(
            dict(
                date=day,
                open=value - 0.1,
                high=value + spread / 2,
                low=value - spread / 2,
                close=value,
                volume=100000,
            )
        )
    return output


def setup_fixture(kind):
    """Six independent, deterministic synthetic OHLCV scenarios. No market feed."""
    data = bars(kind != "ready")
    if kind == "forming":
        for i in range(140, 150):
            value = 49 if i < 145 else 48.5 + (i - 144) * 7
            data[i].update(open=value - 0.1, high=value + 1, low=value - 1, close=value)
        return data[:156]
    if kind == "failed":
        for b in data[150:-1]:
            b["low"] = 35
        data[-1].update(open=60, high=61, low=59, close=60)
    elif kind == "no_move":
        for i, b in enumerate(data):
            value = 45 + i * 0.025
            b.update(open=value - 0.1, high=value + 0.5, low=value - 0.5, close=value)
    elif kind == "insufficient":
        return data[-50:]
    elif kind not in {"ready", "breakout"}:
        raise ValueError("Onbekende fixture.")
    return data


class FakeBroker:
    """Only injected into tests; never selected by production environment settings."""

    is_demo = True

    def __init__(self, settings, config):
        self.settings, self.config = settings, config
        self.connected = False
        self.calls, self.resolves = [], []
        self.fail_symbols = set()

    def public_status(self):
        return dict(
            state="connected" if self.connected else "disconnected",
            connected=self.connected,
            message="TESTFIXTURE · geen echte IBKR-verbinding",
            mode=self.config.mode,
            readOnly=True,
            retries=0,
            safetyLabel="Read-only — geen orderuitvoering",
        )

    async def request(self, operation):
        await self.connect()
        return await operation()

    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.connected = False

    async def resolve(self, instrument):
        self.resolves.append(instrument.symbol)
        return dict(
            conId=instrument.id + 1000,
            symbol=instrument.symbol,
            secType="STK",
            exchange="SMART",
            primaryExchange=instrument.exchange,
            currency=instrument.currency,
        )

    async def history(self, contract, duration, kind):
        from app.broker.client import BrokerError

        self.calls.append((contract["symbol"], duration, kind))
        if contract["symbol"] in self.fail_symbols:
            raise BrokerError("Marktdatasubscriptie ontbreekt.", False)
        await self.connect()
        return bars(end=latest_completed_day())
