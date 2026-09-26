import json
import subprocess
import sys
from pathlib import Path

from scene_schema import SceneModel

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "apps/unity-client/Assets/StreamingAssets/two-bedroom.json"


def test_unity_sample_is_authoritative_two_bedroom_with_offline_furniture():
    model = SceneModel.model_validate_json(SAMPLE.read_text(encoding="utf-8"))
    assert [room.name for room in model.rooms] == ["客厅", "主卧", "次卧"]
    assert len(model.furniture_instances) == 1
    furniture = model.furniture_instances[0]
    assert (furniture.width_mm, furniture.depth_mm, furniture.height_mm) == (
        2400,
        950,
        850,
    )
    assert (furniture.position.x, furniture.position.y, furniture.position.z) == (
        4000,
        2000,
        0,
    )
    assert furniture.rotation_deg == 90
    assert model.metadata["offline_catalog_only"] is True


def test_unity_export_is_current_and_preserves_unshown_fields():
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/export_unity_sample.py"), "--check"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    source = json.loads(
        (ROOT / "apps/admin-web/lib/two-bedroom.json").read_text(encoding="utf-8")
    )
    exported = json.loads(SAMPLE.read_text(encoding="utf-8"))
    for key in ("rooms", "walls", "doors", "windows"):
        expected = SceneModel.model_validate(source).model_dump(mode="json")[key]
        assert exported[key] == expected


def test_unity_export_check_does_not_modify_sample():
    before = SAMPLE.read_bytes()
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/export_unity_sample.py"), "--check"],
        capture_output=True,
    )
    assert result.returncode == 0
    assert SAMPLE.read_bytes() == before


def test_unity_assembly_references_resolve_to_source_assemblies():
    # This preflight catches unresolved asmdef names; it is not Editor compilation.
    definitions = [
        json.loads(path.read_text(encoding="utf-8"))
        for path in (ROOT / "apps/unity-client/Assets").rglob("*.asmdef")
    ]
    available = {definition["name"] for definition in definitions} | {
        "UnityEngine.TestRunner",
        "UnityEditor.TestRunner",
    }
    for definition in definitions:
        assert set(definition.get("references", [])) <= available
        if definition.get("precompiledReferences"):
            assert definition.get("overrideReferences") is True
