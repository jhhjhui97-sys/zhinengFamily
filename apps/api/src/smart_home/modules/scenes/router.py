from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query
from sqlalchemy import func, select

from smart_home.modules.auth.dependencies import CurrentUser, Database
from smart_home.modules.projects.models import DesignProject
from smart_home.schemas import Page
from smart_home.tenant import get_record

from .models import SceneVersion
from .schemas import SceneRestore, SceneSave, SceneVersionRead
from .service import current_scene, get_version, version_query, write_scene

router = APIRouter(prefix="/projects/{project_id}/scene", tags=["Scenes"])
VersionNumber = Annotated[int, Path(ge=1, le=2147483647)]


@router.get("", response_model=SceneVersionRead | None)
def current(project_id: UUID, session: Database, user: CurrentUser):
    return current_scene(session, project_id, user.merchant_id)


@router.put("", response_model=SceneVersionRead)
def save(project_id: UUID, payload: SceneSave, session: Database, user: CurrentUser):
    return write_scene(
        session, user, project_id, payload.base_version, payload.scene_data
    )


@router.get("/versions", response_model=Page[SceneVersionRead])
def versions(
    project_id: UUID,
    session: Database,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    get_record(session, DesignProject, project_id, user.merchant_id)
    query = version_query(project_id, user.merchant_id)
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    items = session.scalars(
        query.order_by(SceneVersion.version.desc()).limit(limit).offset(offset)
    ).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/versions/{version}", response_model=SceneVersionRead)
def detail(
    project_id: UUID, version: VersionNumber, session: Database, user: CurrentUser
):
    get_record(session, DesignProject, project_id, user.merchant_id)
    return get_version(session, project_id, user.merchant_id, version)


@router.post("/versions/{version}/restore", response_model=SceneVersionRead)
def restore(
    project_id: UUID,
    version: VersionNumber,
    payload: SceneRestore,
    session: Database,
    user: CurrentUser,
):
    return write_scene(
        session, user, project_id, payload.base_version, restore_version=version
    )
