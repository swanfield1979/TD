"""Freeze the scanner calendar; tests behave identically on future run dates."""

from datetime import UTC, datetime

import pytest


class FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        value = datetime(2026, 10, 12, 12, tzinfo=UTC)
        return value.astimezone(tz) if tz else value.replace(tzinfo=None)


@pytest.fixture(autouse=True)
def fixed_scanner_clock(monkeypatch):
    monkeypatch.setattr("app.services.scanner.datetime", FixedDateTime)
