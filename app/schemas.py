from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("tag name cannot be empty")
        return cleaned


class LeadCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    contact: str = Field(min_length=3, max_length=200)
    request: str = Field(min_length=3, max_length=4000)
    source: str = Field(default="manual", min_length=2, max_length=40)
    external_id: str | None = Field(default=None, max_length=200)
    telegram_user_id: str | None = Field(default=None, max_length=32)
    telegram_username: str | None = Field(default=None, max_length=64)


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    contact: str
    request: str
    source: str
    status: str
    external_id: str | None
    telegram_user_id: str | None
    telegram_username: str | None
    tags: list[TagRead]
    created_at: datetime
    updated_at: datetime


class LeadTagUpdate(BaseModel):
    tags: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            cleaned = " ".join(value.strip().split())
            if not cleaned:
                continue
            key = cleaned.casefold()
            if key not in seen:
                normalized.append(cleaned[:50])
                seen.add(key)
        return normalized


class LeadStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|in_progress|won|lost)$")


class Metrics(BaseModel):
    total: int
    new: int
    telegram: int
    manual: int
