from fastapi import FastAPI
from scene_schema import SceneModel


def include_scene_contract(app: FastAPI) -> None:
    """Keep the standalone protocol alias alongside FastAPI input/output schemas."""
    original = app.openapi

    def openapi():
        document = original()
        scene = SceneModel.model_json_schema(
            ref_template="#/components/schemas/SceneProtocol{model}"
        )
        schemas = document.setdefault("components", {}).setdefault("schemas", {})
        for name, definition in scene.pop("$defs", {}).items():
            name = f"SceneProtocol{name}"
            if name in schemas and schemas[name] != definition:
                raise ValueError(f"Conflicting API and scene schema: {name}")
            schemas[name] = definition
        schemas["SceneModel"] = scene
        return document

    app.openapi = openapi
