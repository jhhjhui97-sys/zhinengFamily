import copy
import importlib
import json
from pathlib import Path

import pytest

EXAMPLE = (
    Path(__file__).resolve().parents[2]
    / "packages/scene-schema/examples/apartment.json"
)


@pytest.fixture
def apartment():
    return copy.deepcopy(json.loads(EXAMPLE.read_text(encoding="utf-8")))


@pytest.fixture
def scene_model():
    try:
        module = importlib.import_module("scene_schema")
    except ModuleNotFoundError:
        pytest.fail("SceneModel protocol package is not implemented")
    assert hasattr(module, "SceneModel"), "SceneModel contract is not implemented"
    return module.SceneModel
