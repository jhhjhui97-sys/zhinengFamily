from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from smart_home.config import get_settings
from smart_home.db import get_session
from smart_home.errors import fail
from smart_home.modules.users.models import User

Database = Annotated[Session, Depends(get_session)]
bearer = HTTPBearer(auto_error=False)


def get_current_user(
    session: Database,
    credential: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credential is None:
        fail(401, "unauthorized", "Authentication required")
    settings = get_settings()
    try:
        claims = jwt.decode(
            credential.credentials,
            settings.secret_key.get_secret_value(),
            algorithms=["HS256"],
            audience=settings.token_audience,
            issuer=settings.token_issuer,
            options={"require": ["sub", "exp", "iss", "aud"]},
        )
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        fail(401, "unauthorized", "Invalid or expired token")
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        fail(401, "unauthorized", "Invalid or expired token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_owner(user: CurrentUser) -> User:
    if user.role != "owner":
        fail(403, "forbidden", "Owner role required")
    return user


Owner = Annotated[User, Depends(require_owner)]
