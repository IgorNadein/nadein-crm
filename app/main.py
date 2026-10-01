from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.db import Base, engine, get_db
from app.models import Lead, Tag
from app.schemas import LeadCreate, LeadRead, LeadStatusUpdate, LeadTagUpdate, Metrics, TagCreate, TagRead


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Nadein CRM", version="0.1.0", lifespan=lifespan)
static_dir = Path(__file__).parent / "static"
app.mount("/assets", StaticFiles(directory=static_dir), name="assets")


@app.get("/", include_in_schema=False)
def crm_ui() -> FileResponse:
    return FileResponse(static_dir / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _lead_query():
    return select(Lead).options(selectinload(Lead.tags)).order_by(Lead.created_at.desc())


@app.post("/api/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)) -> Lead:
    if payload.external_id:
        existing = db.scalar(_lead_query().where(Lead.external_id == payload.external_id))
        if existing:
            return existing

    lead = Lead(**payload.model_dump())
    db.add(lead)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if payload.external_id:
            existing = db.scalar(_lead_query().where(Lead.external_id == payload.external_id))
            if existing:
                return existing
        raise HTTPException(status_code=409, detail="lead already exists") from exc
    db.refresh(lead)
    return db.scalar(_lead_query().where(Lead.id == lead.id))


@app.get("/api/leads", response_model=list[LeadRead])
def list_leads(
    tag: str | None = Query(default=None, max_length=50),
    source: str | None = Query(default=None, max_length=40),
    search: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
) -> list[Lead]:
    stmt = _lead_query()
    if tag:
        stmt = stmt.join(Lead.tags).where(func.lower(Tag.name) == tag.casefold())
    if source:
        stmt = stmt.where(Lead.source == source)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.contact.ilike(like), Lead.request.ilike(like)))
    return list(db.scalars(stmt.limit(200)).unique())


@app.get("/api/leads/{lead_id}", response_model=LeadRead)
def get_lead(lead_id: str, db: Session = Depends(get_db)) -> Lead:
    lead = db.scalar(_lead_query().where(Lead.id == lead_id))
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    return lead


@app.put("/api/leads/{lead_id}/tags", response_model=LeadRead)
def replace_lead_tags(lead_id: str, payload: LeadTagUpdate, db: Session = Depends(get_db)) -> Lead:
    lead = db.scalar(_lead_query().where(Lead.id == lead_id))
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")

    tags: list[Tag] = []
    for name in payload.tags:
        tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name.casefold()))
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    lead.tags = tags
    db.commit()
    return db.scalar(_lead_query().where(Lead.id == lead.id))


@app.patch("/api/leads/{lead_id}/status", response_model=LeadRead)
def update_lead_status(lead_id: str, payload: LeadStatusUpdate, db: Session = Depends(get_db)) -> Lead:
    lead = db.scalar(_lead_query().where(Lead.id == lead_id))
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.status = payload.status
    db.commit()
    return db.scalar(_lead_query().where(Lead.id == lead.id))


@app.post("/api/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)) -> Tag:
    existing = db.scalar(select(Tag).where(func.lower(Tag.name) == payload.name.casefold()))
    if existing:
        return existing
    tag = Tag(name=payload.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@app.get("/api/tags", response_model=list[TagRead])
def list_tags(db: Session = Depends(get_db)) -> list[Tag]:
    return list(db.scalars(select(Tag).order_by(Tag.name)))


@app.get("/api/metrics", response_model=Metrics)
def metrics(db: Session = Depends(get_db)) -> Metrics:
    total = db.scalar(select(func.count()).select_from(Lead)) or 0
    new = db.scalar(select(func.count()).select_from(Lead).where(Lead.status == "new")) or 0
    telegram = db.scalar(select(func.count()).select_from(Lead).where(Lead.source == "telegram_bot")) or 0
    manual = db.scalar(select(func.count()).select_from(Lead).where(Lead.source == "manual")) or 0
    return Metrics(total=total, new=new, telegram=telegram, manual=manual)
