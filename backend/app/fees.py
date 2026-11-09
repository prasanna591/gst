from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_db
from app.models import Client, Fee

router = APIRouter(prefix="/api/fees", tags=["Fees"])


class FeeIn(BaseModel):
    client_id: int
    purpose: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    due_date: date
    expected_date: date | None = None
    reference_person: str | None = Field(default=None, max_length=150)
    notes: str | None = None


class PaidToggle(BaseModel):
    paid: bool


def out(f: Fee, client_name: str | None):
    return {
        "id": f.id,
        "client_id": f.client_id,
        "client_name": client_name,
        "purpose": f.purpose,
        "amount": float(f.amount),
        "due_date": f.due_date,
        "expected_date": f.expected_date,
        "reference_person": f.reference_person,
        "status": f.status,
        "paid_date": f.paid_date,
        "notes": f.notes,
    }


@router.get("/")
def list_fees(db: Session = Depends(get_db)):
    rows = (
        db.query(Fee, Client.client_name)
        .join(Client, Client.id == Fee.client_id)
        .order_by(Fee.status.desc(), Fee.due_date)
        .all()
    )
    return [out(fee, name) for fee, name in rows]


@router.post("/", status_code=201)
def create_fee(data: FeeIn, db: Session = Depends(get_db)):
    client = db.get(Client, data.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    fee = Fee(**data.model_dump(), status="Pending")
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return out(fee, client.client_name)


@router.put("/{fee_id}")
def update_fee(fee_id: int, data: FeeIn, db: Session = Depends(get_db)):
    fee = db.get(Fee, fee_id)
    if not fee:
        raise HTTPException(404, "Fee not found")
    for key, value in data.model_dump().items():
        setattr(fee, key, value)
    db.commit()
    db.refresh(fee)
    client = db.get(Client, fee.client_id)
    return out(fee, client.client_name if client else None)


@router.patch("/{fee_id}/paid")
def set_paid(fee_id: int, data: PaidToggle, db: Session = Depends(get_db)):
    fee = db.get(Fee, fee_id)
    if not fee:
        raise HTTPException(404, "Fee not found")
    fee.status = "Paid" if data.paid else "Pending"
    fee.paid_date = date.today() if data.paid else None
    db.commit()
    return {"status": fee.status}


@router.delete("/{fee_id}", status_code=204)
def delete_fee(fee_id: int, db: Session = Depends(get_db)):
    fee = db.get(Fee, fee_id)
    if not fee:
        raise HTTPException(404, "Fee not found")
    db.delete(fee)
    db.commit()
