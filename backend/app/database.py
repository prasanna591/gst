import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

FROZEN = getattr(sys, "frozen", False)


def data_dir() -> Path:
    base = os.getenv("APPDATA") or str(Path.home())
    folder = Path(base) / "GSTClientApp"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


if FROZEN:
    # Packaged app: always use a local SQLite file, ignore any .env
    DATABASE_URL = f"sqlite:///{(data_dir() / 'gst_client.db').as_posix()}"
else:
    # Development: use .env (PostgreSQL), or fall back to SQLite
    DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{(data_dir() / 'gst_client.db').as_posix()}"

is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=not is_sqlite,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def check_database():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))