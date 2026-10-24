import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.settings import Settings
from app.main import create_app
from .fixtures import FakeBroker
from .test_cache_api import HEADERS


@pytest.mark.parametrize("method", ["GET", "POST"])
@pytest.mark.parametrize("path", ["martin-scan", "put-spreads", "put-spreads/stop"])
def test_scanner_proxy_forwards_to_node(tmp_path, monkeypatch, method, path):
    captured = {}

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def request(self, request_method, url, **kwargs):
            captured.update(method=request_method, url=url, **kwargs)
            return httpx.Response(202 if method == "POST" else 200, json={"state": "running", "symbols": ["NVDA"], "report": None})

    monkeypatch.setattr("app.main.httpx.AsyncClient", FakeClient)
    app = create_app(Settings(database_path=tmp_path / "proxy.sqlite"), FakeBroker)
    with TestClient(app) as client:
        response = client.request(method, f"/api/{path}", headers=HEADERS, content='{"symbols":"NVDA"}')
    assert response.status_code == (202 if method == "POST" else 200)
    assert response.json()["state"] == "running"
    assert captured["url"] == f"http://127.0.0.1:8787/api/{path}"
    assert captured["method"] == method
    assert captured["content"] == b'{"symbols":"NVDA"}'
