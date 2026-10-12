"""Data-only broker contract. No order or trading operations are defined."""

from typing import Any, Protocol

from ..core.settings import BrokerSettings


class MarketDataBroker(Protocol):
    config: BrokerSettings

    def public_status(self) -> dict[str, Any]: ...
    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...
    async def resolve(self, instrument: Any) -> dict[str, Any]: ...
    async def history(
        self, contract_data: dict[str, Any], duration: str, kind: str
    ) -> list[dict[str, Any]]: ...
