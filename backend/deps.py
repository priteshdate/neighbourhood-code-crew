"""Reusable FastAPI dependencies (DB session, authentication, authorization)."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import decode_access_token

# auto_error=False so a missing header yields our own 401 (not FastAPI's 403)
bearer_scheme = HTTPBearer(auto_error=False, description="Paste the JWT from /auth/login")


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _load_user(creds: HTTPAuthorizationCredentials | None, db: Session) -> models.User | None:
    """Resolve a bearer token to a User row, or None if missing/invalid."""
    if creds is None:
        return None
    payload = decode_access_token(creds.credentials)
    if not payload or "sub" not in payload:
        return None
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        return None
    return db.get(models.User, user_id)


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    """Require a valid token for a non-banned user."""
    if creds is None:
        raise _unauthorized()
    user = _load_user(creds, db)
    if user is None:
        raise _unauthorized("Invalid or expired token")
    if user.banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been banned")
    return user


def get_current_user_optional(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User | None:
    """Like get_current_user but returns None instead of raising."""
    user = _load_user(creds, db)
    if user is None or user.banned:
        return None
    return user


def require_admin(user: Annotated[models.User, Depends(get_current_user)]) -> models.User:
    """Require role == 'admin'."""
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


# Annotated shortcuts for router signatures
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[models.User, Depends(get_current_user)]
OptionalUser = Annotated[models.User | None, Depends(get_current_user_optional)]
AdminUser = Annotated[models.User, Depends(require_admin)]