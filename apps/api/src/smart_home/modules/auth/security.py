from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from smart_home.config import get_settings

_hasher = PasswordHasher()
_dummy_hash = _hasher.hash("dummy-account-password-never-used-for-login")


def hash_password(password: str) -> str:
    if not 12 <= len(password) <= 128:
        raise ValueError("Password must contain 12 to 128 characters")
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        result = _hasher.verify(password_hash or _dummy_hash, password)
        return bool(result and password_hash)
    except (VerificationError, ValueError):
        return False


def access_token(user_id: UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=30),
            "iss": settings.token_issuer,
            "aud": settings.token_audience,
        },
        settings.secret_key.get_secret_value(),
        algorithm="HS256",
    )
