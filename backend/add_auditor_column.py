from sqlalchemy import text
from app.database import engine

with engine.begin() as conn:
    conn.execute(text("ALTER TABLE clients ADD COLUMN auditor_id INT NULL"))
    conn.execute(text(
        "ALTER TABLE clients ADD CONSTRAINT fk_clients_auditor "
        "FOREIGN KEY (auditor_id) REFERENCES auditors(id)"
    ))

print("auditor_id column added.")