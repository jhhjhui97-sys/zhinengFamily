from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from smart_home.errors import commit, fail
from smart_home.modules.auth.dependencies import Database, Owner
from smart_home.modules.auth.security import hash_password

from .models import User
from .schemas import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, session: Database, owner: Owner):
    user = User(
        merchant_id=owner.merchant_id,
        email=str(payload.email),
        role=payload.role,
        password_hash=hash_password(payload.password.get_secret_value()),
    )
    session.add(user)
    commit(session)
    session.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: UUID, session: Database, owner: Owner):
    user = session.scalar(
        select(User).where(User.merchant_id == owner.merchant_id, User.id == user_id)
    )
    if user is None:
        fail(404, "not_found", "User not found")
    return user
