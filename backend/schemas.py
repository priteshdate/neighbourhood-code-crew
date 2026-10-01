"""Pydantic v2 request/response models for the whole API.

Privacy rule: no response model here contains `password_hash` or `phone`, and
only `MeOut` (the caller's own profile) contains an email address.
"""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

# --------------------------------------------------------------------------- #
# Reusable constrained types
# --------------------------------------------------------------------------- #
Lat = Annotated[float, Field(ge=-90, le=90)]
Lng = Annotated[float, Field(ge=-180, le=180)]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
AreaName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
SkillName = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=50)
]
Category = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=2, max_length=50)
]
Phone = Annotated[
    str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9][0-9 \-]{6,18}$")
]
Urgency = Literal["normal", "urgent"]
RequestStatus = Literal["open", "accepted", "in_progress", "completed", "cancelled"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ActionOut(BaseModel):
    """Generic success body for action endpoints. Errors use {"detail": "..."}."""

    detail: str


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class SignupIn(BaseModel):
    name: PersonName
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    phone: Phone | None = None  # stored, but never returned by any API
    lat: Lat | None = None
    lng: Lng | None = None
    area_name: AreaName | None = None
    skills: list[SkillName] = Field(default_factory=list, max_length=20)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def _bcrypt_72_bytes(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return v

    @model_validator(mode="after")
    def _lat_lng_together(self) -> "SignupIn":
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must be provided together")
        return self


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
class MeOut(ORMModel):
    """The caller's own profile. Includes own email, never phone."""

    id: int
    name: str
    email: str
    role: str
    area_name: str | None
    lat: float | None
    lng: float | None
    is_available: bool
    is_verified: bool
    avg_rating: float
    rating_count: int
    completed_count: int
    avg_reply_minutes: float | None
    skills: list[str]
    badge: str
    created_at: datetime


class MeUpdate(BaseModel):
    name: PersonName | None = None
    lat: Lat | None = None
    lng: Lng | None = None
    area_name: AreaName | None = None
    is_available: bool | None = None
    skills: list[SkillName] | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def _lat_lng_together(self) -> "MeUpdate":
        sent = self.model_fields_set
        if "lat" in sent or "lng" in sent:
            if self.lat is None or self.lng is None:
                raise ValueError("lat and lng must both be provided (and non-null) together")
        return self


class PublicProfileOut(BaseModel):
    """What other users may see: name, area, badge, rating, skills, completed count."""

    id: int
    name: str
    area_name: str | None
    badge: str
    rating: float
    skills: list[str]
    completed_count: int


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #
class HelperBrief(BaseModel):
    id: int
    name: str
    badge: str
    rating: float


class RequestCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=2000)
    category: Category
    urgency: Urgency = "normal"
    is_sos: bool = False
    lat: Lat
    lng: Lng
    radius_km: float = Field(default=3.0, ge=0.5, le=25)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("title must be at least 3 characters")
        return v

    @model_validator(mode="after")
    def _sos_is_urgent(self) -> "RequestCreate":
        if self.is_sos:
            self.urgency = "urgent"
        return self


class RequestUpdate(BaseModel):
    """Edit while status == open. Location and SOS flag cannot be edited."""

    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    category: Category | None = None
    urgency: Urgency | None = None
    radius_km: float | None = Field(default=None, ge=0.5, le=25)


class RequestOut(BaseModel):
    id: int
    requester_id: int
    requester_name: str | None = None
    helper_id: int | None = None
    helper: HelperBrief | None = None
    title: str
    description: str
    category: str
    urgency: str
    is_sos: bool
    lat: float
    lng: float
    location_is_approximate: bool = False  # True while coordinates are fuzzed (~200 m)
    radius_km: float
    status: str
    created_at: datetime
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    distance_km: float | None = None


class RequestPage(BaseModel):
    items: list[RequestOut]
    next_before_id: int | None = None  # pass as ?before_id= to get the next page


# --------------------------------------------------------------------------- #
# Matching
# --------------------------------------------------------------------------- #
class MatchOut(BaseModel):
    helper_id: int
    name: str
    badge: str
    area_name: str | None
    rating: float
    rating_count: int
    score: float
    distance_km: float
    breakdown: dict[str, float]
    reasons: list[str]


class SuggestedOut(BaseModel):
    request: RequestOut
    score: float
    distance_km: float
    breakdown: dict[str, float]
    reasons: list[str]


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #
class ChatMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message cannot be blank")
        return v


class ChatMessageOut(ORMModel):
    id: int
    request_id: int
    sender_id: int
    sender_name: str | None = None
    body: str
    created_at: datetime


# --------------------------------------------------------------------------- #
# Ratings
# --------------------------------------------------------------------------- #
class RatingIn(BaseModel):
    request_id: int
    stars: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class RatingOut(ORMModel):
    id: int
    request_id: int
    rater_id: int
    ratee_id: int
    stars: int
    comment: str | None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Notifications
# --------------------------------------------------------------------------- #
class NotificationOut(ORMModel):
    id: int
    type: str
    text: str
    request_id: int | None
    is_read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int


class NotificationsReadIn(BaseModel):
    ids: list[int] | None = None  # omit or null = mark everything as read


class NotificationsReadOut(BaseModel):
    marked_read: int
    unread_count: int


# --------------------------------------------------------------------------- #
# Reports and admin
# --------------------------------------------------------------------------- #
class ReportIn(BaseModel):
    request_id: int | None = None
    reported_user_id: int | None = None
    reason: str = Field(min_length=5, max_length=500)

    @model_validator(mode="after")
    def _has_target(self) -> "ReportIn":
        if self.request_id is None and self.reported_user_id is None:
            raise ValueError("Provide request_id and/or reported_user_id")
        return self


class ReportOut(ORMModel):
    id: int
    request_id: int | None
    reported_user_id: int | None
    reporter_id: int
    reason: str
    status: str
    created_at: datetime


class AdminReportOut(ReportOut):
    request_title: str | None = None
    reported_user_name: str | None = None
    reporter_name: str | None = None
    pending_reports_on_request: int = 0


class AdminSummaryOut(BaseModel):
    total_users: int
    banned_users: int
    verified_users: int
    open_requests: int
    open_sos: int
    completed_requests: int
    hidden_requests: int
    pending_reports: int


# --------------------------------------------------------------------------- #
# Dashboard (shape is fixed by the product spec)
# --------------------------------------------------------------------------- #
class DashboardUser(BaseModel):
    name: str
    is_available: bool
    has_skills: bool
    unread_notifications: int


class DashboardStats(BaseModel):
    got_help: int
    helped_others: int
    avg_rating: float  # rating as a helper only
    active_now: int


class EscalationInfo(BaseModel):
    notified: int
    radius_km: float
    next_expand_in_sec: int | None  # None once the max radius is reached


class DashboardRequest(RequestOut):
    escalation: EscalationInfo | None = None  # only for open SOS requests


class TrustPartsOut(BaseModel):
    verified: float
    completed: float
    rating: float
    response: float


class TrustOut(BaseModel):
    badge: str
    parts: TrustPartsOut
    tip: str


class ImpactOut(BaseModel):
    helps_this_month: int
    resolved_pct: float
    accepted_within_10min_pct: float


class DashboardOut(BaseModel):
    user: DashboardUser
    stats: DashboardStats
    active_requests: list[DashboardRequest]
    helping: list[RequestOut]
    past: list[RequestOut]
    trust: TrustOut
    suggested: list[SuggestedOut]
    impact: ImpactOut


# --------------------------------------------------------------------------- #
# Directory / events (optional CRUD)
# --------------------------------------------------------------------------- #
class DirectoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    service_type: str = Field(min_length=1, max_length=50)
    area_name: str | None = Field(default=None, max_length=100)
    contact_note: str | None = Field(default=None, max_length=255)


class DirectoryOut(ORMModel):
    id: int
    name: str
    service_type: str
    area_name: str | None
    contact_note: str | None


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    area_name: str | None = Field(default=None, max_length=100)
    starts_at: datetime


class EventOut(ORMModel):
    id: int
    title: str
    description: str | None
    area_name: str | None
    starts_at: datetime