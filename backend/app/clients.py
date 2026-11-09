
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Client
from app.schemas import ClientCreate, ClientResponse

router = APIRouter(prefix="/api/clients", tags=["Clients"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=ClientResponse, status_code=201)
def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
):
    if client_data.gstin:
        existing = db.query(Client).filter(
            Client.gstin == client_data.gstin
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="GSTIN already exists",
            )

    client = Client(**client_data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/", response_model=list[ClientResponse])
def list_clients(db: Session = Depends(get_db)):
    return db.query(Client).order_by(Client.id.desc()).all()
@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    client_data: ClientCreate,
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if client_data.gstin:
        duplicate = db.query(Client).filter(
            Client.gstin == client_data.gstin,
            Client.id != client_id,
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="GSTIN already exists",
            )

    for field, value in client_data.model_dump().items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client