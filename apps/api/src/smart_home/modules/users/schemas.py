from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field, SecretStr

from smart_home.schemas import InputModel, ReadModel


class UserCreate(InputModel):
    email: EmailStr
    password: SecretStr = Field(min_length=12, max_length=128)
    role: Literal["owner", "sales"] = "sales"


class UserRead(ReadModel):
    id: UUID
    merchant_id: UUID
    email: str
    role: str
    is_active: bool
    created_at: datetime
