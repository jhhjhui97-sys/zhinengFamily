"""Project scene snapshots and current version pointer."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "scene_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("design_project_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("scene_data", postgresql.JSONB(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "design_project_id", "version", name="uq_scene_versions_project_version"
        ),
        sa.UniqueConstraint(
            "merchant_id",
            "design_project_id",
            "version",
            name="uq_scene_versions_tenant_project_version",
        ),
        sa.ForeignKeyConstraint(
            ["merchant_id", "design_project_id"],
            ["design_projects.merchant_id", "design_projects.id"],
        ),
        sa.ForeignKeyConstraint(
            ["merchant_id", "created_by"], ["users.merchant_id", "users.id"]
        ),
        sa.CheckConstraint("version > 0", name="positive_version"),
    )
    op.create_table(
        "scene_states",
        sa.Column("design_project_id", sa.Uuid(), primary_key=True),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["merchant_id", "design_project_id", "version"],
            [
                "scene_versions.merchant_id",
                "scene_versions.design_project_id",
                "scene_versions.version",
            ],
        ),
    )


def downgrade():
    op.drop_table("scene_states")
    op.drop_table("scene_versions")
