"""Password hashing (bcrypt via passlib) and JWT helpers (python-jose)."""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt. Time: O(1) (fixed bcrypt cost)."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Check a password against a bcrypt hash; malformed hashes return False."""
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


# Used to burn the same CPU time when the email is unknown, so login timing
# does not reveal which emails are registered.
DUMMY_HASH = hash_password("timing-equaliser-password")


def create_access_token(user_id: int, expires_minutes: int | None = None) -> str:
    """Create a signed JWT whose `sub` is the user id. Role is NOT embedded:
    it is always read from the database so revoked admins lose access at once."""
    now = datetime.now(timezone.utc)
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Return the token payload, or None if invalid/expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None