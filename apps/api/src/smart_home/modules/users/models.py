from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, validates

from smart_home.db import Base, Timestamps


class User(Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("merchant_id", "id"),
        UniqueConstraint("merchant_id", "email", name="uq_users_merchant_email"),
        CheckConstraint("role IN ('owner','sales')", name="role"),
        CheckConstraint("email = lower(trim(email))", name="email_normalized"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id"), index=True)
    email: Mapped[str] = mapped_column(String(254))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(
        String(20), default="sales", server_default="sales"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )

    @validates("email")
    def normalize_email(self, _key: str, value: str) -> str:
        return value.strip().lower()
