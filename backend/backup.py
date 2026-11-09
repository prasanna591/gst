import glob
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

BASE = Path(__file__).resolve().parent
BACKUP_ROOT = BASE.parent / "backups"
UPLOADS = BASE / "uploads"
KEEP = 14  # number of backups to keep

load_dotenv(BASE / ".env")


def find_pg_dump() -> str:
    found = shutil.which("pg_dump")
    if found:
        return found

    matches = glob.glob(r"C:\Program Files\PostgreSQL\*\bin\pg_dump.exe")
    if matches:
        def version(path: str) -> int:
            m = re.search(r"PostgreSQL\\(\d+)", path)
            return int(m.group(1)) if m else 0
        return max(matches, key=version)

    sys.exit(
        "pg_dump was not found. Install PostgreSQL command line tools, or add "
        r"C:\Program Files\PostgreSQL\<version>\bin to your PATH."
    )


def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL is missing from backend/.env")

    url = make_url(database_url)
    if not url.drivername.startswith("postgresql"):
        sys.exit("This backup script is for PostgreSQL only.")

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    folder = BACKUP_ROOT / stamp
    folder.mkdir(parents=True, exist_ok=True)

    # 1. Database
    dump_file = folder / "database.dump"
    env = os.environ.copy()
    if url.password:
        env["PGPASSWORD"] = url.password

    result = subprocess.run(
        [
            find_pg_dump(),
            "-h", url.host or "localhost",
            "-p", str(url.port or 5432),
            "-U", url.username,
            "-F", "c",
            "-f", str(dump_file),
            url.database,
        ],
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        shutil.rmtree(folder, ignore_errors=True)
        sys.exit(f"Database backup failed:\n{result.stderr.strip()}")

    # 2. Uploaded documents
    uploads_zip = folder / "uploads.zip"
    count = 0
    with zipfile.ZipFile(uploads_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        if UPLOADS.exists():
            for file in UPLOADS.rglob("*"):
                if file.is_file():
                    zf.write(file, file.relative_to(UPLOADS))
                    count += 1

    # 3. Remove old backups
    folders = sorted(p for p in BACKUP_ROOT.iterdir() if p.is_dir())
    for old in folders[:-KEEP]:
        shutil.rmtree(old, ignore_errors=True)

    mb = lambda p: f"{p.stat().st_size / (1024 * 1024):.2f} MB"
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Backup saved to {folder}")
    print(f"  database.dump  {mb(dump_file)}")
    print(f"  uploads.zip    {mb(uploads_zip)} ({count} files)")


if __name__ == "__main__":
    main()