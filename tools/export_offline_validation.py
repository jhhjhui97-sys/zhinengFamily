"""Generate offline cases using the authoritative Pydantic model."""

import argparse
import copy
import json
from pathlib import Path

from pydantic import ValidationError
from scene_schema import SceneModel

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/unity-client/Tests/Fixtures/offline-validation.json"
SCHEMA = ROOT / "apps/unity-client/Assets/StreamingAssets/scene.schema.json"


def fixtures():
    sample = json.loads(
        (ROOT / "apps/unity-client/Assets/StreamingAssets/two-bedroom.json").read_text(
            encoding="utf-8"
        )
    )
    floor = sample["floors"][0]["id"]
    wall = sample["walls"][0]["id"]
    point = {"x": 1500, "y": 1500, "z": 0}
    sample["columns"] = [
        {
            "id": "50000000-0000-4000-8000-000000000001",
            "floor_id": floor,
            "position": point,
            "width_mm": 200,
            "depth_mm": 200,
            "height_mm": 2800,
            "rotation_deg": 0,
        }
    ]
    sample["beams"] = [
        {
            "id": "50000000-0000-4000-8000-000000000002",
            "floor_id": floor,
            "start": point,
            "end": {"x": 2000, "y": 1500, "z": 2800},
            "width_mm": 200,
            "height_mm": 200,
        }
    ]
    sample["electrical_points"] = [
        {
            "id": "50000000-0000-4000-8000-000000000003",
            "floor_id": floor,
            "position": point,
            "kind": "power",
            "wall_id": wall,
        }
    ]
    sample["plumbing_points"] = [
        {
            "id": "50000000-0000-4000-8000-000000000004",
            "floor_id": floor,
            "position": point,
            "kind": "drain",
            "wall_id": wall,
        }
    ]
    cases = []

    def add(name, data):
        raw = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
        try:
            SceneModel.model_validate_json(raw)
            valid = True
        except (ValidationError, ValueError):
            valid = False
        cases.append({"name": name, "valid": valid, "json": raw})

    def change(name, fn):
        data = copy.deepcopy(sample)
        fn(data)
        add(name, data)

    add("complete all collections", sample)
    change(
        "optional collections omitted",
        lambda d: [
            d.pop(k) for k in list(d) if isinstance(d[k], list) and k != "floors"
        ],
    )
    change(
        "huge integer metadata",
        lambda d: d["metadata"].update(
            {"integer": 10**400, "nested": [None, True, {"text": "中文\\0"}]}
        ),
    )
    for collection in (
        "floors",
        "rooms",
        "walls",
        "doors",
        "windows",
        "columns",
        "beams",
        "electrical_points",
        "plumbing_points",
        "furniture_instances",
    ):
        for field, value in sample[collection][0].items():
            if field == "metadata":
                continue
            change(
                f"{collection}.{field} missing",
                lambda d, c=collection, f=field: d[c][0].pop(f),
            )
            change(
                f"{collection}.{field} null",
                lambda d, c=collection, f=field: d[c][0].update({f: None}),
            )
        change(
            f"{collection} extra field",
            lambda d, c=collection: d[c][0].update({"unknown": 1}),
        )
        change(
            f"{collection} duplicate id",
            lambda d, c=collection: d[c].append(copy.deepcopy(d[c][0])),
        )
        if collection != "floors":
            change(
                f"{collection} unresolved floor",
                lambda d, c=collection: d[c][0].update(
                    {"floor_id": "99999999-0000-4000-8000-000000000001"}
                ),
            )
            change(
                f"{collection} cross-floor",
                lambda d, c=collection: (
                    d["floors"].append(
                        {**d["floors"][0], "id": "99999999-0000-4000-8000-000000000001"}
                    ),
                    d[c][0].update(
                        {"floor_id": "99999999-0000-4000-8000-000000000001"}
                    ),
                ),
            )
    for collection in ("doors", "windows", "electrical_points", "plumbing_points"):
        change(
            f"{collection} unresolved wall",
            lambda d, c=collection: d[c][0].update(
                {"wall_id": "99999999-0000-4000-8000-000000000001"}
            ),
        )
    change(
        "unresolved room",
        lambda d: d["furniture_instances"][0].update(
            {"room_id": "99999999-0000-4000-8000-000000000001"}
        ),
    )
    change(
        "id duplicates scene", lambda d: d["floors"][0].update({"id": d["scene_id"]})
    )
    for field in ("width_mm", "depth_mm", "height_mm", "rotation_deg"):
        for value in (-1, 0, 360, True, "42", float("inf")):
            change(
                f"furniture {field} {value}",
                lambda d, f=field, v=value: d["furniture_instances"][0].update({f: v}),
            )
    for collection in ("walls", "beams"):
        change(
            f"{collection} zero segment",
            lambda d, c=collection: d[c][0].update({"end": d[c][0]["start"]}),
        )
        change(
            f"{collection} length overflow",
            lambda d, c=collection: (
                d[c][0]["start"].update({"x": -1e308}),
                d[c][0]["end"].update({"x": 1e308}),
            ),
        )
        change(
            f"{collection} finite large segment",
            lambda d, c=collection: (
                d[c][0]["start"].update({"x": 0}),
                d[c][0]["end"].update({"x": 1e200}),
            ),
        )
    for collection in ("doors", "windows"):
        change(
            f"{collection} too wide",
            lambda d, c=collection: d[c][0].update({"width_mm": 999999}),
        )
        change(
            f"{collection} too high",
            lambda d, c=collection: d[c][0].update({"sill_height_mm": 3000}),
        )
    boundaries = {
        "clockwise": [(0, 0), (0, 100), (100, 100), (100, 0)],
        "bowtie": [(0, 0), (100, 100), (0, 100), (100, 0)],
        "repeated": [(0, 0), (100, 0), (100, 100), (0, 0)],
        "near duplicate": [(0, 0), (0.0005, 0), (100, 100)],
        "collinear": [(0, 0), (50, 0), (100, 0)],
        "backtracking": [(0, 0), (100, 0), (50, 0), (100, 100), (0, 100)],
        "concave": [(0, 0), (100, 0), (50, 50), (100, 100), (0, 100)],
        "straight adjacent": [(0, 0), (50, 0), (100, 0), (100, 100), (0, 100)],
        "huge finite": [(0, 0), (1e200, 0), (1e200, 1e200), (0, 1e200)],
        "extent overflow": [(-1e308, 0), (1e308, 0), (1e308, 100)],
        "thin finite": [(0, 0), (100, 0), (100, 0.002), (0, 0.002)],
        "normalization collapse": [
            (0, 0),
            (1e200, 0),
            (1e200, 0.002),
            (1e200, 1e200),
            (0, 1e200),
        ],
    }
    for name, boundary in boundaries.items():
        change(
            "polygon " + name,
            lambda d, p=boundary: d["rooms"][0].update(
                {"boundary": [{"x": x, "y": y} for x, y in p]}
            ),
        )
    for text in (
        sample["floors"][0]["id"].upper(),
        sample["floors"][0]["id"].replace("-", ""),
        "{" + sample["floors"][0]["id"] + "}",
        "urn:uuid:" + sample["floors"][0]["id"],
        " " + sample["floors"][0]["id"],
        "not uuid",
    ):
        change(
            "UUID representation " + text,
            lambda d, t=text: d["floors"][0].update({"id": t}),
        )
    for value in (float("inf"), -float("inf"), float("nan")):
        change(
            "nested metadata " + str(value),
            lambda d, v=value: d["metadata"].update({"nested": [{"number": v}]}),
        )
    change("metadata array rejected", lambda d: d.update({"metadata": []}))
    change("root unknown field", lambda d: d.update({"merchant_id": "pretend-owner"}))
    change("floors empty", lambda d: d.update({"floors": []}))
    change("bad schema", lambda d: d.update({"schema_version": "2.0.0"}))
    raw = json.dumps(sample)
    add("single quoted JSON", raw.replace('"schema_version"', "'schema_version'"))
    add("comment JSON", raw.replace("{", "{/* ignored? */", 1))
    add("trailing comma JSON", raw[:-1] + ",}")
    add(
        "duplicate keys stricter offline policy",
        raw.replace(
            '"schema_version": "1.0.0"',
            '"schema_version": "1.0.0", "schema_version": "1.0.0"',
        ),
    )
    # Authority permits duplicate keys; offline import rejects ambiguity.
    cases[-1]["valid"] = False
    add("trailing JSON", raw + "{}")
    for exponent in (19, 20, 100, 400):
        change(
            f"integer elevation 10^{exponent}",
            lambda d, e=exponent: d["floors"][0].update({"elevation_mm": 10**e}),
        )
    for header in ("schema_version", "units", "coordinate_system"):
        for wrong in ({}, []):
            change(
                f"malformed {header} {wrong}",
                lambda d, h=header, w=wrong: d.update({h: w}),
            )
    for name, value in (
        ("high surrogate", chr(0xD800)),
        ("low surrogate", chr(0xDFFF)),
        ("valid supplementary", chr(0x1F600)),
    ):
        data = copy.deepcopy(sample)
        data["metadata"]["probe"] = value
        add("escaped Unicode " + name, json.dumps(data, ensure_ascii=True))
        data["metadata"] = {value: True}
        add("escaped Unicode key " + name, json.dumps(data, ensure_ascii=True))
    change(
        "UUID X format",
        lambda d: d.update(
            {
                "scene_id": (
                    "{0x10000000,0x0000,0x4000,"
                    "{0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x01}}"
                )
            }
        ),
    )
    change(
        "UUID parentheses", lambda d: d.update({"scene_id": "(" + d["scene_id"] + ")"})
    )
    return cases


def export(check=False):
    generated = (
        json.dumps(fixtures(), ensure_ascii=False, indent=2, allow_nan=True) + "\n"
    )
    schema = (ROOT / "packages/scene-schema/scene.schema.json").read_text(
        encoding="utf-8"
    )
    if check:
        assert OUT.read_text(encoding="utf-8") == generated, "offline cases drifted"
        assert SCHEMA.read_text(encoding="utf-8") == schema, "offline schema drifted"
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(generated, encoding="utf-8")
        SCHEMA.write_text(schema, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    export(parser.parse_args().check)
