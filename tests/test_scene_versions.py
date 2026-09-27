import copy
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import event, text
from test_auth import headers


@pytest.fixture
def scene():
    value = json.loads(
        (
            Path(__file__).parents[1] / "packages/scene-schema/examples/apartment.json"
        ).read_text(encoding="utf-8")
    )
    value["furniture_instances"] = []
    return value


@pytest.fixture
def scene_api(client, accounts):
    auth = headers(client, accounts[0])
    customer = client.post("/customers", headers=auth, json={"name": "场景客户"}).json()
    project = client.post(
        "/projects",
        headers=auth,
        json={"name": "场景项目", "customer_id": customer["id"]},
    ).json()
    return auth, f"/projects/{project['id']}/scene"


def save(client, auth, path, scene, base=0):
    return client.put(
        path, headers=auth, json={"base_version": base, "scene_data": scene}
    )


def test_scene_lifecycle_and_immutable_history(client, accounts, scene_api, scene):
    auth, path = scene_api
    assert client.get(path, headers=auth).json() is None
    assert client.get(path + "/versions", headers=auth).json()["total"] == 0
    first = save(client, auth, path, scene)
    assert first.status_code == 200, first.text
    v1 = first.json()
    assert v1["version"] == 1
    assert v1["created_by"] == str(accounts[0].id)
    changed = copy.deepcopy(scene)
    changed["metadata"]["title"] = "changed"
    v2 = save(client, auth, path, changed, 1).json()
    assert v2["version"] == 2
    assert client.get(path, headers=auth).json() == v2
    assert save(client, auth, path, scene, 1).status_code == 409
    restored = client.post(
        path + "/versions/1/restore", headers=auth, json={"base_version": 2}
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["version"] == 3
    assert restored.json()["scene_data"] == v1["scene_data"]
    assert client.get(path + "/versions/1", headers=auth).json() == v1
    assert client.get(path + "/versions/2", headers=auth).json() == v2
    listing = client.get(path + "/versions?limit=2&offset=0", headers=auth).json()
    assert listing["total"] == 3
    assert [v["version"] for v in listing["items"]] == [3, 2]
    assert (
        client.get(path + "/versions?limit=2&offset=2", headers=auth).json()["items"][
            0
        ]["version"]
        == 1
    )
    assert (
        client.post(
            path + "/versions/1/restore", headers=auth, json={"base_version": 2}
        ).status_code
        == 409
    )
    assert client.get(path + "/versions/99", headers=auth).status_code == 404
    assert client.delete(path + "/versions/1", headers=auth).status_code == 405


@pytest.mark.parametrize("field", ["merchant_id", "created_by", "design_project_id"])
def test_scene_rejects_authority_fields(client, scene_api, scene, field):
    auth, path = scene_api
    payload = {"base_version": 0, "scene_data": scene, field: str(uuid4())}
    assert client.put(path, headers=auth, json=payload).status_code == 422
    assert (
        client.post(
            path + "/versions/1/restore",
            headers=auth,
            json={"base_version": 0, field: str(uuid4())},
        ).status_code
        == 422
    )
    assert client.get(path, headers=auth).json() is None


@pytest.mark.parametrize(
    "invalid", ["empty", "floor", "geometry", "opening", "duplicate", "nonfinite"]
)
def test_scene_validates_full_protocol(client, scene_api, scene, invalid):
    auth, path = scene_api
    if invalid == "empty":
        scene = {}
    elif invalid == "floor":
        scene["rooms"][0]["floor_id"] = str(uuid4())
    elif invalid == "geometry":
        scene["rooms"][0]["boundary"] = [{"x": 0, "y": 0}] * 3
    elif invalid == "opening":
        scene["doors"][0]["width_mm"] = 999999
    elif invalid == "duplicate":
        scene["rooms"][0]["id"] = scene["scene_id"]
    else:
        scene["metadata"]["overflow"] = "OVERFLOW"
        body = json.dumps({"base_version": 0, "scene_data": scene}).replace(
            '"OVERFLOW"', "1e400"
        )
        assert (
            client.put(
                path, headers={**auth, "Content-Type": "application/json"}, content=body
            ).status_code
            == 422
        )
        return
    assert save(client, auth, path, scene).status_code == 422
    assert client.get(path, headers=auth).json() is None


def test_scene_tenant_project_and_product_isolation(client, accounts, scene_api, scene):
    auth, path = scene_api
    other = headers(client, accounts[1])
    assert save(client, auth, path, scene).status_code == 200
    for suffix in ["", "/versions", "/versions/1"]:
        assert client.get(path + suffix, headers=other).status_code == 404
        assert client.get(path + suffix).status_code == 401
    assert save(client, other, path, scene, 1).status_code == 404
    assert (
        client.post(
            path + "/versions/1/restore", headers=other, json={"base_version": 1}
        ).status_code
        == 404
    )
    customer = client.post("/customers", headers=auth, json={"name": "第二客户"}).json()
    project = client.post(
        "/projects",
        headers=auth,
        json={"name": "另一项目", "customer_id": customer["id"]},
    ).json()
    other_path = f"/projects/{project['id']}/scene"
    assert client.get(other_path + "/versions/1", headers=auth).status_code == 404
    assert (
        client.post(
            other_path + "/versions/1/restore", headers=auth, json={"base_version": 0}
        ).status_code
        == 404
    )
    # Reusing client scene_id grants no access to the first project's history.
    assert save(client, auth, other_path, scene).json()["version"] == 1
    product = {
        "category": "sofa",
        "brand": "测试",
        "name": "沙发",
        "sku": "scene",
        "price": "10.00",
        "width_mm": 10,
        "depth_mm": 10,
        "height_mm": 10,
    }
    foreign = client.post("/products", headers=other, json=product).json()
    item = {
        "id": str(uuid4()),
        "floor_id": scene["floors"][0]["id"],
        "product_id": foreign["id"],
        "position": {"x": 0, "y": 0, "z": 0},
        "rotation_deg": 0,
        "width_mm": 10,
        "depth_mm": 10,
        "height_mm": 10,
    }
    scene["furniture_instances"] = [item]
    assert save(client, auth, path, scene, 1).status_code == 404
    own = client.post("/products", headers=auth, json=product).json()
    item["product_id"] = own["id"]
    assert save(client, auth, path, scene, 1).status_code == 200


@pytest.mark.parametrize("mode", ["first", "update", "restore", "mixed"])
def test_scene_concurrent_writers_use_independent_transactions(
    client, scene_api, scene, mode
):
    from smart_home.db import session_factory

    auth, path = scene_api
    base = 0
    if mode != "first":
        assert save(client, auth, path, scene).status_code == 200
        base = 1
    gate = Barrier(2)
    engine = session_factory().kw["bind"]
    connection_ids = set()

    def synchronize(conn, cursor, statement, parameters, context, executemany):
        if "FOR UPDATE" in statement and "design_projects" in statement:
            connection_ids.add(id(conn.connection.driver_connection))
            gate.wait(timeout=10)

    event.listen(engine, "before_cursor_execute", synchronize)
    try:

        def write(index):
            if mode == "restore" or (mode == "mixed" and index == 1):
                return client.post(
                    path + "/versions/1/restore",
                    headers=auth,
                    json={"base_version": base},
                )
            return save(client, auth, path, scene, base)

        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(write, [0, 1]))
        assert sorted(r.status_code for r in responses) == [200, 409]
        assert len(connection_ids) == 2
    finally:
        event.remove(engine, "before_cursor_execute", synchronize)
    assert client.get(path, headers=auth).json()["version"] == base + 1
    assert client.get(path + "/versions", headers=auth).json()["total"] == base + 1


