from pathlib import Path
from typing import Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
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
        env_prefix="BREAKOUT_", env_file=".env", extra="ignore", populate_by_name=True
    )
    database_path: Path = (
        Path(__file__).resolve().parents[3] / "data" / "private" / "breakout.sqlite"
    )
    allowed_origins: str = "http://192.168.1.22,http://127.0.0.1:5173"
    broker_host: str = Field(
        default="127.0.0.1",
        validation_alias=AliasChoices("BREAKOUT_BROKER_HOST", "IBKR_HOST"),
    )
    broker_port: int = Field(
        default=4002,
        ge=1,
        le=65535,
        validation_alias=AliasChoices("BREAKOUT_BROKER_PORT", "IBKR_PORT"),
    )
    broker_client_id: int = Field(
        default=109,
        ge=1,
        validation_alias=AliasChoices("BREAKOUT_BROKER_CLIENT_ID", "IBKR_CLIENT_ID"),
    )
    read_only: Literal[True] = Field(default=True, validation_alias="IBKR_READ_ONLY")
    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    app_host: str = Field(default="0.0.0.0", validation_alias="APP_HOST")
    app_port: int = Field(default=8000, ge=1, le=65535, validation_alias="APP_PORT")
    default_currency: str = Field(
        default="USD", pattern=r"^[A-Z]{3}$", validation_alias="DEFAULT_CURRENCY"
    )
    default_exchange: str = Field(
        default="SMART",
        pattern=r"^[A-Z0-9._-]{1,30}$",
        validation_alias="DEFAULT_EXCHANGE",
    )
    request_interval: float = Field(default=11, ge=0)
    request_limit: int = Field(default=55, ge=1, le=60)
    pacing_window: float = Field(default=600, gt=0)
    max_attempts: int = Field(default=3, ge=1, le=6)
    backoff_base: float = Field(default=2, ge=0)
    backoff_cap: float = Field(default=30, ge=0)
    request_timeout: float = Field(default=45, gt=0)
    connect_timeout: float = Field(default=8, gt=0)

    @field_validator("read_only", mode="before")
    @classmethod
    def enforce_read_only(cls, value):
        return True if str(value).lower() in {"true", "1"} else value

    @model_validator(mode="after")
    def local_database(self):
        if self.database_url:
            if not self.database_url.startswith("sqlite:///"):
                raise ValueError("DATABASE_URL moet een lokale sqlite:/// URL zijn.")
            self.database_path = Path(
                self.database_url.removeprefix("sqlite:///")
            ).resolve()
        return self

    def default_broker(self):
        return BrokerSettings(
            host=self.broker_host,
            port=self.broker_port,
            client_id=self.broker_client_id,
        )
