
from datetime import date, datetime

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class ClientCreate(BaseModel):
    client_name: str = Field(min_length=1, max_length=150)
    business_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    gstin: str | None = Field(default=None, max_length=15)
    pan: str | None = Field(default=None, max_length=10)
    business_registration: str | None = None
    notes: str | None = None
    is_active: bool = True
    date_of_birth: date | None = None
    auditor_id: int | None = None


class ClientResponse(ClientCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)
class AuditorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: str | None = None
    phone: str | None = None
    qualification: str | None = None
    membership_no: str | None = None
    firm_name: str | None = None
    notes: str | None = None
    is_active: bool = True


class AuditorResponse(AuditorCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class FilingCreate(BaseModel):
    client_id: int
    return_type: str = Field(min_length=1, max_length=20)
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    due_date: date
    filed_date: date | None = None
    status: Literal["Pending", "Filed"] = "Pending"
    arn: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class FilingResponse(FilingCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    role: Literal["Admin", "Staff"] = "Staff"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class DocumentResponse(BaseModel):
    id: int
    client_id: int
    filing_id: int | None
    title: str
    category: str
    original_filename: str
    content_type: str | None
    size_bytes: int
    uploaded_by_name: str | None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    role: Literal["Admin", "Staff"]
    is_active: bool
    password: str | None = Field(default=None, min_length=8, max_length=72)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)