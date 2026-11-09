from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import SessionLocal
from app.models import Client, Document, Filing, User
from app.schemas import FilingCreate, FilingResponse

router = APIRouter(prefix="/api/filings", tags=["Filings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_rules(data: FilingCreate, db: Session, filing_id: int | None = None):
    if not db.query(Client).filter(Client.id == data.client_id).first():
        raise HTTPException(status_code=404, detail="Client not found")

    duplicate = db.query(Filing).filter(
        Filing.client_id == data.client_id,
        Filing.return_type == data.return_type,
        Filing.period == data.period,
    )
    if filing_id:
        duplicate = duplicate.filter(Filing.id != filing_id)
    if duplicate.first():
        raise HTTPException(
            status_code=409,
            detail="This return is already added for this client and period",
        )

    if data.status == "Filed" and not data.filed_date:
        raise HTTPException(
            status_code=422,
            detail="Filed date is required when status is Filed",
        )


@router.get("/", response_model=list[FilingResponse])
def list_filings(
    client_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Filing)
    if client_id is not None:
        query = query.filter(Filing.client_id == client_id)
    return query.order_by(Filing.due_date).all()


@router.post("/", response_model=FilingResponse, status_code=201)
def create_filing(data: FilingCreate, db: Session = Depends(get_db)):
    check_rules(data, db)
    filing = Filing(**data.model_dump())
    db.add(filing)
    db.commit()
    db.refresh(filing)
    return filing


@router.put("/{filing_id}", response_model=FilingResponse)
def update_filing(
    filing_id: int,
    data: FilingCreate,
    db: Session = Depends(get_db),
):
    filing = db.query(Filing).filter(Filing.id == filing_id).first()
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")

    check_rules(data, db, filing_id)
    for field, value in data.model_dump().items():
        setattr(filing, field, value)

    db.commit()
    db.refresh(filing)
    return filing


@router.delete("/{filing_id}", status_code=204)
def delete_filing(
    filing_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    filing = db.query(Filing).filter(Filing.id == filing_id).first()
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")
    db.query(Document).filter(Document.filing_id == filing_id).update(
        {"filing_id": None}
    )
    db.delete(filing)
    db.commit()
