from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from smart_home.db import Base, Timestamps


class Customer(Timestamps, Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("merchant_id", "id"),
        ForeignKeyConstraint(
            ["merchant_id", "owner_user_id"], ["users.merchant_id", "users.id"]
        ),
        CheckConstraint("budget >= 0 AND budget < 'Infinity'::numeric", name="budget"),
        CheckConstraint("status IN ('new','following','won','lost')", name="status"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id"), index=True)
    owner_user_id: Mapped[UUID]
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(32))
    wechat: Mapped[str | None] = mapped_column(String(100))
    source: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(500))
    budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new")
    notes: Mapped[str | None] = mapped_column(Text)
    last_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
