from datetime import date
from math import isclose, isfinite
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnalysisConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    periods: list[int] = [21, 63, 126]
    weights: list[float] = [0.4, 0.35, 0.25]
    moveMinSessions: int = Field(default=5, ge=1, le=250)
    moveMaxSessions: int = Field(default=30, ge=1, le=250)
    moveLookback: int = Field(default=63, ge=1, le=250)
    moveMinPct: float = Field(default=30, ge=0, le=1000)
    baseMinSessions: int = Field(default=10, ge=1, le=250)
    baseMaxSessions: int = Field(default=42, ge=1, le=250)
    maxDepthPct: float = Field(default=25, ge=0, lt=100)
    maxBaseAdvancePct: float = Field(default=5, ge=0, le=1000)
    slopeSessions: int = Field(default=5, ge=1, le=250)
    minSlopePct: float = Field(default=0, ge=-100, le=100)
    maxMaDistancePct: float = Field(default=12, ge=0, le=1000)
    requireMa50: bool = False
    swingRadius: int = Field(default=2, ge=1, le=250)
    lowerLowTolerancePct: float = Field(default=2, ge=0, lt=100)
    contractionSessions: int = Field(default=5, ge=1, le=250)
    maxRangeRatio: float = Field(default=0.85, gt=0, le=100)
    maxVolatilityRatio: float = Field(default=0.95, gt=0, le=100)
    readyDistancePct: float = Field(default=5, ge=0, le=100)
    expansionRatio: float = Field(default=1.3, gt=0, le=100)
    requireVolume: bool = False
    volumeRatio: float = Field(default=1.2, gt=0, le=100)
    failureMa20Pct: float = Field(default=8, ge=0, lt=100)

    @model_validator(mode="after")
    def check_windows(self):
        if (
            len(self.periods) != 3
            or self.periods != sorted(set(self.periods))
            or any(p < 1 or p > 500 for p in self.periods)
        ):
            raise ValueError(
                "Drie oplopende momentumperioden van 1–500 sessies vereist."
            )
        if (
            len(self.weights) != 3
            or any(not isfinite(w) or w < 0 for w in self.weights)
            or not isclose(sum(self.weights), 1)
        ):
            raise ValueError("Drie niet-negatieve gewichten met som 1 vereist.")
        if (
            self.moveMinSessions > self.moveMaxSessions
            or self.baseMinSessions > self.baseMaxSessions
            or self.baseMinSessions < 2 * self.contractionSessions
        ):
            raise ValueError("Ongeldige impuls-/consolidatievensters.")
        return self


class DailyBar(BaseModel):
    date: date
    open: float = Field(gt=0, allow_inf_nan=False)
    high: float = Field(gt=0, allow_inf_nan=False)
    low: float = Field(gt=0, allow_inf_nan=False)
    close: float = Field(gt=0, allow_inf_nan=False)
    volume: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def check_range(self):
        if self.high < max(self.open, self.close, self.low) or self.low > min(
            self.open, self.close
        ):
            raise ValueError("Inconsistente OHLC-candle.")
        return self


class SyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    config: AnalysisConfig | None = None
    retry_failed: bool = False
    force_refresh: bool = False
    # Backwards-compatible browser request; universe selection is now durable CSV metadata.
    universe: Literal["custom", "sp500"] | None = None
    symbols: str | None = Field(default=None, max_length=60_000)


class FilterSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    minimumPrice: float = Field(default=0, ge=0, allow_inf_nan=False)
    minimumAverageDollarVolume: float = Field(default=0, ge=0, allow_inf_nan=False)


class PacingSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intervalSeconds: float = Field(default=11, ge=0, allow_inf_nan=False)
    maxRequests: int = Field(default=55, ge=1, le=60)
    windowSeconds: float = Field(default=600, gt=0, allow_inf_nan=False)
    concurrency: Literal[1] = 1
