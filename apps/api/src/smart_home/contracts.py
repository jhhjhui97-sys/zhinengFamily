from fastapi import FastAPI
from scene_schema import SceneModel


def include_scene_contract(app: FastAPI) -> None:
    """Publish the shared protocol alongside API schemas, without a scene API."""
    original = app.openapi

    def openapi():
        document = original()
        scene = SceneModel.model_json_schema(
            ref_template="#/components/schemas/{model}"
        )
        schemas = document.setdefault("components", {}).setdefault("schemas", {})
        for name, definition in scene.pop("$defs", {}).items():
            if name in schemas and schemas[name] != definition:
                raise ValueError(f"Conflicting API and scene schema: {name}")
            schemas[name] = definition
        schemas["SceneModel"] = scene
        return document

    app.openapi = openapi
