import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .api.routes import router
from .broker.client import Broker
from .core.settings import BrokerSettings, Settings
from .db.repository import Repository
from .services.scanner import Scanner


def create_app(settings=None, broker_factory=Broker):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        repo = Repository(settings.database_path)
        broker = broker_factory(
            settings,
            BrokerSettings.model_validate(
                repo.get("broker", settings.default_broker().model_dump())
            ),
        )
        app.state.repo, app.state.broker, app.state.settings = repo, broker, settings
        app.state.scanner, app.state.connect_task = Scanner(repo, broker), None
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
        version="0.29.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    @app.middleware("http")
    async def safety_headers(request: Request, call_next):
        if request.method not in ["GET", "HEAD", "OPTIONS"]:
            if (
                request.headers.get("origin") not in settings.allowed_origins.split(",")
                or request.headers.get("x-requested-with") != "trading-monitor"
            ):
                return JSONResponse(
                    {"detail": "Ongeldige origin of aanvraagheader."}, status_code=403
                )
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.include_router(router)
    return app


app = create_app()
