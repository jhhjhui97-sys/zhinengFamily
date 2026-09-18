import json
import os
import subprocess
import sys
from pathlib import Path

SCHEMA = Path(__file__).resolve().parents[2] / "packages/scene-schema/scene.schema.json"


def run_export(*args):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SCHEMA.parent / "src")
    return subprocess.run(
        [sys.executable, "-m", "scene_schema.export", *args],
        env=env,
        capture_output=True,
        text=True,
    )


def test_schema_declares_draft_and_matches_model(scene_model):
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema == scene_model.model_json_schema()
    assert schema["additionalProperties"] is False


def test_export_check_committed_schema(scene_model):
    before = SCHEMA.read_bytes()
    result = run_export("--check")
    assert result.returncode == 0, result.stderr
    assert SCHEMA.read_bytes() == before


def test_export_checks_drift_without_writing(tmp_path, scene_model):
    target = tmp_path / "schema.json"
    target.write_text("{}\n", encoding="utf-8")
    result = run_export("--check", "--output", str(target))
    assert result.returncode != 0
    assert target.read_text(encoding="utf-8") == "{}\n"


def test_export_generates_sorted_utf8_schema(tmp_path, scene_model):
    target = tmp_path / "schema.json"
    result = run_export("--output", str(target))
    assert result.returncode == 0, result.stderr
    assert (
        target.read_text(encoding="utf-8")
        == json.dumps(
            scene_model.model_json_schema(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )
