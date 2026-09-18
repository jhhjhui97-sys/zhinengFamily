"""Scene elements. Catalog UUIDs are external references, not authorization."""

import math
from typing import Literal
from uuid import UUID

from pydantic import Field, JsonValue, field_validator, model_validator

from .geometry import (
    ContractModel,
    FiniteNumber,
    NonnegativeLength,
    Point2,
    Point3,
    PositiveLength,
    Rotation,
    segment_length,
    validate_room_boundary,
)


class MetadataModel(ContractModel):
    metadata: dict[str, JsonValue] = Field(default_factory=dict)

    @field_validator("metadata")
    @classmethod
    def finite_json(cls, value):
        def visit(item):
            if isinstance(item, float) and not math.isfinite(item):
                raise ValueError("metadata numbers must be finite JSON values")
            if isinstance(item, dict):
                for child in item.values():
                    visit(child)
            elif isinstance(item, list):
                for child in item:
                    visit(child)

        visit(value)
        return value


class Floor(MetadataModel):
    id: UUID
    name: str
    elevation_mm: FiniteNumber
    height_mm: PositiveLength


class FloorElement(MetadataModel):
    id: UUID
    floor_id: UUID


class Room(FloorElement):
    name: str
    boundary: list[Point2] = Field(min_length=3)

    @model_validator(mode="after")
    def valid_boundary(self):
        validate_room_boundary(self.boundary)
        return self


class Wall(FloorElement):
    start: Point2
    end: Point2
    thickness_mm: PositiveLength
    height_mm: PositiveLength

    @model_validator(mode="after")
    def valid_centerline(self):
        segment_length(self.start, self.end)
        return self


class Opening(FloorElement):
    wall_id: UUID
    offset_mm: NonnegativeLength
    width_mm: PositiveLength
    height_mm: PositiveLength
    sill_height_mm: NonnegativeLength


class Door(Opening):
    hinge: Literal["start", "end"]
    opens_to: Literal["left", "right"]


class Window(Opening):
    pass


class Column(FloorElement):
    position: Point3
    width_mm: PositiveLength
    depth_mm: PositiveLength
    height_mm: PositiveLength
    rotation_deg: Rotation


class Beam(FloorElement):
    start: Point3
    end: Point3
    width_mm: PositiveLength
    height_mm: PositiveLength

    @model_validator(mode="after")
    def valid_centerline(self):
        segment_length(self.start, self.end)
        return self


class ElectricalPoint(FloorElement):
    position: Point3
    kind: Literal["power", "data", "switch", "other"]
    wall_id: UUID | None = None


class PlumbingPoint(FloorElement):
    position: Point3
    kind: Literal["cold_water", "hot_water", "drain", "gas", "other"]
    wall_id: UUID | None = None


class FurnitureInstance(Column):
    room_id: UUID | None = None
    product_id: UUID
    asset_id: UUID | None = None
