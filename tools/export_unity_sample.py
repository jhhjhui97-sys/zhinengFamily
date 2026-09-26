"""Generate the offline Unity fixture through the authoritative Pydantic model."""

import argparse
import json
from pathlib import Path

from scene_schema import SceneModel

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "apps/unity-client/Assets/StreamingAssets/two-bedroom.json"


def content():
    source = json.loads(
        (ROOT / "apps/admin-web/lib/two-bedroom.json").read_text(encoding="utf-8")
    )
    source["metadata"]["offline_catalog_only"] = True
    source["furniture_instances"] = [
        {
            "id": "40000000-0000-4000-8000-000000000001",
            "floor_id": source["floors"][0]["id"],
            "room_id": source["rooms"][0]["id"],
            "product_id": "40000000-0000-4000-8000-000000000002",
            "position": {"x": 4000, "y": 2000, "z": 0},
            "width_mm": 2400,
            "depth_mm": 950,
            "height_mm": 850,
            "rotation_deg": 90,
            "metadata": {"name": "离线示例沙发", "offline_catalog_only": True},
        }
    ]
    model = SceneModel.model_validate(source)
    return (
        json.dumps(model.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = content()
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != expected:
            raise SystemExit(
                "Unity sample is missing or stale; run tools/export_unity_sample.py"
            )
    else:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_text(expected, encoding="utf-8")


if __name__ == "__main__":
    main()