@pytest.mark.parametrize(
    "statement_prefix", ["INSERT INTO scene_versions", "UPDATE scene_states"]
)
def test_scene_history_failure_rolls_back_current(
    client, scene_api, scene, statement_prefix
):
    from smart_home.db import session_factory
    from sqlalchemy.exc import OperationalError

    auth, path = scene_api
    first = save(client, auth, path, scene).json()
    engine = session_factory().kw["bind"]

    def fail_write(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith(statement_prefix):
            raise OperationalError(
                "internal sensitive sql", {}, Exception("secret database failure")
            )

    event.listen(engine, "before_cursor_execute", fail_write)
    try:
        response = save(client, auth, path, scene, 1)
        assert response.status_code == 503
        assert "secret" not in response.text and "sql" not in response.text
    finally:
        event.remove(engine, "before_cursor_execute", fail_write)
    assert client.get(path, headers=auth).json() == first
    assert client.get(path + "/versions", headers=auth).json()["total"] == 1


@pytest.mark.parametrize("base", [-1, True, "0", 1.5, None])
def test_scene_base_version_is_strict(client, scene_api, scene, base):
    auth, path = scene_api
    assert save(client, auth, path, scene, base).status_code == 422


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1", "limit=bad"])
def test_scene_pagination_validation(client, scene_api, query):
    auth, path = scene_api
    assert client.get(path + "/versions?" + query, headers=auth).status_code == 422


def test_two_bedroom_example_uses_authoritative_protocol(client, scene_api):
    from scene_schema import SceneModel

    data = json.loads(
        (Path(__file__).parents[1] / "apps/admin-web/lib/two-bedroom.json").read_text(
            encoding="utf-8"
        )
    )
    model = SceneModel.model_validate(data)
    assert [room.name for room in model.rooms] == ["客厅", "主卧", "次卧"]
    assert len(model.walls) == 6
    assert model.furniture_instances == []
    auth, path = scene_api
    assert save(client, auth, path, data).status_code == 200


def test_database_rejects_duplicate_version_and_cross_tenant_author(
    client, accounts, scene_api, scene, db_engine
):
    from sqlalchemy.exc import IntegrityError

    auth, path = scene_api
    version = save(client, auth, path, scene).json()
    query = text(
        "INSERT INTO scene_versions "
        "(id, merchant_id, design_project_id, version, scene_data, created_by) "
        "VALUES (:id, :merchant, :project, :version, '{}'::jsonb, :author)"
    )
    for number, author in [(1, accounts[0].id), (2, accounts[1].id)]:
        with pytest.raises(IntegrityError), db_engine.begin() as conn:
            conn.execute(
                query,
                {
                    "id": uuid4(),
                    "merchant": accounts[0].merchant_id,
                    "project": version["design_project_id"],
                    "version": number,
                    "author": author,
                },
            )


def test_scene_migration_preserves_business_data(
    client, scene_api, db_engine, migration_config
):
    from alembic import command

    auth, path = scene_api
    project_path = path.removesuffix("/scene")
    before = client.get(project_path, headers=auth).json()
    command.downgrade(migration_config, "0001")
    assert client.get(project_path, headers=auth).json() == before
    command.upgrade(migration_config, "head")
    assert client.get(project_path, headers=auth).json() == before
    with db_engine.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM scene_versions")) == 0
