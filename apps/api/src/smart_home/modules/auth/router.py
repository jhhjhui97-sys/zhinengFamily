from fastapi import APIRouter
from sqlalchemy import select

from smart_home.errors import fail
from smart_home.modules.users.models import User
from smart_home.modules.users.schemas import UserRead

from .dependencies import CurrentUser, Database
from .schemas import Login, Token
from .security import access_token, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(payload: Login, session: Database):
    user = session.scalar(
        select(User).where(
            User.merchant_id == payload.merchant_id,
            User.email == str(payload.email).lower(),
        )
    )
    valid = verify_password(
        payload.password.get_secret_value(), user.password_hash if user else None
    )
    if not valid or user is None or not user.is_active:
        fail(401, "invalid_credentials", "Invalid credentials")
    return Token(access_token=access_token(user.id))


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user
