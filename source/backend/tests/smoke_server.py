"""Explicit test-only ASGI target for Playwright. Never imported by app.main."""

import tempfile
from pathlib import Path

from app.core.settings import Settings
from app.main import create_app

from .fixtures import FakeBroker

test_data = tempfile.TemporaryDirectory(prefix="breakout-smoke-")
app = create_app(
    Settings(database_path=Path(test_data.name) / "smoke.sqlite"), FakeBroker
)


@app.middleware("http")
async def identify_test_server(request, call_next):
    response = await call_next(request)
    response.headers["X-Breakout-Test"] = "true"
    return response
