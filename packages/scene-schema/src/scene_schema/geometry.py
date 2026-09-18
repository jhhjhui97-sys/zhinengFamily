"""Finite millimeter geometry; polygon rings are implicitly closed."""

import math
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

TOLERANCE_MM = 0.001
FiniteNumber = Annotated[float, Field(strict=True, allow_inf_nan=False)]
PositiveLength = Annotated[FiniteNumber, Field(gt=0)]
NonnegativeLength = Annotated[FiniteNumber, Field(ge=0)]
Rotation = Annotated[FiniteNumber, Field(ge=0, lt=360)]


class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", allow_inf_nan=False, revalidate_instances="always"
    )


class Point2(ContractModel):
    x: FiniteNumber
    y: FiniteNumber


class Point3(Point2):
    z: FiniteNumber


def segment_length(start: Point2, end: Point2) -> float:
    components = [end.x - start.x, end.y - start.y]
    if isinstance(start, Point3) and isinstance(end, Point3):
        components.append(end.z - start.z)
    length = math.hypot(*components)
    if not math.isfinite(length) or length <= TOLERANCE_MM:
        raise ValueError("segment must have a finite length greater than 0.001 mm")
    return length


def _signed_distance(a, b, p):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    return dx / length * (p[1] - a[1]) - dy / length * (p[0] - a[0])


def _on_segment(a, b, p, tolerance):
    return (
        abs(_signed_distance(a, b, p)) <= tolerance
        and min(a[0], b[0]) - tolerance <= p[0] <= max(a[0], b[0]) + tolerance
        and min(a[1], b[1]) - tolerance <= p[1] <= max(a[1], b[1]) + tolerance
    )


def _intersects(a, b, c, d, tolerance):
    distances = (
        _signed_distance(a, b, c),
        _signed_distance(a, b, d),
        _signed_distance(c, d, a),
        _signed_distance(c, d, b),
    )
    u, v, w, x = distances
    if ((u > tolerance and v < -tolerance) or (u < -tolerance and v > tolerance)) and (
        (w > tolerance and x < -tolerance) or (w < -tolerance and x > tolerance)
    ):
        return True
    return any(
        (
            _on_segment(a, b, c, tolerance),
            _on_segment(a, b, d, tolerance),
            _on_segment(c, d, a, tolerance),
            _on_segment(c, d, b, tolerance),
        )
    )


def validate_room_boundary(boundary: list[Point2]) -> None:
    if len(boundary) < 3:
        raise ValueError("room boundary requires at least three points")
    for i, point in enumerate(boundary):
        for other in boundary[i + 1 :]:
            if math.hypot(point.x - other.x, point.y - other.y) <= TOLERANCE_MM:
                raise ValueError("room boundary contains repeated points")
    for i, point in enumerate(boundary):
        segment_length(point, boundary[(i + 1) % len(boundary)])

    # Normalize before determinants to avoid overflow from valid finite coordinates.
    origin_x = min(point.x for point in boundary)
    origin_y = min(point.y for point in boundary)
    scale = max(
        max(point.x for point in boundary) - origin_x,
        max(point.y for point in boundary) - origin_y,
    )
    if not math.isfinite(scale) or scale == 0:
        raise ValueError("room boundary has unrepresentable extent")
    points = [((p.x - origin_x) / scale, (p.y - origin_y) / scale) for p in boundary]
    if any(a == b for a, b in zip(points, points[1:] + points[:1], strict=True)):
        raise ValueError(
            "room boundary has an unrepresentable edge after normalization"
        )
    tolerance = TOLERANCE_MM / scale
    area_twice = math.fsum(
        a[0] * b[1] - b[0] * a[1]
        for a, b in zip(points, points[1:] + points[:1], strict=True)
    )
    if area_twice <= tolerance * tolerance:
        raise ValueError(
            "room boundary must have nonzero area and counterclockwise winding"
        )
    size = len(points)
    for i in range(size):
        a, b, c = points[i - 1], points[i], points[(i + 1) % size]
        if abs(_signed_distance(a, b, c)) <= tolerance:
            if (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) > 0:
                raise ValueError("adjacent room boundary edges overlap")
        for j in range(i + 1, size):
            if j == i + 1 or (i == 0 and j == size - 1):
                continue
            if _intersects(
                points[i],
                points[(i + 1) % size],
                points[j],
                points[(j + 1) % size],
                tolerance,
            ):
                raise ValueError("room boundary must be a simple polygon")
