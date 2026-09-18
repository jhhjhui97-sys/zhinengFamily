import pytest
from pydantic import ValidationError


@pytest.mark.parametrize(
    "value", [float("nan"), float("inf"), float("-inf"), True, "12"]
)
@pytest.mark.parametrize(
    "collection,field",
    [
        ("walls", "thickness_mm"),
        ("floors", "elevation_mm"),
        ("furniture_instances", "rotation_deg"),
    ],
)
def test_geometry_requires_finite_numbers(
    apartment, scene_model, collection, field, value
):
    apartment[collection][0][field] = value
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", ["walls", "beams"])
def test_rejects_zero_length_and_sub_tolerance_segments(
    apartment, scene_model, collection
):
    element = apartment[collection][0]
    element["end"] = element["start"].copy()
    element["end"]["x"] += 0.0005
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize(
    "points",
    [
        [(0, 0), (0, 3600), (4200, 3600), (4200, 0)],
        [(0, 0), (100, 100), (0, 100), (100, 0)],
        [(0, 0), (100, 0), (200, 0)],
        [(0, 0), (100, 0), (100, 100), (0, 0)],
        [(0, 0), (100, 0), (100, 100), (0.0005, 0)],
        [(0, 0), (100, 0)],
        [(0, 0), (100, 0), (50, 0), (100, 100), (0, 100)],
        [(0, 0), (100, 0), (100, 100), (50, 0), (0, 100)],
    ],
)
def test_rejects_invalid_room_boundary(apartment, scene_model, points):
    apartment["rooms"][0]["boundary"] = [{"x": x, "y": y} for x, y in points]
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


def test_accepts_simple_concave_ccw_room(apartment, scene_model):
    apartment["rooms"][0]["boundary"] = [
        {"x": 0, "y": 0},
        {"x": 100, "y": 0},
        {"x": 50, "y": 50},
        {"x": 100, "y": 100},
        {"x": 0, "y": 100},
    ]
    scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", ["columns", "furniture_instances"])
@pytest.mark.parametrize("angle", [-1, 360, 720])
def test_rejects_unbounded_rotation(apartment, scene_model, collection, angle):
    apartment[collection][0]["rotation_deg"] = angle
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize(
    "collection,field",
    [
        ("floors", "height_mm"),
        ("walls", "thickness_mm"),
        ("walls", "height_mm"),
        ("doors", "width_mm"),
        ("doors", "height_mm"),
        ("windows", "width_mm"),
        ("columns", "width_mm"),
        ("columns", "depth_mm"),
        ("beams", "width_mm"),
        ("furniture_instances", "height_mm"),
    ],
)
@pytest.mark.parametrize("value", [0, -1])
def test_rejects_nonpositive_dimensions(
    apartment, scene_model, collection, field, value
):
    apartment[collection][0][field] = value
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection", ["doors", "windows"])
@pytest.mark.parametrize("field", ["offset_mm", "sill_height_mm"])
def test_rejects_negative_opening_offsets(apartment, scene_model, collection, field):
    apartment[collection][0][field] = -1
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


@pytest.mark.parametrize("collection,coordinate", [("walls", "x"), ("beams", "z")])
def test_rejects_boolean_coordinate(apartment, scene_model, collection, coordinate):
    apartment[collection][0]["start"][coordinate] = True
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


def test_wall_requires_planar_points_even_for_model_instances(apartment, scene_model):
    from scene_schema.geometry import Point3

    apartment["walls"][0]["start"] = Point3(x=0, y=0, z=0)
    apartment["walls"][0]["end"] = Point3(x=0, y=0, z=50)
    apartment["doors"] = []
    apartment["windows"] = []
    with pytest.raises(ValidationError):
        scene_model.model_validate(apartment)


def test_revalidates_mutated_scene_instances(apartment, scene_model):
    scene = scene_model.model_validate(apartment)
    scene.floors[0].elevation_mm = float("nan")
    with pytest.raises(ValidationError):
        scene_model.model_validate(scene)


@pytest.mark.parametrize("through_model", [False, True])
def test_rejects_room_edge_collapsed_by_normalization(through_model):
    from uuid import uuid4

    from scene_schema.elements import Room
    from scene_schema.geometry import Point2, validate_room_boundary

    coordinates = [
        (0, 0),
        (1e100, 0),
        (1e100, 1e100),
        (-1e100, 1e100),
        (-1e100, -1e100),
        (0, -1e100),
        (1, -1),
    ]
    boundary = [Point2(x=x, y=y) for x, y in coordinates]
    if through_model:
        with pytest.raises(ValidationError):
            Room(id=uuid4(), floor_id=uuid4(), name="Room", boundary=boundary)
    else:
        with pytest.raises(ValueError):
            validate_room_boundary(boundary)
