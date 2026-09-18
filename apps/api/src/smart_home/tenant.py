"""Shared query boundaries. Tenant IDs always originate in the authenticated user."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_home.errors import fail
from smart_home.modules.users.models import User


def get_record(session: Session, model, record_id: UUID, merchant_id: UUID):
    record = session.scalar(
        select(model).where(model.id == record_id, model.merchant_id == merchant_id)
    )
    if record is None:
        fail(404, "not_found", "Record not found")
    return record


def page_records(session: Session, model, merchant_id: UUID, limit: int, offset: int):
    query = select(model).where(model.merchant_id == merchant_id)
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    items = session.scalars(
        query.order_by(model.created_at, model.id).limit(limit).offset(offset)
    ).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def assigned_user(
    session: Session, actor: User, target_id: UUID, current_id: UUID | None = None
):
    if target_id != (current_id or actor.id) and actor.role != "owner":
        fail(403, "forbidden", "Only an owner can transfer responsibility")
    user = get_record(session, User, target_id, actor.merchant_id)
    if not user.is_active:
        fail(404, "not_found", "User not found")
    return user.id
