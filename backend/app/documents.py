
import os
import sys
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db, require_admin
from app.models import Client, Document, Filing, User
from app.schemas import DocumentResponse

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def _data_dir() -> Path:
    configured = os.getenv("DATA_DIR")

    if configured and not getattr(sys, "frozen", False):
        folder = Path(configured)
    else:
        base = os.getenv("APPDATA") or str(Path.home())
        folder = Path(base) / "GSTClientApp"

    folder.mkdir(parents=True, exist_ok=True)
    return folder


UPLOAD_DIR = _data_dir() / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_BYTES = 10 * 1024 * 1024

ALLOWED = {
    ".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx",
    ".xls", ".xlsx", ".csv",
}

CATEGORIES = {
    "GST Return", "Invoice", "Registration",
    "Notice", "Bank Statement", "Other",
}


@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    client_id: int | None = None,
    filing_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Document)

    if client_id is not None:
        query = query.filter(Document.client_id == client_id)

    if filing_id is not None:
        query = query.filter(Document.filing_id == filing_id)

    return query.order_by(Document.uploaded_at.desc()).all()


@router.post("/", response_model=DocumentResponse, status_code=201)
def upload_document(
    client_id: int = Form(...),
    filing_id: int | None = Form(None),
    category: str = Form("Other"),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.query(Client).filter(Client.id == client_id).first():
        raise HTTPException(status_code=404, detail="Client not found")

    if filing_id:
        filing = db.query(Filing).filter(Filing.id == filing_id).first()

        if not filing or filing.client_id != client_id:
            raise HTTPException(
                status_code=422,
                detail="This filing does not belong to the selected client",
            )

    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid document category")

    original = Path(file.filename or "").name
    ext = Path(original).suffix.lower()

    if not original or ext not in ALLOWED:
        raise HTTPException(
            status_code=422,
            detail="Allowed files: PDF, JPG, PNG, Word, Excel and CSV",
        )

    if len(original) > 255 or (title and len(title.strip()) > 200):
        raise HTTPException(
            status_code=422,
            detail="Document filename or title is too long",
        )

    if file.content_type and len(file.content_type) > 100:
        raise HTTPException(status_code=422, detail="Invalid content type")

    stored = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / stored
    size = 0

    try:
        with path.open("xb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)

                if size > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="File is too large. The limit is 10 MB",
                    )

                out.write(chunk)

        if size == 0:
            raise HTTPException(status_code=422, detail="The file is empty")

    except HTTPException:
        path.unlink(missing_ok=True)
        raise

    except OSError as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Could not store the uploaded file",
        ) from exc

    doc = Document(
        client_id=client_id,
        filing_id=filing_id or None,
        title=(title or "").strip() or original,
        category=category,
        original_filename=original,
        stored_filename=stored,
        content_type=file.content_type,
        size_bytes=size,
        uploaded_by=user.id,
        uploaded_by_name=user.full_name,
    )

    try:
        db.add(doc)
        db.commit()
        db.refresh(doc)

    except SQLAlchemyError:
        db.rollback()
        path.unlink(missing_ok=True)
        raise

    return doc


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    upload_root = UPLOAD_DIR.resolve()
    path = (upload_root / doc.stored_filename).resolve()

    if upload_root not in path.parents or not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="The file is missing on the server",
        )

    return FileResponse(
        path,
        filename=doc.original_filename,
        media_type=doc.content_type or "application/octet-stream",
    )


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    upload_root = UPLOAD_DIR.resolve()
    path = (upload_root / doc.stored_filename).resolve()

    if upload_root not in path.parents:
        raise HTTPException(
            status_code=500,
            detail="Stored document path is invalid",
        )

    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not remove the stored file",
        ) from exc

    db.delete(doc)
    db.commit()
