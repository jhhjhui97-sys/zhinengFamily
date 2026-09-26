from fastapi import HTTPException
from scene_schema import SceneModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from smart_home.errors import fail
from smart_home.modules.products.models import Product
from smart_home.modules.projects.models import DesignProject
from smart_home.tenant import get_record

from .models import SceneState, SceneVersion


def version_query(project_id, merchant_id):
    return select(SceneVersion).where(
        SceneVersion.design_project_id == project_id,
        SceneVersion.merchant_id == merchant_id,
    )


def get_version(session, project_id, merchant_id, version):
    record = session.scalar(
        version_query(project_id, merchant_id).where(SceneVersion.version == version)
    )
    if record is None:
        fail(404, "not_found", "Scene version not found")
    return record


def current_scene(session, project_id, merchant_id):
    get_record(session, DesignProject, project_id, merchant_id)
    return session.scalar(
        version_query(project_id, merchant_id).join(
            SceneState,
            (SceneState.design_project_id == SceneVersion.design_project_id)
            & (SceneState.merchant_id == SceneVersion.merchant_id)
            & (SceneState.version == SceneVersion.version),
        )
    )


def write_scene(
    session, actor, project_id, base_version, scene=None, restore_version=None
):
    try:
        # Project exists before the first scene. This lock protects both insertion
        # and later writes; READ COMMITTED reads the pointer after acquiring it.
        project = session.scalar(
            select(DesignProject)
            .where(
                DesignProject.id == project_id,
                DesignProject.merchant_id == actor.merchant_id,
            )
            .with_for_update()
        )
        if project is None:
            fail(404, "not_found", "Project not found")
        state = session.get(SceneState, project_id, populate_existing=True)
        current = state.version if state else 0
        if current != base_version:
            fail(409, "scene_conflict", "Scene changed; reload before saving")
        if restore_version is not None:
            old = get_version(session, project_id, actor.merchant_id, restore_version)
            scene = SceneModel.model_validate(old.scene_data)
        # Revalidate even service callers; never trust a constructed model instance.
        scene = SceneModel.model_validate(scene.model_dump(mode="json"))
        product_ids = {item.product_id for item in scene.furniture_instances}
        if product_ids:
            found = set(
                session.scalars(
                    select(Product.id).where(
                        Product.merchant_id == actor.merchant_id,
                        Product.id.in_(product_ids),
                    )
                )
            )
            if found != product_ids:
                fail(404, "not_found", "Referenced product not found")
        record = SceneVersion(
            merchant_id=actor.merchant_id,
            design_project_id=project_id,
            version=current + 1,
            scene_data=scene.model_dump(mode="json"),
            created_by=actor.id,
        )
        session.add(record)
        session.flush()
        if state is None:
            session.add(
                SceneState(
                    merchant_id=actor.merchant_id,
                    design_project_id=project_id,
                    version=record.version,
                )
            )
        else:
            state.version = record.version
        session.commit()
        return record
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        fail(
            409,
            "scene_conflict",
            "Scene conflicts with an existing version or reference",
        )
    except SQLAlchemyError:
        session.rollback()
        fail(503, "database_unavailable", "Service temporarily unavailable")
