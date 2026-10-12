from datetime import UTC, datetime

from sqlalchemy import create_engine, delete, event, select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import sessionmaker

from ..models.storage import Bar, Base, Instrument, Value


class Repository:
    def __init__(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(
            f"sqlite:///{path.as_posix()}",
            connect_args={"check_same_thread": False, "timeout": 30},
        )

        @event.listens_for(self.engine, "connect")
        def configure(connection, _):
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(self.engine, expire_on_commit=False)

    def get(self, key, default=None):
        with self.session() as db:
            row = db.get(Value, key)
            return row.payload if row else default

    def put(self, key, payload):
        with self.session.begin() as db:
            db.merge(Value(key=key, payload=payload))

    def universe(self, failed_only=False):
        with self.session() as db:
            query = select(Instrument).where(Instrument.active.is_(True))
            if failed_only:
                query = query.where(Instrument.last_error.is_not(None))
            return list(
                db.scalars(
                    query.order_by(
                        Instrument.symbol, Instrument.exchange, Instrument.currency
                    )
                )
            )

    def import_universe(self, rows, replace=False):
        with self.session.begin() as db:
            if replace:
                db.execute(update(Instrument).values(active=False))
            for row in rows:
                stmt = insert(Instrument).values(
                    **row, active=True, corporate_action_review=False
                )
                db.execute(
                    stmt.on_conflict_do_update(
                        index_elements=["symbol", "exchange", "currency"],
                        set_={
                            "active": True,
                            "company": row["company"],
                            "sector": row["sector"],
                        },
                    )
                )

    def update_instrument(self, instrument_id, **fields):
        with self.session.begin() as db:
            db.execute(
                update(Instrument)
                .where(Instrument.id == instrument_id)
                .values(**fields)
            )

    def bars(self, instrument_id, kind):
        with self.session() as db:
            rows = db.scalars(
                select(Bar)
                .where(Bar.instrument_id == instrument_id, Bar.kind == kind)
                .order_by(Bar.date)
            )
            return [
                {
                    key: getattr(b, key)
                    for key in ["date", "open", "high", "low", "close", "volume"]
                }
                for b in rows
            ]

    def store_bars(self, instrument_id, kind, bars, full=False):
        # Transactional upsert only AFTER entire response validation; never delete cached data on failure.
        existing = {b["date"]: b for b in self.bars(instrument_id, kind)}
        revised = any(
            b["date"] in existing
            and abs(b["close"] / existing[b["date"]]["close"] - 1) > 0.05
            for b in bars
        )
        with self.session.begin() as db:
            if full:
                db.execute(
                    delete(Bar).where(
                        Bar.instrument_id == instrument_id, Bar.kind == kind
                    )
                )
            for row in bars:
                stmt = insert(Bar).values(instrument_id=instrument_id, kind=kind, **row)
                db.execute(
                    stmt.on_conflict_do_update(
                        index_elements=["instrument_id", "kind", "date"], set_=row
                    )
                )
            db.execute(
                update(Instrument)
                .where(Instrument.id == instrument_id)
                .values(
                    last_error=None,
                    synced_at=datetime.now(UTC).isoformat(),
                    corporate_action_review=False
                    if full
                    else revised
                    or db.get(Instrument, instrument_id).corporate_action_review,
                )
            )
        return revised

    def close(self):
        self.engine.dispose()
