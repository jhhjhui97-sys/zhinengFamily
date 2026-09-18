import json
from typing import Annotated

from pydantic import Field, JsonValue, field_validator

from smart_home.schemas import EntityRead, InputModel, Money, Name, PatchModel

Dimension = Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)]
Label = Annotated[str, Field(min_length=1, max_length=100)]
AssetURL = Annotated[str, Field(max_length=2048)]


class ProductMetadata(InputModel):
    @field_validator("metadata", check_fields=False)
    @classmethod
    def valid_json(cls, value):
        json.dumps(value, allow_nan=False)
        return value


class ProductCreate(ProductMetadata):
    category: Label
    brand: Label
    name: Name
    sku: Label
    price: Money
    width_mm: Dimension
    depth_mm: Dimension
    height_mm: Dimension
    thumbnail: AssetURL | None = None
    model_url: AssetURL | None = None
    metadata: dict[str, JsonValue] = Field(default_factory=dict)


class ProductPatch(PatchModel, ProductMetadata):
    nonnullable = (
        "category",
        "brand",
        "name",
        "sku",
        "price",
        "width_mm",
        "depth_mm",
        "height_mm",
        "metadata",
    )
    category: Label | None = None
    brand: Label | None = None
    name: Name | None = None
    sku: Label | None = None
    price: Money | None = None
    width_mm: Dimension | None = None
    depth_mm: Dimension | None = None
    height_mm: Dimension | None = None
    thumbnail: AssetURL | None = None
    model_url: AssetURL | None = None
    metadata: dict[str, JsonValue] | None = None


class ProductRead(EntityRead):
    category: str
    brand: str
    name: str
    sku: str
    price: Money
    width_mm: float
    depth_mm: float
    height_mm: float
    thumbnail: str | None
    model_url: str | None
    metadata: dict[str, JsonValue] = Field(validation_alias="product_metadata")
