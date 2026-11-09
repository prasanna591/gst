import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()


def _load_secret_key() -> str:
    # Development: use SECRET_KEY from .env if present
    env_key = os.getenv("SECRET_KEY")
    if env_key and not getattr(sys, "frozen", False):
        return env_key

    # Packaged app: create a random key once and keep it on this PC
    base = os.getenv("APPDATA") or str(Path.home())
    folder = Path(base) / "GSTClientApp"
    folder.mkdir(parents=True, exist_ok=True)
    key_file = folder / "secret.key"
    if key_file.exists():
        return key_file.read_text().strip()
    key = secrets.token_hex(32)
    key_file.write_text(key)
    return key


SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"
TOKEN_HOURS = 8


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
