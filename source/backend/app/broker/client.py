import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from ib_async import IB, Contract, Stock
from ib_async.ib import StartupFetch

from ..schemas.scanner import DailyBar
from .pacing import Pacer

logging.getLogger("ib_async").setLevel(logging.CRITICAL)


class BrokerError(Exception):
    def __init__(self, message, retryable=True):
        super().__init__(message)
        self.retryable = retryable


class Broker:
    def __init__(self, settings, configuration, ib=None):
        self.settings, self.config = settings, configuration
        self.ib = ib or IB()
        self.ib.RaiseRequestErrors = True
        self.pacer = Pacer(
            settings.request_interval, settings.request_limit, settings.pacing_window
        )
        self.lock = asyncio.Lock()
        self.state, self.message = "disconnected", "IBKR-scanner niet verbonden."
        self.retry_count = 0
        self.historical_requests = set()
        self.want_connected = False
        self.generation = 0
        self.ib.disconnectedEvent += self._disconnected
        self.ib.errorEvent += self._error

    def _disconnected(self, *_):
        self.state = "reconnecting" if self.want_connected else "disconnected"
        self.message = (
            "Verbinding verbroken; de volgende aanvraag probeert opnieuw."
            if self.want_connected
            else "IBKR-scanner niet verbonden."
        )

    def _error(self, req_id, code, *_):
        if code in [1100, 1300]:
            self._disconnected()
        elif code in [1101, 1102]:
            self.state, self.message = "connected", "IBKR-verbinding hersteld."

    def public_status(self):
        return dict(
            state=self.state,
            message=self.message,
            connected=self.ib.isConnected(),
            mode=self.config.mode,
            readOnly=True,
            delayedDataRequested=self.config.delayed_data,
            retries=self.retry_count,
            # No account, session identifier, credential, or raw broker error is returned.
            safetyLabel="Read-only — geen orderuitvoering",
        )

    async def connect(self):
        self.want_connected = True
        async with self.lock:
            if self.ib.isConnected():
                return
            self.state, self.message = "connecting", "Verbinden met TWS / IB Gateway."
            try:
                await self.ib.connectAsync(
                    self.config.host,
                    self.config.port,
                    clientId=self.config.client_id,
                    timeout=self.settings.connect_timeout,
                    readonly=True,
                    fetchFields=StartupFetch(0),
                )
                self.ib.reqMarketDataType(3 if self.config.delayed_data else 1)
                self.state, self.message = (
                    "connected",
                    "IBKR-marktdataverbinding actief.",
                )
            except asyncio.CancelledError:
                self.ib.disconnect()
                raise
            except Exception:
                self.ib.disconnect()
                self.state, self.message = (
                    "error",
                    "TWS / IB Gateway niet bereikbaar; controleer paper/live-poort, API-toegang en uniek client-ID.",
                )
                raise BrokerError(self.message) from None

    async def disconnect(self):
        self.want_connected = False
        self.generation += 1
        # Actively cancel every outstanding historical request before closing the socket.
        for req_id in list(self.historical_requests):
            self.ib.client.cancelHistoricalData(req_id)
        self.ib.disconnect()
        self.state, self.message = "disconnected", "IBKR-scanner losgekoppeld."

    async def request(self, operation, pacing_key=None):
        generation = self.generation
        for attempt in range(self.settings.max_attempts):
            if generation != self.generation:
                raise BrokerError(
                    "Verbinding bewust gesloten; aanvraag geannuleerd.", False
                )
            try:
                if not self.ib.isConnected():
                    await self.connect()
                await self.pacer.wait(pacing_key)
                result = await asyncio.wait_for(
                    operation(), timeout=self.settings.request_timeout
                )
                self.state, self.message = (
                    "connected",
                    "IBKR-marktdataverbinding actief.",
                )
                return result
            except asyncio.CancelledError:
                raise
            except Exception as error:
                if generation != self.generation:
                    raise BrokerError(
                        "Verbinding bewust gesloten; aanvraag geannuleerd.", False
                    ) from None
                code = getattr(error, "code", getattr(error, "errorCode", None))
                if (
                    code in [354, 10167, 10168]
                    or code == 162
                    and any(
                        x in str(error).lower()
                        for x in ["permission", "subscription", "not subscribed"]
                    )
                ):
                    raise BrokerError(
                        "Marktdatasubscriptie ontbreekt. Vertraagde data is aangevraagd indien toegestaan, maar IBKR levert hiermee niet automatisch historische rechten.",
                        False,
                    ) from None
                if isinstance(error, BrokerError) and not error.retryable:
                    raise
                if code in [200, 321]:
                    raise BrokerError(
                        "Geen eenduidig aandelencontract gevonden; controleer beurs, valuta en ticker.",
                        False,
                    ) from None
                if attempt + 1 >= self.settings.max_attempts:
                    message = (
                        "IBKR pacinglimiet bereikt; probeer later opnieuw."
                        if code == 162
                        else "IBKR-aanvraag mislukt na begrensde retries; controleer verbinding en datatoegang."
                    )
                    raise BrokerError(message) from None
                self.retry_count += 1
                self.state, self.message = (
                    "retrying",
                    "Aanvraag opnieuw proberen met begrensde wachttijd.",
                )
                await asyncio.sleep(
                    min(
                        self.settings.backoff_cap,
                        self.settings.backoff_base * 2**attempt,
                    )
                )

    async def maintain_connection(self):
        while True:
            await asyncio.sleep(3)
            if (
                self.want_connected
                and self.state == "reconnecting"
                and not self.ib.isConnected()
            ):
                try:
                    await self.request(lambda: asyncio.sleep(0))
                except BrokerError:
                    self.state = "error"
                    self.message = "Automatisch herverbinden mislukt; controleer TWS / Gateway en verbind opnieuw."

    async def resolve(self, instrument):
        contract = Stock(
            instrument.symbol.replace(".", " "),
            "SMART",
            instrument.currency,
            primaryExchange=instrument.exchange
            if instrument.exchange != "SMART"
            else "",
        )
        contracts = await self.request(lambda: self.ib.qualifyContractsAsync(contract))
        if len(contracts) != 1 or not contracts[0].conId:
            raise BrokerError("Geen eenduidig aandelencontract gevonden.", False)
        c = contracts[0]
        return dict(
            conId=c.conId,
            symbol=c.symbol,
            secType="STK",
            exchange="SMART",
            primaryExchange=c.primaryExchange,
            currency=c.currency,
        )

    async def history(self, contract_data, duration, kind):
        async def operation():
            # Explicit request lifecycle adds cancellation missing from the wrapper's one-shot helper.
            contract = Contract(**contract_data)
            req_id = self.ib.client.getReqId()
            self.historical_requests.add(req_id)
            future = self.ib.wrapper.startReq(req_id, contract)
            try:
                self.ib.client.reqHistoricalData(
                    req_id, contract, "", duration, "1 day", kind, True, 1, False, []
                )
                bars = await future
            finally:
                self.ib.client.cancelHistoricalData(req_id)
                self.ib.wrapper._endReq(req_id)
                self.historical_requests.discard(req_id)
            if not bars:
                raise BrokerError("Geen dagelijkse historie ontvangen.")
            today = datetime.now(ZoneInfo("America/New_York")).date()
            output = []
            for b in bars:
                day = b.date.date() if isinstance(b.date, datetime) else b.date
                if day >= today:
                    continue
                output.append(
                    DailyBar(
                        date=day,
                        open=b.open,
                        high=b.high,
                        low=b.low,
                        close=b.close,
                        volume=b.volume if b.volume >= 0 else None,
                    ).model_dump(mode="json")
                )
            if not output:
                raise BrokerError("Geen afgesloten dagcandles ontvangen.")
            self.state, self.message = "connected", "IBKR-marktdataverbinding actief."
            return output

        try:
            return await self.request(
                operation, pacing_key=(contract_data["conId"], duration, kind)
            )
        except asyncio.CancelledError:
            for req_id in list(self.historical_requests):
                self.ib.client.cancelHistoricalData(req_id)
            raise
