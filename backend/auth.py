"""Signup and login. New accounts are always role 'user'; admins come from the seed script."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.deps import DbSession
from app.routers.users import build_me, sync_user_skills
from app.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.ratelimit import limit_by_ip  # provided in Stage 2

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=schemas.TokenOut,
    status_code=201,
    dependencies=[Depends(limit_by_ip("signup", limit=5, window_sec=3600))],
)
def signup(payload: schemas.SignupIn, db: DbSession) -> schemas.TokenOut:
    if db.scalar(select(models.User.id).where(models.User.email == payload.email)):
        raise HTTPException(409, "Email already registered")

    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="user",
        phone=payload.phone,
        lat=payload.lat,
        lng=payload.lng,
        area_name=payload.area_name,
    )
    db.add(user)
    try:
        db.flush()
        sync_user_skills(db, user, payload.skills)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")

    return schemas.TokenOut(access_token=create_access_token(user.id), user=build_me(user))


@router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginIn, db: DbSession) -> schemas.TokenOut:
    user = db.scalar(select(models.User).where(models.User.email == payload.email))

    if user is None:
        verify_password(payload.password, DUMMY_HASH)  # equalise timing
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if user.banned:
        raise HTTPException(403, "This account has been banned")

    return schemas.TokenOut(access_token=create_access_token(user.id), user=build_me(user))