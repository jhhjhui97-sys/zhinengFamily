from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Float,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from smart_home.db import Base, Timestamps


class Product(Timestamps, Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("merchant_id", "id"),
        UniqueConstraint("merchant_id", "sku", name="uq_products_merchant_sku"),
        CheckConstraint("price >= 0 AND price < 'Infinity'::numeric", name="price"),
        *(
            CheckConstraint(f"{field} > 0 AND {field} < 'Infinity'::float8", name=field)
            for field in ("width_mm", "depth_mm", "height_mm")
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id"), index=True)
    category: Mapped[str] = mapped_column(String(100))
    brand: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    sku: Mapped[str] = mapped_column(String(100))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    width_mm: Mapped[float] = mapped_column(Float)
    depth_mm: Mapped[float] = mapped_column(Float)
    height_mm: Mapped[float] = mapped_column(Float)
    thumbnail: Mapped[str | None] = mapped_column(String(2048))
    model_url: Mapped[str | None] = mapped_column(String(2048))
    product_metadata: Mapped[dict] = mapped_column(
        "metadata", JSONB, default=dict, server_default="{}"
    )
