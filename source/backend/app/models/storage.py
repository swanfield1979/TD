from sqlalchemy import (
    JSON,
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Instrument(Base):
    __tablename__ = "instruments"
    __table_args__ = (UniqueConstraint("symbol", "exchange", "currency"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20))
    exchange: Mapped[str] = mapped_column(String(30))
    currency: Mapped[str] = mapped_column(String(3))
    company: Mapped[str] = mapped_column(String(250), default="")
    sector: Mapped[str] = mapped_column(String(100), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    con_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contract: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    synced_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    corporate_action_review: Mapped[bool] = mapped_column(Boolean, default=False)


class Bar(Base):
    __tablename__ = "daily_bars"
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String(20), primary_key=True)
    date: Mapped[str] = mapped_column(String(10), primary_key=True)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float | None] = mapped_column(Float, nullable=True)


class Value(Base):
    __tablename__ = "settings_and_results"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
