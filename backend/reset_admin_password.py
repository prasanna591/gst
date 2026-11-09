from getpass import getpass

from app.database import SessionLocal
from app.models import User
from app.security import hash_password

db = SessionLocal()

try:
    email = "k.divyalakshmi22@gmail.com"

    user = db.query(User).filter(
        User.email == email,
        User.role == "Admin"
    ).first()

    if not user:
        print("Admin account not found.")
    else:
        password = getpass("Enter new Admin password: ")
        confirm = getpass("Confirm new Admin password: ")

        if password != confirm:
            print("Passwords do not match.")
        elif len(password) < 8:
            print("Password must contain at least 8 characters.")
        else:
            user.password_hash = hash_password(password)
            db.commit()
            print("Admin password updated successfully.")

finally:
    db.close()