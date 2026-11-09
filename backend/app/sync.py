import base64, hashlib, json, secrets, shutil, sqlite3, tempfile, threading, time, webbrowser, zipfile
import urllib.error, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Literal
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import SessionLocal, data_dir, engine
from app.google_config import CLIENT_ID, CLIENT_SECRET
from app.models import User

router = APIRouter(prefix="/api/sync", tags=["Sync"], dependencies=[Depends(require_admin)])
public_router = APIRouter(prefix="/api/sync", tags=["Sync"])

DATA = data_dir()
DB_FILE = Path(engine.url.database) if engine.dialect.name == "sqlite" else None
UPLOADS = DATA / "uploads"
TOKEN_FILE = DATA / "google_token.json"
STATE_FILE = DATA / "sync_state.json"
REDIRECT = "http://127.0.0.1:8000/api/sync/google/callback"
SCOPE = "openid email https://www.googleapis.com/auth/drive.appdata"
NAME = "gst-sync.zip"
PENDING: dict[str, str] = {}
STATE_LOCK = threading.Lock()
SYNC_LOCK = threading.Lock()


# ---------- small state file ----------
def _state() -> dict:
    base = {"base_rev": 0, "dirty": False, "changed_at": 0, "version": 0,
            "status": "idle", "error": "", "last_sync": None}
    with STATE_LOCK:
        try:
            base.update(json.loads(STATE_FILE.read_text()))
        except Exception:
            pass
    return base


def _save(**kw):
    s = _state()
    s.update(kw)
    with STATE_LOCK:
        STATE_FILE.write_text(json.dumps(s))


def mark_dirty():
    _save(dirty=True, changed_at=time.time())


# ---------- notice every real data change ----------
if DB_FILE:
    @event.listens_for(Session, "before_commit")
    def _before(session):
        if session.new or session.dirty or session.deleted:
            session.info["changed"] = True

    @event.listens_for(Session, "after_commit")
    def _after(session):
        if session.info.pop("changed", False):
            mark_dirty()


# ---------- Google HTTP (standard library only) ----------
def _call(url, token=None, data=None, headers=None, method=None, raw=False):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Google error {e.code}")
    except Exception:
        raise ConnectionError("offline")
    if raw:
        return body
    return json.loads(body) if body else {}


def _form(url, fields):
    return _call(url, data=urllib.parse.urlencode(fields).encode(),
                 headers={"Content-Type": "application/x-www-form-urlencoded"})


def _tokens() -> dict:
    try:
        return json.loads(TOKEN_FILE.read_text())
    except Exception:
        return {}


def _access_token() -> str:
    t = _tokens()
    if not t.get("refresh_token"):
        raise RuntimeError("Google account is not connected")
    if t.get("expires_at", 0) > time.time() + 60:
        return t["access_token"]
    r = _form("https://oauth2.googleapis.com/token", {
        "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token"})
    t["access_token"] = r["access_token"]
    t["expires_at"] = time.time() + int(r.get("expires_in", 3600))
    TOKEN_FILE.write_text(json.dumps(t))
    return t["access_token"]


# ---------- snapshot and restore ----------
def _snapshot(tmp: Path) -> Path:
    copy = tmp / "gst_client.db"
    src, dst = sqlite3.connect(DB_FILE), sqlite3.connect(copy)
    src.backup(dst); dst.close(); src.close()
    z = tmp / "snapshot.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(copy, "gst_client.db")
        if UPLOADS.exists():
            for f in UPLOADS.rglob("*"):
                if f.is_file():
                    zf.write(f, "uploads/" + f.relative_to(UPLOADS).as_posix())
    return z


def _apply(raw: bytes):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "in.zip"
        p.write_bytes(raw)
        with zipfile.ZipFile(p) as z:
            if "gst_client.db" not in z.namelist():
                raise RuntimeError("The saved data is not valid")
            newdb = Path(d) / "gst_client.db"
            newdb.write_bytes(z.read("gst_client.db"))
            c = sqlite3.connect(newdb)
            c.execute("SELECT COUNT(*) FROM users").fetchone()
            c.close()
            engine.dispose()
            if DB_FILE.exists():
                shutil.copy2(DB_FILE, DATA / "before-sync.db")
            shutil.copy2(newdb, DB_FILE)
            UPLOADS.mkdir(parents=True, exist_ok=True)
            root = UPLOADS.resolve()
            for n in z.namelist():
                if n.startswith("uploads/") and not n.endswith("/"):
                    target = (UPLOADS / n[len("uploads/"):]).resolve()
                    if root in target.parents:
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(z.read(n))


# ---------- Drive file ----------
def _remote(token):
    q = urllib.parse.quote(f"name='{NAME}'")
    r = _call("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + q +
              "&fields=files(id,appProperties,modifiedTime)", token=token)
    files = r.get("files") or []
    return files[0] if files else None


def _rev(f) -> int:
    try:
        return int(((f or {}).get("appProperties") or {}).get("revision", 0))
    except ValueError:
        return 0


def _push(token, remote, rev):
    with tempfile.TemporaryDirectory() as d:
        z = _snapshot(Path(d))
        meta = {"appProperties": {"revision": str(rev), "saved": datetime.now().isoformat(timespec="seconds")}}
        if not remote:
            meta.update(name=NAME, parents=["appDataFolder"])
        b = secrets.token_hex(12)
        body = (f"--{b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{json.dumps(meta)}\r\n"
                f"--{b}\r\nContent-Type: application/zip\r\n\r\n").encode() \
               + z.read_bytes() + f"\r\n--{b}--".encode()
        h = {"Content-Type": f"multipart/related; boundary={b}"}
        base = "https://www.googleapis.com/upload/drive/v3/files"
        if remote:
            _call(f"{base}/{remote['id']}?uploadType=multipart", token=token, data=body, headers=h, method="PATCH")
        else:
            _call(f"{base}?uploadType=multipart", token=token, data=body, headers=h)


