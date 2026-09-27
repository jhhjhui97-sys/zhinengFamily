import os
import subprocess
import sys
from pathlib import Path


def test_importing_application_registers_all_database_models():
    code = (
        "from smart_home.main import app; "
        "from smart_home.db import Base; "
        "required={'merchants','users','customers','products','design_projects'}; "
        "assert required <= set(Base.metadata.tables), set(Base.metadata.tables)"
    )
    env = os.environ.copy()
    root = Path(__file__).resolve().parents[1]
    env["PYTHONPATH"] = os.pathsep.join(
        [str(root / "apps/api/src"), str(root / "packages/scene-schema/src")]
    )
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, env=env
    )
    assert result.returncode == 0, result.stdout + result.stderr
