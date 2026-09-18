from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from smart_home.db import Base, Timestamps


class DesignProject(Timestamps, Base):
    __tablename__ = "design_projects"
    __table_args__ = (
        UniqueConstraint("merchant_id", "id"),
        ForeignKeyConstraint(
            ["merchant_id", "customer_id"], ["customers.merchant_id", "customers.id"]
        ),
        ForeignKeyConstraint(
            ["merchant_id", "sales_user_id"], ["users.merchant_id", "users.id"]
        ),
        CheckConstraint("status IN ('draft','active','archived')", name="status"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id"), index=True)
    customer_id: Mapped[UUID]
    sales_user_id: Mapped[UUID]
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(20), default="draft", server_default="draft"
    )
