from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


lead_tags = Table(
    "lead_tags",
    Base.metadata,
    Column("lead_id", String(36), ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(100), index=True)
    contact: Mapped[str] = mapped_column(String(200))
    request: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(40), default="manual", index=True)
    status: Mapped[str] = mapped_column(String(24), default="new", index=True)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True, unique=True)
    telegram_user_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    tags: Mapped[list["Tag"]] = relationship(
        secondary=lead_tags,
        back_populates="leads",
        lazy="selectin",
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    leads: Mapped[list[Lead]] = relationship(secondary=lead_tags, back_populates="tags")
