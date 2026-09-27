from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from smart_home.db import Base


class SceneVersion(Base):
    __tablename__ = "scene_versions"
    __table_args__ = (
        UniqueConstraint(
            "design_project_id", "version", name="uq_scene_versions_project_version"
        ),
        UniqueConstraint(
            "merchant_id",
            "design_project_id",
            "version",
            name="uq_scene_versions_tenant_project_version",
        ),
        ForeignKeyConstraint(
            ["merchant_id", "design_project_id"],
            ["design_projects.merchant_id", "design_projects.id"],
        ),
        ForeignKeyConstraint(
            ["merchant_id", "created_by"], ["users.merchant_id", "users.id"]
        ),
        CheckConstraint("version > 0", name="positive_version"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID]
    design_project_id: Mapped[UUID]
    version: Mapped[int]
    scene_data: Mapped[dict] = mapped_column(JSONB)
    created_by: Mapped[UUID]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SceneState(Base):
    """Current pointer; scene content exists only in append-only snapshots."""

    __tablename__ = "scene_states"
    __table_args__ = (
        ForeignKeyConstraint(
            ["merchant_id", "design_project_id", "version"],
            [
                "scene_versions.merchant_id",
                "scene_versions.design_project_id",
                "scene_versions.version",
            ],
        ),
    )
    design_project_id: Mapped[UUID] = mapped_column(primary_key=True)
    merchant_id: Mapped[UUID]
    version: Mapped[int]
