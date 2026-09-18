"""Authoritative v1 SceneModel, with snapshot-local reference validation."""

from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from .elements import (
    Beam,
    Column,
    Door,
    ElectricalPoint,
    Floor,
    FurnitureInstance,
    MetadataModel,
    PlumbingPoint,
    Room,
    Wall,
    Window,
)
from .geometry import TOLERANCE_MM, segment_length


class SceneModel(MetadataModel):
    model_config = ConfigDict(
        json_schema_extra={"$schema": "https://json-schema.org/draft/2020-12/schema"}
    )

    schema_version: Literal["1.0.0"]
    scene_id: UUID
    units: Literal["mm"]
    coordinate_system: Literal["RH_Z_UP"]
    floors: list[Floor] = Field(min_length=1)
    rooms: list[Room] = Field(default_factory=list)
    walls: list[Wall] = Field(default_factory=list)
    doors: list[Door] = Field(default_factory=list)
    windows: list[Window] = Field(default_factory=list)
    columns: list[Column] = Field(default_factory=list)
    beams: list[Beam] = Field(default_factory=list)
    electrical_points: list[ElectricalPoint] = Field(default_factory=list)
    plumbing_points: list[PlumbingPoint] = Field(default_factory=list)
    furniture_instances: list[FurnitureInstance] = Field(default_factory=list)

    @model_validator(mode="after")
    def valid_snapshot(self):
        collections = (
            self.rooms,
            self.walls,
            self.doors,
            self.windows,
            self.columns,
            self.beams,
            self.electrical_points,
            self.plumbing_points,
            self.furniture_instances,
        )
        elements = [element for collection in collections for element in collection]
        identifiers = {self.scene_id}
        for element in [*self.floors, *elements]:
            if element.id in identifiers:
                raise ValueError(f"duplicate scene object ID: {element.id}")
            identifiers.add(element.id)
        floors = {floor.id: floor for floor in self.floors}
        walls = {wall.id: wall for wall in self.walls}
        rooms = {room.id: room for room in self.rooms}
        for element in elements:
            if element.floor_id not in floors:
                raise ValueError(f"unresolved floor_id: {element.floor_id}")
            if isinstance(element, (Door, Window, ElectricalPoint, PlumbingPoint)):
                if element.wall_id is not None:
                    wall = walls.get(element.wall_id)
                    if wall is None or wall.floor_id != element.floor_id:
                        raise ValueError(
                            "wall_id must reference a wall on the same floor"
                        )
                    if isinstance(element, (Door, Window)):
                        if (
                            element.offset_mm + element.width_mm
                            > segment_length(wall.start, wall.end) + TOLERANCE_MM
                        ):
                            raise ValueError("opening exceeds wall length")
                        if (
                            element.sill_height_mm + element.height_mm
                            > wall.height_mm + TOLERANCE_MM
                        ):
                            raise ValueError("opening exceeds wall height")
            if isinstance(element, FurnitureInstance) and element.room_id is not None:
                room = rooms.get(element.room_id)
                if room is None or room.floor_id != element.floor_id:
                    raise ValueError("room_id must reference a room on the same floor")
        return self
