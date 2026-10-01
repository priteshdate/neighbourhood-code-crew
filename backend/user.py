"""Profile endpoints. Other users only ever see the public profile (no email/phone)."""
from collections.abc import Iterable

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.services.trust import trust_summary  # provided in Stage 2

router = APIRouter(tags=["users"])


# --------------------------------------------------------------------------- #
# Helpers shared with routers/auth.py
# --------------------------------------------------------------------------- #
def normalize_skill_names(names: Iterable[str]) -> list[str]:
    """Lowercase, collapse whitespace, drop blanks and duplicates (order kept).
    Time: O(s) for s names."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in names:
        name = " ".join(raw.lower().split())
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def sync_user_skills(db: Session, user: models.User, names: Iterable[str]) -> None:
    """Replace the user's skills with `names`, creating Skill rows as needed.
    Safe against two requests creating the same new skill at once (savepoint + re-select).
    Time: O(s) queries-light (one IN query + at most s inserts)."""
    wanted = normalize_skill_names(names)
    existing: dict[str, models.Skill] = {}
    if wanted:
        rows = db.scalars(select(models.Skill).where(models.Skill.name.in_(wanted))).all()
        existing = {s.name: s for s in rows}

    skills: list[models.Skill] = []
    for name in wanted:
        skill = existing.get(name)
        if skill is None:
            try:
                with db.begin_nested():
                    skill = models.Skill(name=name)
                    db.add(skill)
                    db.flush()
            except IntegrityError:
                skill = db.scalar(select(models.Skill).where(models.Skill.name == name))
        skills.append(skill)
    user.skills = skills


def build_me(user: models.User) -> schemas.MeOut:
    """The caller's own profile (own email is fine; phone is never included)."""
    return schemas.MeOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        area_name=user.area_name,
        lat=user.lat,
        lng=user.lng,
        is_available=user.is_available,
        is_verified=user.is_verified,
        avg_rating=round(user.avg_rating, 2),
        rating_count=user.rating_count,
        completed_count=user.completed_count,
        avg_reply_minutes=user.avg_reply_minutes,
        skills=[s.name for s in user.skills],
        badge=trust_summary(user)["badge"],
        created_at=user.created_at,
    )


def build_public_profile(user: models.User) -> schemas.PublicProfileOut:
    """Name, area, badge, rating, skills, completed_count only."""
    return schemas.PublicProfileOut(
        id=user.id,
        name=user.name,
        area_name=user.area_name,
        badge=trust_summary(user)["badge"],
        rating=round(user.avg_rating, 2),
        skills=[s.name for s in user.skills],
        completed_count=user.completed_count,
    )


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.get("/me", response_model=schemas.MeOut)
def get_me(user: CurrentUser) -> schemas.MeOut:
    return build_me(user)


@router.patch("/me", response_model=schemas.MeOut)
def update_me(payload: schemas.MeUpdate, user: CurrentUser, db: DbSession) -> schemas.MeOut:
    data = payload.model_dump(exclude_unset=True)
    skills = data.pop("skills", None)

    for field in ("name", "is_available"):
        if field in data and data[field] is None:
            raise HTTPException(400, f"{field} cannot be null")

    for field, value in data.items():
        setattr(user, field, value)
    if skills is not None:
        sync_user_skills(db, user, skills)

    db.commit()
    db.refresh(user)
    return build_me(user)


@router.get("/users/{user_id}", response_model=schemas.PublicProfileOut)
def get_public_profile(
    user_id: int, _: CurrentUser, db: DbSession
) -> schemas.PublicProfileOut:
    target = db.get(models.User, user_id)
    if target is None or target.banned:
        raise HTTPException(404, "User not found")
    return build_public_profile(target)