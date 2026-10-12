from datetime import timedelta

from app.services.scanner import latest_completed_day


def bars(breakout=True):
    values = (
        [45 + i * 0.025 for i in range(140)]
        + [48.5 + i * 3.5 for i in range(1, 11)]
        + [82 + i * 0.1 for i in range(24)]
        + [90 if breakout else 84.5]
    )
    dates, day = [], latest_completed_day()
    while len(dates) < len(values):
        if day.weekday() < 5:
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
        return bars()
