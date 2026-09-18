import os
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from smart_home.main import create_app

ROOT = Path(__file__).resolve().parents[1]


def test_openapi_documents_protocol_auth_and_business_routes():
    with TestClient(create_app()) as client:
        assert client.get("/docs").status_code == 200
        schema = client.get("/openapi.json").json()
    for path in [
        "/health",
        "/ready",
        "/auth/login",
        "/auth/me",
        "/users",
        "/customers",
        "/products",
        "/projects",
    ]:
        assert path in schema["paths"]
    assert schema["components"]["securitySchemes"]["HTTPBearer"]["scheme"] == "bearer"
    assert (
        schema["components"]["schemas"]["SceneModel"]["properties"]["units"]["const"]
        == "mm"
    )
    assert "metadata" in schema["components"]["schemas"]["ProductRead"]["properties"]
    assert schema["paths"]["/customers"]["get"]["security"]


def test_openapi_export_matches_committed_contract_without_database():
    script = ROOT / "packages/api-contracts/export.py"
    assert script.is_file(), "OpenAPI exporter is missing"
    env = os.environ.copy()
    env.pop("DATABASE_URL", None)
    env.pop("SECRET_KEY", None)
    result = subprocess.run(
        [sys.executable, str(script), "--check"],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