def _pull(token, remote):
    raw = _call(f"https://www.googleapis.com/drive/v3/files/{remote['id']}?alt=media", token=token, raw=True)
    _apply(raw)
    _save(base_rev=_rev(remote), dirty=False, version=_state()["version"] + 1)


def sync_now(force=None, manual=False):
    """force: None, 'drive' (take Drive data) or 'local' (overwrite Drive)."""
    if not DB_FILE or not _tokens().get("refresh_token"):
        return _state()
    with SYNC_LOCK:
        try:
            token = _access_token()
            remote = _remote(token)
            rrev, s = _rev(remote), _state()
            started = s["changed_at"]

            if force == "drive":
                if not remote:
                    raise RuntimeError("No saved data was found in this Google account")
                _pull(token, remote)
            elif force == "local":
                _push(token, remote, rrev + 1)
                _save(base_rev=rrev + 1, dirty=False)
            elif rrev > s["base_rev"]:
                if s["dirty"]:
                    _save(status="conflict", error="")
                    return _state()
                _pull(token, remote)
            elif s["dirty"] or not remote:
                if not manual and time.time() - s["changed_at"] < 8:
                    return _state()               # wait for a quiet moment
                _push(token, remote, rrev + 1)
                _save(base_rev=rrev + 1)
                if _state()["changed_at"] == started:
                    _save(dirty=False)
            _save(status="synced", error="", last_sync=datetime.now().strftime("%d %b %Y %H:%M"))
        except ConnectionError:
            _save(status="offline", error="")
        except Exception as exc:
            _save(status="error", error=str(exc))
        return _state()


def _loop():
    while True:
        try:
            sync_now()
        except Exception:
            pass
        time.sleep(30)


def start_sync():
    threading.Thread(target=_loop, daemon=True).start()


# ---------- status ----------
def public_state() -> dict:
    s, t = _state(), _tokens()
    connected = bool(t.get("refresh_token"))
    return {
        "supported": DB_FILE is not None,
        "configured": not CLIENT_ID.startswith("PASTE"),
        "connected": connected,
        "email": t.get("email"),
        "status": s["status"] if connected else "off",
        "pending": bool(s["dirty"]),
        "last_sync": s["last_sync"],
        "version": s["version"],
        "error": s["error"],
    }


@public_router.get("/status")
def status():
    return public_state()


# ---------- Google sign-in ----------
def _start_oauth() -> str:
    if CLIENT_ID.startswith("PASTE"):
        raise HTTPException(500, "Google is not configured in this build")
    verifier, state = secrets.token_urlsafe(64), secrets.token_urlsafe(16)
    PENDING[state] = verifier
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": CLIENT_ID, "redirect_uri": REDIRECT, "response_type": "code", "scope": SCOPE,
        "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
        "access_type": "offline", "prompt": "consent"})
    webbrowser.open(url)
    return url


@public_router.get("/google/callback", response_class=HTMLResponse)
def callback(code: str = "", state: str = "", error: str = ""):
    verifier = PENDING.pop(state, None)
    if error or not code or not verifier:
        return HTMLResponse("<h3>Connection failed. Close this tab and try again in the app.</h3>", 400)
    try:
        r = _form("https://oauth2.googleapis.com/token", {
            "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "code": code,
            "code_verifier": verifier, "grant_type": "authorization_code", "redirect_uri": REDIRECT})
        info = _call("https://openidconnect.googleapis.com/v1/userinfo", token=r["access_token"])
    except Exception:
        return HTMLResponse("<h3>Could not finish. Check the internet and try again.</h3>", 502)
    TOKEN_FILE.write_text(json.dumps({
        "refresh_token": r.get("refresh_token", ""), "access_token": r["access_token"],
        "expires_at": time.time() + int(r.get("expires_in", 3600)), "email": info.get("email")}))
    if _state()["base_rev"] == 0:
        mark_dirty()                        # never synced before: compare with Drive
    return HTMLResponse("<body style='font-family:sans-serif;text-align:center;margin-top:20vh'>"
                        "<h2>Google account connected</h2><p>You can close this tab and go back to the app.</p></body>")


def _user_count() -> int:
    db = SessionLocal()
    try:
        return db.query(User).count()
    finally:
        db.close()


# First-run setup on a new laptop (no login exists yet)
@public_router.post("/setup/connect")
def setup_connect():
    if _user_count() > 0:
        raise HTTPException(403, "Already set up")
    _start_oauth()
    return {"status": "waiting"}


@public_router.post("/setup/pull")
def setup_pull():
    if _user_count() > 0:
        raise HTTPException(403, "Already set up")
    s = sync_now(force="drive", manual=True)
    if s["status"] == "error":
        raise HTTPException(400, s["error"])
    if s["status"] == "offline":
        raise HTTPException(502, "No internet connection")
    return public_state()


# Admin actions
class Resolve(BaseModel):
    keep: Literal["local", "drive"]


@router.post("/connect")
def connect():
    _start_oauth()
    return {"status": "waiting"}


@router.post("/disconnect")
def disconnect():
    TOKEN_FILE.unlink(missing_ok=True)
    _save(base_rev=0, dirty=False, status="idle")
    return public_state()


@router.post("/now")
def now():
    sync_now(manual=True)
    return public_state()


@router.post("/resolve")
def resolve(data: Resolve):
    sync_now(force="drive" if data.keep == "drive" else "local", manual=True)
    return public_state()