from sqlalchemy import text
from app.database import engine

with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE clients ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"
    ))
    conn.execute(text(
        "ALTER TABLE clients ADD COLUMN date_of_birth DATE NULL"
    ))

print("Columns added successfully.")