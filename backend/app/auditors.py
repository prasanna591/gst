from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Auditor
from app.schemas import AuditorCreate, AuditorResponse

router = APIRouter(prefix="/api/auditors", tags=["Auditors"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[AuditorResponse])
def list_auditors(db: Session = Depends(get_db)):
    return db.query(Auditor).order_by(Auditor.name).all()


@router.post("/", response_model=AuditorResponse, status_code=201)
def create_auditor(data: AuditorCreate, db: Session = Depends(get_db)):
    auditor = Auditor(**data.model_dump())
    db.add(auditor)
    db.commit()
    db.refresh(auditor)
    return auditor


@router.put("/{auditor_id}", response_model=AuditorResponse)
def update_auditor(
    auditor_id: int,
    data: AuditorCreate,
    db: Session = Depends(get_db),
):
    auditor = db.query(Auditor).filter(Auditor.id == auditor_id).first()
    if not auditor:
        raise HTTPException(status_code=404, detail="Auditor not found")

    for field, value in data.model_dump().items():
        setattr(auditor, field, value)

    db.commit()
    db.refresh(auditor)
    return auditor