from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field

from smart_home.schemas import EntityRead, InputModel, Money, Name, PatchModel

Status = Literal["new", "following", "won", "lost"]
Phone = Annotated[str, Field(max_length=32)]
ShortText = Annotated[str, Field(max_length=100)]
Address = Annotated[str, Field(max_length=500)]
Notes = Annotated[str, Field(max_length=10000)]


class CustomerCreate(InputModel):
    name: Name
    owner_user_id: UUID | None = None
    phone: Phone | None = None
    wechat: ShortText | None = None
    source: ShortText | None = None
    address: Address | None = None
    budget: Money | None = None
    status: Status = "new"
    notes: Notes | None = None
    last_follow_up_at: AwareDatetime | None = None


class CustomerPatch(PatchModel):
    nonnullable = ("name", "owner_user_id", "status")
    name: Name | None = None
    owner_user_id: UUID | None = None
    phone: Phone | None = None
    wechat: ShortText | None = None
    source: ShortText | None = None
    address: Address | None = None
    budget: Money | None = None
    status: Status | None = None
    notes: Notes | None = None
    last_follow_up_at: AwareDatetime | None = None


class CustomerRead(EntityRead):
    name: str
    owner_user_id: UUID
    phone: str | None
    wechat: str | None
    source: str | None
    address: str | None
    budget: Money | None
    status: Status
    notes: str | None
    last_follow_up_at: AwareDatetime | None
