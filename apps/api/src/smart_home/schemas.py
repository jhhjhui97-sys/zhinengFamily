from datetime import datetime
from decimal import Decimal
from typing import Annotated, ClassVar, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Name = Annotated[str, Field(min_length=1, max_length=200)]
T = TypeVar("T")
Money = Annotated[
    Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="before")
    @classmethod
    def text_must_not_contain_nul(cls, value):
        # Check raw text before field errors can include a submitted JSON key.
        pending = [value]
        visited = set()
        while pending:
            item = pending.pop()
            if isinstance(item, str) and "\x00" in item:
                raise ValueError("request text must not contain NUL characters")
            if isinstance(item, (dict, list, tuple)):
                if id(item) in visited:
                    continue
                visited.add(id(item))
                if isinstance(item, dict):
                    pending.extend(item.keys())
                    pending.extend(item.values())
                else:
                    pending.extend(item)
        return value


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EntityRead(ReadModel):
    id: UUID
    merchant_id: UUID
    created_at: datetime
    updated_at: datetime


class PatchModel(InputModel):
    nonnullable: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def required_fields_cannot_be_null(self):
        for field in self.model_fields_set:
            if field in self.nonnullable and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
