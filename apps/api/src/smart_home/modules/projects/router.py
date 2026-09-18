from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from smart_home.modules.auth.dependencies import CurrentUser, Database
from smart_home.schemas import Page
from smart_home.tenant import get_record, page_records

from .models import DesignProject
from .schemas import ProjectCreate, ProjectPatch, ProjectRead
from .service import create_project, update_project

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectRead, status_code=201)
def create(payload: ProjectCreate, session: Database, user: CurrentUser):
    return create_project(session, user, payload)


@router.get("", response_model=Page[ProjectRead])
def listing(
    session: Database,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return page_records(session, DesignProject, user.merchant_id, limit, offset)


@router.get("/{project_id}", response_model=ProjectRead)
def get(project_id: UUID, session: Database, user: CurrentUser):
    return get_record(session, DesignProject, project_id, user.merchant_id)


@router.patch("/{project_id}", response_model=ProjectRead)
def update(
    project_id: UUID, payload: ProjectPatch, session: Database, user: CurrentUser
):
    project = get_record(session, DesignProject, project_id, user.merchant_id)
    return update_project(session, user, project, payload)
