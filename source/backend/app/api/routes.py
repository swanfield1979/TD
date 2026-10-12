import asyncio

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

from ..analysis.leadership import select_leaders
from ..core.settings import BrokerSettings
from ..schemas.scanner import AnalysisConfig, SyncRequest
from ..services.universe import parse_universe

router = APIRouter(prefix="/api")


@router.get("/health", summary="Proces- en databasegezondheid")
def health(request: Request):
    request.app.state.repo.get("health")
    return {"status": "ok", "version": "0.29.0", "readOnly": True, "storage": "sqlite"}


@router.get(
    "/broker/status", summary="Publieke brokerstatus zonder rekening- of sessiegegevens"
)
def broker_status(request: Request):
    return request.app.state.broker.public_status()


@router.post(
    "/broker/connect",
    status_code=202,
    summary="Read-only TWS-/Gateway-verbinding starten",
)
async def connect(request: Request):
    app = request.app.state
    if app.connect_task and not app.connect_task.done():
        return app.broker.public_status()

    async def attempt():
        try:
            await app.broker.request(lambda: asyncio.sleep(0))
        except Exception:
            pass  # sanitized connection state is already reported by adapter

    app.connect_task = asyncio.create_task(attempt())
    return dict(app.broker.public_status(), state="connecting")


@router.post("/broker/disconnect", summary="Aanvragen annuleren en socket sluiten")
async def disconnect(request: Request):
    app = request.app.state
    if app.connect_task and not app.connect_task.done():
        app.connect_task.cancel()
        await asyncio.gather(app.connect_task, return_exceptions=True)
    await app.scanner.cancel()
    await app.broker.disconnect()
    return app.broker.public_status()


@router.get("/settings", summary="Scanner- en verbindingsinstellingen")
def settings(request: Request):
    app = request.app.state
    return {
        "broker": app.broker.config.model_dump(),
        "analysis": app.scanner.config.model_dump(),
        "readOnly": True,
        "pacing": {
            "intervalSeconds": app.settings.request_interval,
            "maxRequests": app.settings.request_limit,
            "windowSeconds": app.settings.pacing_window,
        },
    }


@router.put(
    "/settings/broker",
    summary="Verbindingsinstellingen opslaan; opnieuw verbinden vereist",
)
async def save_broker(configuration: BrokerSettings, request: Request):
    app = request.app.state
    if app.scanner.busy() or app.connect_task and not app.connect_task.done():
        raise HTTPException(409, "Stop eerst de synchronisatie/verbinding.")
    await app.broker.disconnect()
    app.broker.config = configuration
    app.repo.put("broker", configuration.model_dump())
    await app.scanner.recalculate()
    app.repo.put("scan", app.scanner.state)
    return configuration


@router.put(
    "/settings/analysis",
    summary="Geverifieerde detectieconfiguratie bewaren en cache analyseren",
)
async def save_analysis(configuration: AnalysisConfig, request: Request):
    app = request.app.state
    if app.scanner.busy():
        raise HTTPException(409, "Stop eerst de synchronisatie.")
    app.scanner.config = configuration
    app.repo.put("analysis", configuration.model_dump())
    await app.scanner.recalculate()
    app.repo.put("scan", app.scanner.state)
    return configuration


@router.get(
    "/universe", summary="Actieve aandelen inclusief contract-ID en symbolfouten"
)
def universe(request: Request):
    return [
        {
            "id": i.id,
            "symbol": i.symbol,
            "exchange": i.exchange,
            "currency": i.currency,
            "company": i.company,
            "sector": i.sector,
            "conId": i.con_id,
            "lastError": i.last_error,
            "syncedAt": i.synced_at,
            "corporateActionReview": i.corporate_action_review,
        }
        for i in request.app.state.repo.universe()
    ]


@router.post("/universe/upload", summary="CSV met symbol/exchange/currency importeren")
async def upload(
    request: Request, file: UploadFile = File(...), replace: bool = Query(False)
):
    app = request.app.state
    if app.scanner.busy():
        raise HTTPException(409, "Stop eerst de synchronisatie.")
    contents = await file.read(1_000_001)
    if len(contents) > 1_000_000:
        raise HTTPException(413, "CSV maximaal 1 MB.")
    try:
        rows = parse_universe(contents.decode("utf-8-sig"))
    except (ValueError, UnicodeError) as error:
        raise HTTPException(422, str(error)) from None
    app.repo.import_universe(rows, replace)
    await app.scanner.recalculate()
    app.repo.put("scan", app.scanner.state)
    return {"imported": len(rows), "total": len(app.repo.universe())}


@router.get("/breakout", summary="Scanstatus en resultaten uit lokale cache")
def state(request: Request):
    return request.app.state.scanner.public_state()


@router.post(
    "/breakout",
    status_code=202,
    summary="Cache-first incrementele universumsynchronisatie",
)
@router.post(
    "/sync",
    status_code=202,
    summary="Synchronisatie starten; retry_failed/force_refresh optioneel",
)
async def start(payload: SyncRequest, request: Request):
    try:
        await request.app.state.scanner.prepare(payload)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
    except Exception:
        raise HTTPException(
            502, "Universum niet bereikbaar; gebruik een eigen CSV."
        ) from None
    return request.app.state.scanner.public_state()


@router.post("/breakout/cancel", summary="Synchronisatie annuleren; cache behouden")
@router.post("/sync/cancel", summary="Synchronisatie annuleren")
async def cancel(request: Request):
    await request.app.state.scanner.cancel()
    return request.app.state.scanner.public_state()


@router.get(
    "/leaders",
    summary="Cross-sectionele leiders met status-/liquiditeits-/metadatafilters",
)
def leaders(
    request: Request,
    top: int | None = Query(None),
    period: int = Query(0, ge=0, le=2),
    status: str | None = None,
    min_price: float = Query(0, ge=0),
    min_dollar_volume: float = Query(0, ge=0),
    exchange: str | None = None,
    sector: str | None = None,
):
    if top not in [None, 1, 2, 5]:
        raise HTTPException(422, "Top moet 1, 2, 5 of leeg zijn.")
    if status not in [
        None,
        "forming",
        "ready",
        "breakout",
        "failed",
        "insufficient_data",
    ]:
        raise HTTPException(422, "Onbekende setupstatus.")
    rows = select_leaders(request.app.state.scanner.state["rows"], top, period)
    return [
        r
        for r in rows
        if (status is None or r["status"] == status)
        and (r["close"] or 0) >= min_price
        and (
            not min_dollar_volume
            or r["averageDollarVolume"] is not None
            and r["averageDollarVolume"] >= min_dollar_volume
        )
        and (exchange is None or r["exchange"] == exchange)
        and (sector is None or r["sector"] == sector)
    ]
