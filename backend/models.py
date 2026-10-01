"""SQLAlchemy 2.x ORM models.

All datetimes are naive UTC (MySQL DATETIME has no timezone); use `utcnow()`.
NOTE: the request table's model is called `Request`; always reference it as
`models.Request` so it is never confused with `fastapi.Request`.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Current UTC time as a naive datetime."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_lat_lng", "lat", "lng"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")  # user | admin
    phone: Mapped[str | None] = mapped_column(String(20))  # never exposed by any API
    lat: Mapped[float | None] = mapped_column(Double)
    lng: Mapped[float | None] = mapped_column(Double)
    area_name: Mapped[str | None] = mapped_column(String(100))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    avg_rating: Mapped[float] = mapped_column(Double, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_reply_minutes: Mapped[float | None] = mapped_column(Double)
    banned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    skills: Mapped[list["Skill"]] = relationship(
        secondary="user_skills", lazy="selectin", order_by="Skill.name"
    )


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)  # stored lowercase


class UserSkill(Base):
    __tablename__ = "user_skills"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[int] = mapped_column(
        ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True
    )


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
        Index("ix_requests_status", "status"),
        Index("ix_requests_requester_id", "requester_id"),
        Index("ix_requests_helper_id", "helper_id"),
        Index("ix_requests_lat_lng", "lat", "lng"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    helper_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(50))  # lowercase, matches skill names
    urgency: Mapped[str] = mapped_column(String(10), default="normal")  # normal | urgent
    is_sos: Mapped[bool] = mapped_column(Boolean, default=False)
    lat: Mapped[float] = mapped_column(Double)
    lng: Mapped[float] = mapped_column(Double)
    radius_km: Mapped[float] = mapped_column(Double, default=3.0)
    # open | accepted | in_progress | completed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="open")
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_escalated_at: Mapped[datetime | None] = mapped_column(DateTime)

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])
    helper: Mapped["User | None"] = relationship(foreign_keys=[helper_id])


class RequestNotified(Base):
    """Which helpers were already pinged for a request (used by SOS escalation)."""

    __tablename__ = "request_notified"
    __table_args__ = (
        UniqueConstraint("request_id", "helper_id", name="uq_request_notified_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"))
    helper_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    notified_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_request_id_id", "request_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("request_id", "rater_id", name="uq_rating_request_rater"),
        CheckConstraint("stars BETWEEN 1 AND 5", name="ck_rating_stars"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"))
    rater_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    ratee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    stars: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("reporter_id", "request_id", name="uq_report_reporter_request"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"))
    reported_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending|dismissed|actioned
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(40))
    text: Mapped[str] = mapped_column(String(500))
    request_id: Mapped[int | None] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class DirectoryEntry(Base):
    __tablename__ = "directory_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    service_type: Mapped[str] = mapped_column(String(50))
    area_name: Mapped[str | None] = mapped_column(String(100))
    contact_note: Mapped[str | None] = mapped_column(String(255))
    added_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    area_name: Mapped[str | None] = mapped_column(String(100))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))