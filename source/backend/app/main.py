import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
import httpx

from .api.routes import router
from .broker.client import Broker
from .core.settings import BrokerSettings, Settings
from .db.repository import Repository
from .services.scanner import Scanner
from .schemas.scanner import PacingSettings


def create_app(settings=None, broker_factory=Broker):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        repo = Repository(settings.database_path)
        pacing = repo.get("pacing")
        if pacing:
            p = PacingSettings.model_validate(pacing)
            (
                settings.request_interval,
                settings.request_limit,
                settings.pacing_window,
            ) = p.intervalSeconds, p.maxRequests, p.windowSeconds
        broker = broker_factory(
            settings,
            BrokerSettings.model_validate(
                repo.get("broker", settings.default_broker().model_dump())
            ),
        )
        app.state.repo, app.state.broker, app.state.settings = repo, broker, settings
        app.state.scanner, app.state.connect_task = (
            Scanner(repo, broker, settings),
            None,
        )
        monitor = (
            asyncio.create_task(broker.maintain_connection())
            if hasattr(broker, "maintain_connection")
            else None
        )
        await app.state.scanner.recalculate()
        try:
            yield
        finally:
            if monitor:
                monitor.cancel()
                await asyncio.gather(monitor, return_exceptions=True)
            if app.state.connect_task and not app.state.connect_task.done():
                app.state.connect_task.cancel()
                await asyncio.gather(app.state.connect_task, return_exceptions=True)
            await app.state.scanner.close()
            repo.close()

    app = FastAPI(
        title="Breakout · Read-only IBKR-scanner",
        version="0.30.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    @app.exception_handler(HTTPException)
    async def readable_error(request, error):
        return JSONResponse(
            {
                "detail": error.detail,
                "error": {"code": f"http_{error.status_code}", "message": error.detail},
            },
            status_code=error.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request, error):
        fields = [
            {
                "field": ".".join(map(str, e["loc"])),
                "message": "Ongeldige waarde; controleer het formaat en de toegestane grenzen.",
            }
            for e in error.errors()
        ]
        return JSONResponse(
            {
                "detail": "Ongeldige invoer. Controleer de aangegeven velden.",
                "error": {
                    "code": "validation_error",
                    "message": "Ongeldige invoer.",
                    "fields": fields,
                },
            },
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        return JSONResponse(
            {
                "detail": "Interne fout; bestaande cached data blijft behouden.",
                "error": {
                    "code": "internal_error",
                    "message": "Interne fout; controleer het serverlog.",
                },
            },
            status_code=500,
        )

    @app.middleware("http")
    async def safety_headers(request: Request, call_next):
        if request.method not in ["GET", "HEAD", "OPTIONS"]:
            if (
                request.headers.get("origin") not in settings.allowed_origins.split(",")
                or request.headers.get("x-requested-with") != "trading-monitor"
            ):
                return JSONResponse(
                    {
                        "detail": "Ongeldige origin of aanvraagheader.",
                        "error": {
                            "code": "forbidden_origin",
                            "message": "Ongeldige origin of aanvraagheader.",
                        },
                    },
                    status_code=403,
                )
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.include_router(router)

    # Single-origin LAN production host. Existing portfolio endpoints retain their Node service.
    @app.api_route(
        "/api/{legacy_path:path}",
        methods=["GET", "POST", "PUT", "DELETE"],
        include_in_schema=False,
    )
    async def legacy_api(legacy_path: str, request: Request):
        if legacy_path.split("/")[0] not in {"ibkr", "scans", "iv-scan", "leaps", "put-spreads", "martin-scan"}:
            raise HTTPException(404, "API-route niet gevonden.")
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                result = await client.request(
                    request.method,
                    f"http://127.0.0.1:8787/api/{legacy_path}",
                    params=request.query_params,
                    content=await request.body(),
                    headers={
                        k: v
                        for k, v in request.headers.items()
                        if k.lower() in {"origin", "x-requested-with", "content-type"}
                    },
                )
            return Response(
                result.content,
                status_code=result.status_code,
                media_type=result.headers.get("content-type"),
            )
        except httpx.HTTPError:
            raise HTTPException(502, "Portefeuille-API niet bereikbaar.") from None

    dist = Path(__file__).resolve().parents[2] / "dist"
    if dist.is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
        app.mount("/data", StaticFiles(directory=dist / "data"), name="data")

        @app.get("/{page_path:path}", include_in_schema=False)
        async def frontend(page_path: str):
            return FileResponse(dist / "index.html")

    return app


app = create_app()
