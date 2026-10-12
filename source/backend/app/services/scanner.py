import asyncio
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from ..analysis.leadership import analyze, rank
from ..core.calendar import HOLIDAYS
from ..schemas.scanner import AnalysisConfig, DailyBar
from .universe import parse_universe


def latest_completed_day(now=None):
    current = (now or datetime.now(ZoneInfo("America/New_York"))).date() - timedelta(
        days=1
    )
    while current.weekday() >= 5 or current.isoformat() in HOLIDAYS:
        current -= timedelta(days=1)
    return current


def incremental_duration(cached, target, force=False):
    if not cached or force:
        return "3 Y"
    last = date.fromisoformat(cached[-1]["date"])
    if last >= target:
        return None
    # Two calendar days overlap to detect revised split-adjusted prices. No full repeat history.
    return f"{max(3, (target - last).days + 2)} D"


class Scanner:
    def __init__(self, repository, broker, settings=None):
        self.repo, self.broker = repository, broker
        self.settings = settings
        self.config = AnalysisConfig.model_validate(repository.get("analysis", {}))
        self.state = repository.get("scan", self.empty())
        if self.state["state"] == "running":
            self.state.update(
                state="interrupted",
                message="Vorige synchronisatie onderbroken; cache behouden.",
            )
        self.task = None
        self.launch_lock = asyncio.Lock()

    def empty(self):
        return dict(
            state="idle",
            rows=[],
            warnings=[],
            progress=0,
            total=0,
            config=self.config.model_dump(),
            universe="custom",
            symbols="",
            source="IBKR · SQLite-cache · afgesloten RTH-dagcandles",
        )

    def busy(self):
        return (
            self.state["state"] == "running"
            or self.task is not None
            and not self.task.done()
        )

    def public_state(self):
        return dict(
            self.state,
            rows=[] if self.busy() else self.state["rows"],
            broker=self.broker.public_status(),
            safetyLabel="Read-only — geen orderuitvoering",
            dataMode="demo"
            if getattr(self.broker, "is_demo", False)
            else "cached_ibkr",
            dataLabel="DEMO — testdata, geen IBKR-data"
            if getattr(self.broker, "is_demo", False)
            else "Cached IBKR · dagelijkse historie",
            lastSuccessfulSyncAt=self.repo.get("last_successful_sync"),
            lastDataUpdateAt=max(
                (i.synced_at for i in self.repo.universe() if i.synced_at), default=None
            ),
            sufficientSymbols=sum(
                r["status"] != "insufficient_data" for r in self.state["rows"]
            ),
            filters=self.repo.get(
                "filters", {"minimumPrice": 0, "minimumAverageDollarVolume": 0}
            ),
        )

    async def prepare(self, request):
        async with self.launch_lock:
            if self.busy():
                return
            self.state = dict(
                self.empty(), state="running", startedAt=datetime.now(UTC).isoformat()
            )
            try:
                await self._prepare(request)
            except Exception:
                self.state.update(
                    state="error",
                    message="Synchronisatie kon niet starten; controleer universum en configuratie.",
                )
                self.repo.put("scan", self.state)
                raise

    async def _prepare(self, request):
        if request.config:
            self.config = request.config
            self.repo.put("analysis", self.config.model_dump())
        if request.universe == "sp500":
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
                )
                response.raise_for_status()
            import csv
            import io

            members = list(csv.DictReader(io.StringIO(response.text)))
            if len(members) < 400:
                raise ValueError("S&P 500-ledenlijst onvolledig.")
            rows = [
                dict(
                    symbol=m["Symbol"],
                    exchange="SMART",
                    currency="USD",
                    company=m.get("Security", ""),
                    sector=m.get("GICS Sector", ""),
                )
                for m in members
            ]
            self.repo.import_universe(rows, replace=True)
        elif request.symbols is not None:
            symbols = sorted(
                set(
                    request.symbols.upper()
                    .replace(";", ",")
                    .replace("\n", ",")
                    .split(",")
                )
            )
            rows = parse_universe(
                "symbol,exchange,currency\n"
                + "\n".join(
                    f"{s.strip()},{self.settings.default_exchange if self.settings else 'SMART'},{self.settings.default_currency if self.settings else 'USD'}"
                    for s in symbols
                    if s.strip()
                )
            )
            self.repo.import_universe(rows, replace=True)
        universe = self.repo.universe(request.retry_failed)
        if not universe:
            raise ValueError(
                "Geen aandelen om te synchroniseren. Importeer een universum-CSV of kies tickers."
            )
        self.state = dict(
            self.empty(),
            state="running",
            total=len(universe),
            startedAt=datetime.now(UTC).isoformat(),
            source=f"IBKR {self.broker.config.what_to_show} · SQLite-cache · afgesloten RTH-dagcandles",
        )
        self.task = asyncio.create_task(self.run(universe, request.force_refresh))

    async def run(self, universe, force):
        kind = self.broker.config.what_to_show
        target = latest_completed_day()
        try:
            for instrument in universe:
                self.state["currentSymbol"] = instrument.symbol
                cached = self.repo.bars(instrument.id, kind)
                duration = incremental_duration(cached, target, force)
                try:
                    if duration:
                        contract = instrument.contract
                        if not contract:
                            contract = await self.broker.resolve(instrument)
                            self.repo.update_instrument(
                                instrument.id,
                                con_id=contract["conId"],
                                contract=contract,
                            )
                        output = await self.broker.history(contract, duration, kind)
                        # Validate complete response before committing anything.
                        bars = [
                            DailyBar.model_validate(b).model_dump(mode="json")
                            for b in output
                            if date.fromisoformat(b["date"]) <= target
                        ]
                        if not bars or len({b["date"] for b in bars}) != len(bars):
                            raise ValueError(
                                "Geen geldige unieke afgesloten dagcandles ontvangen."
                            )
                        if (
                            force
                            and len(cached) >= max(self.config.periods) + 1
                            and len(bars) < max(self.config.periods) + 1
                        ):
                            raise ValueError(
                                "Volledige hercontrole onvolledig; bestaande cache behouden."
                            )
                        self.repo.store_bars(instrument.id, kind, bars, full=force)
                        new = [
                            b
                            for b in sorted(bars, key=lambda b: b["date"])
                            if cached and b["date"] > cached[-1]["date"]
                        ]
                        if (
                            not force
                            and new
                            and abs(new[0]["close"] / cached[-1]["close"] - 1) > 0.45
                        ):
                            self.repo.update_instrument(
                                instrument.id, corporate_action_review=True
                            )
                            self.state["warnings"].append(
                                f"{instrument.symbol}: grote koerssprong; controleer corporate action en vraag volledige hercontrole aan."
                            )
                    else:
                        self.repo.update_instrument(instrument.id, last_error=None)
                except asyncio.CancelledError:
                    raise
                except Exception as error:
                    # Broker adapter emits sanitized errors, not account/session details.
                    message = (
                        str(error)[:500]
                        if isinstance(error, (ValueError,))
                        or error.__class__.__name__ == "BrokerError"
                        else "Synchronisatie mislukt; cache behouden."
                    )
                    self.repo.update_instrument(instrument.id, last_error=message)
                    self.state["warnings"].append(
                        f"{instrument.symbol} ({instrument.exchange}/{instrument.currency}): {message}"
                    )
                self.state["progress"] += 1
            self.state["state"] = "partial" if self.state["warnings"] else "complete"
        except asyncio.CancelledError:
            self.state["state"] = "cancelled"
        finally:
            self.state["currentSymbol"] = None
            finalizer = asyncio.create_task(self.finalize(target))
            try:
                await asyncio.shield(finalizer)
            except asyncio.CancelledError:
                self.state["state"] = "cancelled"
                await finalizer

    async def finalize(self, target):
        await self.recalculate(target)
        self.state["finishedAt"] = datetime.now(UTC).isoformat()
        if self.state["state"] == "complete":
            self.repo.put("last_successful_sync", self.state["finishedAt"])
        self.repo.put("scan", self.state)

    async def recalculate(self, target=None):
        target = target or latest_completed_day()
        entries = self.repo.universe()
        kind = self.broker.config.what_to_show
        rows = []
        for item in entries:
            bars = self.repo.bars(item.id, kind)
            # Bound CPU work and keep server responsive while analyzing large universes.
            row = await asyncio.to_thread(analyze, item.symbol, bars, self.config)
            missing = []
            if bars and item.currency == "USD":
                present = {b["date"] for b in bars}
                day = date.fromisoformat(
                    bars[max(0, len(bars) - max(self.config.periods) - 1)]["date"]
                )
                last = date.fromisoformat(bars[-1]["date"])
                while day <= last:
                    if (
                        day.weekday() < 5
                        and day.isoformat() not in HOLIDAYS
                        and day.isoformat() not in present
                    ):
                        missing.append(day.isoformat())
                    day += timedelta(days=1)
                if missing:
                    row["status"] = "insufficient_data"
                    row["reasons"].append(
                        f"{len(missing)} verwachte VS-sessies ontbreken; geen betrouwbare leidersrang."
                    )
                    row["returns"] = [
                        None
                        if len(bars) <= p
                        or any(d >= bars[-p - 1]["date"] for d in missing)
                        else value
                        for p, value in zip(self.config.periods, row["returns"])
                    ]
            row["missingSessionDates"] = missing
            row.update(
                id=f"{item.symbol}:{item.exchange}:{item.currency}",
                exchange=item.exchange,
                currency=item.currency,
                company=item.company,
                sector=item.sector,
                lastError=item.last_error,
                corporateActionReview=item.corporate_action_review,
                cacheAvailable=bool(bars),
                lastUpdatedAt=item.synced_at,
                calculatedAt=datetime.now(UTC).isoformat(),
                dataMode="demo"
                if getattr(self.broker, "is_demo", False)
                else "cached_ibkr",
            )
            if item.currency != "USD":
                row["averageDailyTurnover"] = row["averageDollarVolume"]
                row["averageDollarVolume"] = (
                    None  # Never pretend native currency turnover is dollars.
                )
            rows.append(row)
        as_of = max((r["asOf"] for r in rows if r["asOf"]), default=None)
        for row in rows:
            row["stale"] = row["asOf"] != as_of or bool(
                as_of and as_of < target.isoformat()
            )
        self.state.update(
            rows=rank(rows, self.config),
            config=self.config.model_dump(),
            asOf=as_of,
            totalUniverse=len(entries),
            staleSymbols=[r["id"] for r in rows if r["stale"]],
        )

    async def cancel(self):
        if self.task is not None and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)

    async def close(self):
        await self.cancel()
        await self.broker.disconnect()
