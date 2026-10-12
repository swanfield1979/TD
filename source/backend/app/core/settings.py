from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class BrokerSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    application: Literal["gateway", "tws"] = "gateway"
    mode: Literal["paper", "live"] = "paper"
    host: str = Field(default="127.0.0.1", min_length=1, max_length=255)
    port: int = Field(default=4002, ge=1, le=65535)
    client_id: int = Field(default=109, ge=1, le=2_000_000_000)
    delayed_data: bool = True
    what_to_show: Literal["TRADES", "ADJUSTED_LAST"] = "TRADES"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BREAKOUT_", env_file=".env", extra="ignore"
    )
    database_path: Path = (
        Path(__file__).resolve().parents[3] / "data" / "private" / "breakout.sqlite"
    )
    allowed_origins: str = "http://192.168.1.22,http://127.0.0.1:5173"
    broker_host: str = "127.0.0.1"
    broker_port: int = 4002
    broker_client_id: int = 109
    request_interval: float = Field(default=11, ge=0)
    request_limit: int = Field(default=55, ge=1, le=60)
    pacing_window: float = Field(default=600, gt=0)
    max_attempts: int = Field(default=3, ge=1, le=6)
    backoff_base: float = Field(default=2, ge=0)
    backoff_cap: float = Field(default=30, ge=0)
    request_timeout: float = Field(default=45, gt=0)
    connect_timeout: float = Field(default=8, gt=0)

    def default_broker(self):
        return BrokerSettings(
            host=self.broker_host,
            port=self.broker_port,
            client_id=self.broker_client_id,
        )
