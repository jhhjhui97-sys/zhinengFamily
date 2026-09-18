from typing import Literal
from uuid import UUID

from smart_home.modules.customers.schemas import Address
from smart_home.schemas import EntityRead, InputModel, Name, PatchModel

Status = Literal["draft", "active", "archived"]


class ProjectCreate(InputModel):
    customer_id: UUID
    sales_user_id: UUID | None = None
    name: Name
    address: Address | None = None
    status: Status = "draft"


class ProjectPatch(PatchModel):
    nonnullable = ("customer_id", "sales_user_id", "name", "status")
    customer_id: UUID | None = None
    sales_user_id: UUID | None = None
    name: Name | None = None
    address: Address | None = None
    status: Status | None = None


class ProjectRead(EntityRead):
    customer_id: UUID
    sales_user_id: UUID
    name: str
    address: str | None
    status: Status
