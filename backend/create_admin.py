from getpass import getpass

from app.database import SessionLocal
from app.models import User
from app.security import hash_password

name = input("Full name: ").strip()
email = input("Email: ").strip().lower()
password = getpass("Password (at least 8 characters): ")

if len(password) < 8:
    raise SystemExit("Password must be at least 8 characters.")

db = SessionLocal()
if db.query(User).filter(User.email == email).first():
    raise SystemExit("A user with this email already exists.")

db.add(User(
    full_name=name,
    email=email,
    password_hash=hash_password(password),
    role="Admin",
))
db.commit()
db.close()
print("Admin created. You can now log in.")