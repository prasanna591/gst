from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_db
from app.models import Client, Task

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    due_date: date
    priority: Literal["Normal", "High"] = "Normal"
    client_id: int | None = None


class DoneToggle(BaseModel):
    done: bool


def out(t: Task, client_name: str | None = None):
    return {
        "id": t.id, "title": t.title, "notes": t.notes, "due_date": t.due_date,
        "priority": t.priority, "is_done": t.is_done, "client_id": t.client_id,
        "client_name": client_name,
    }


@router.get("/")
def list_tasks(db: Session = Depends(get_db)):
    rows = (db.query(Task, Client.client_name)
              .outerjoin(Client, Client.id == Task.client_id)
              .order_by(Task.is_done, Task.due_date, Task.priority).all())
    return [out(t, name) for t, name in rows]


@router.post("/", status_code=201)
def create_task(data: TaskIn, db: Session = Depends(get_db)):
    t = Task(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return out(t)


@router.put("/{task_id}")
def update_task(task_id: int, data: TaskIn, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found")
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return out(t)


@router.patch("/{task_id}/done")
def set_done(task_id: int, data: DoneToggle, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found")
    t.is_done = data.done
    t.done_at = datetime.now() if data.done else None
    db.commit()
    return {"is_done": t.is_done}


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t); db.commit()