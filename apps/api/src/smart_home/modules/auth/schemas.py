from uuid import UUID

from pydantic import EmailStr, Field, SecretStr

from smart_home.schemas import InputModel, ReadModel


class Login(InputModel):
    merchant_id: UUID
    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class Token(ReadModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800
