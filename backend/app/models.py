from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, ForeignKey, Numeric, func
from app.database import engine

from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String(150), nullable=False)
    business_name = Column(String(200), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    gstin = Column(String(15), unique=True, nullable=True, index=True)
    pan = Column(String(10), nullable=True, index=True)
    business_registration = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    date_of_birth = Column(Date, nullable=True)
    auditor_id = Column(Integer, ForeignKey("auditors.id"), nullable=True)
class Auditor(Base):
    __tablename__ = "auditors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    qualification = Column(String(150), nullable=True)
    membership_no = Column(String(50), nullable=True)
    firm_name = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class Filing(Base):
    __tablename__ = "filings"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    return_type = Column(String(20), nullable=False)
    period = Column(String(7), nullable=False)
    due_date = Column(Date, nullable=False)
    filed_date = Column(Date, nullable=True)
    status = Column(String(10), nullable=False, default="Pending")
    arn = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)


class Fee(Base):
    __tablename__ = "fees"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    purpose = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    due_date = Column(Date, nullable=False)
    expected_date = Column(Date, nullable=True)
    reference_person = Column(String(150), nullable=True)
    status = Column(String(10), nullable=False, default="Pending")
    paid_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(10), nullable=False, default="Staff")
    is_active = Column(Boolean, nullable=False, default=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    filing_id = Column(Integer, ForeignKey("filings.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(30), nullable=False, default="Other")
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(100), unique=True, nullable=False)
    content_type = Column(String(100), nullable=True)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_by_name = Column(String(150), nullable=True)
    uploaded_at = Column(DateTime, nullable=False, server_default=func.now())
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    notes = Column(Text, nullable=True)
    due_date = Column(Date, nullable=False)
    priority = Column(String(10), nullable=False, default="Normal")   # Normal or High
    is_done = Column(Boolean, nullable=False, default=False)
    done_at = Column(DateTime, nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
class ImportantDate(Base):
    __tablename__ = "important_dates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    kind = Column(String(20), nullable=False, default="Custom")   # Registration, Anniversary, Deadline, Custom
    event_date = Column(Date, nullable=False)
    repeat_yearly = Column(Boolean, nullable=False, default=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    notes = Column(Text, nullable=True)