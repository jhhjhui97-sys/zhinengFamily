from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field
from scene_schema import SceneModel

from smart_home.schemas import InputModel, ReadModel


class SceneRestore(InputModel):
    base_version: Annotated[int, Field(strict=True, ge=0, le=2147483646)]


class SceneSave(SceneRestore):
    scene_data: SceneModel


class SceneVersionRead(ReadModel):
    id: UUID
    merchant_id: UUID
    design_project_id: UUID
    version: int
    scene_data: SceneModel
    created_by: UUID
    created_at: datetime
