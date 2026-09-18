import importlib

import pytest
from pydantic import ValidationError

COLLECTIONS = [
    "rooms",
    "walls",
    "doors",
    "windows",
    "columns",
    "beams",
    "electrical_points",
    "plumbing_points",
    "furniture_instances",
]
MISSING = "ffffffff-ffff-4fff-8fff-ffffffffffff"


def test_scene_protocol_is_available():
    try:
        module = importlib.import_module("scene_schema")
    except ModuleNotFoundError:
        module = None
    assert module is not None and hasattr(module, "SceneModel"), (
        "SceneModel protocol is missing"
    )


def test_complete_example_round_trip(apartment, scene_model):
    scene = scene_model.model_validate(apartment)
    assert scene.model_dump(mode="json") == apartment
    assert scene_model.model_validate_json(scene.model_dump_json()) == scene
    assert all(len(getattr(scene, name)) == 1 for name in COLLECTIONS)


@pytest.mark.parametrize(
    "field,value",
    [
        ("schema_version", "2.0.0"),
        ("units", "m"),
        ("coordinate_system", "LH_Y_UP"),
        ("floors", []),
    ],
)
def test_rejects_unknown_contract(apartment, scene_model, field, value):
    apartment[field] = value
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", [None, "floors", *COLLECTIONS])
def test_rejects_unknown_fields(apartment, scene_model, collection):
    target = apartment if collection is None else apartment[collection][0]
    target["merchant_id"] = MISSING
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", ["floors", *COLLECTIONS])
def test_rejects_duplicate_scene_id(apartment, scene_model, collection):
    apartment[collection][0]["id"] = apartment["scene_id"]
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


def test_rejects_duplicate_ids_across_object_types(apartment, scene_model):
    apartment["columns"][0]["id"] = apartment["beams"][0]["id"]
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", COLLECTIONS)
def test_rejects_dangling_floor(apartment, scene_model, collection):
    apartment[collection][0]["floor_id"] = MISSING
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize(
    "collection,field",
    [
        ("doors", "wall_id"),
        ("windows", "wall_id"),
        ("electrical_points", "wall_id"),
        ("plumbing_points", "wall_id"),
        ("furniture_instances", "room_id"),
    ],
)
@pytest.mark.parametrize("wrong_type", [False, True])
def test_rejects_dangling_or_wrong_type_reference(
    apartment, scene_model, collection, field, wrong_type
):
    apartment[collection][0][field] = (
        apartment["columns"][0]["id"] if wrong_type else MISSING
    )
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize(
    "collection",
    ["doors", "windows", "electrical_points", "plumbing_points", "furniture_instances"],
)
def test_rejects_cross_floor_references(apartment, scene_model, collection):
    floor = dict(apartment["floors"][0], id=MISSING, name="二层", elevation_mm=3000)
    apartment["floors"].append(floor)
    apartment[collection][0]["floor_id"] = MISSING
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", ["doors", "windows"])
@pytest.mark.parametrize(
    "field,value", [("offset_mm", 4000), ("height_mm", 3000), ("sill_height_mm", 2800)]
)
def test_rejects_out_of_wall_opening(apartment, scene_model, collection, field, value):
    apartment[collection][0][field] = value
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


def test_accepts_openings_at_wall_limits_with_tolerance(apartment, scene_model):
    door = apartment["doors"][0]
    door.update(offset_mm=3300.0005, width_mm=900, height_mm=2800.0005)
    scene_model.model_validate(apartment)


def test_optional_references_and_collections(apartment, scene_model):
    for key in ("room_id", "asset_id"):
        apartment["furniture_instances"][0].pop(key)
    for collection in ("electrical_points", "plumbing_points"):
        apartment[collection][0].pop("wall_id")
    scene_model.model_validate(apartment)
    minimal = {
        key: apartment[key]
        for key in (
            "schema_version",
            "scene_id",
            "units",
            "coordinate_system",
            "floors",
        )
    }
    assert scene_model.model_validate(minimal).walls == []


@pytest.mark.parametrize("collection", [None, "floors", *COLLECTIONS])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_metadata_rejects_nested_nonfinite(apartment, scene_model, collection, value):
    target = apartment if collection is None else apartment[collection][0]
    target["metadata"] = {"nested": ["ok", {"number": value}]}
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


def test_rejects_non_json_metadata(apartment, scene_model):
    apartment["metadata"] = {"not_json": object()}
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("field", ["product_id", "asset_id"])
def test_external_references_must_be_uuid(apartment, scene_model, field):
    apartment["furniture_instances"][0][field] = "catalog-key"
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)
