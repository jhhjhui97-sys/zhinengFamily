from test_auth import headers


def test_project_crud_and_tenant_relations(client, accounts):
    a, b = [headers(client, u) for u in accounts]
    ca = client.post("/customers", headers=a, json={"name": "客户A"}).json()
    cb = client.post("/customers", headers=b, json={"name": "客户B"}).json()
    created = client.post(
        "/projects",
        headers=a,
        json={"name": "新房", "customer_id": ca["id"], "address": "上海"},
    )
    assert created.status_code == 201, created.text
    project = created.json()
    assert project["sales_user_id"] == str(accounts[0].id)
    path = "/projects/" + project["id"]
    assert client.get(path, headers=a).json() == project
    assert (
        client.patch(path, headers=a, json={"status": "active"}).json()["status"]
        == "active"
    )
    assert client.get("/projects", headers=a).json()["total"] == 1
    assert client.get(path, headers=b).status_code == 404
    assert client.patch(path, headers=b, json={"name": "越权"}).status_code == 404
    assert client.get("/projects", headers=b).json()["total"] == 0
    assert (
        client.post(
            "/projects", headers=a, json={"name": "bad", "customer_id": cb["id"]}
        ).status_code
        == 404
    )
    assert (
        client.patch(path, headers=a, json={"customer_id": cb["id"]}).status_code == 404
    )
    assert (
        client.patch(
            path, headers=a, json={"sales_user_id": str(accounts[1].id)}
        ).status_code
        == 404
    )
    assert client.patch(path, headers=a, json={"customer_id": None}).status_code == 422
    assert client.patch(path, headers=a, json={"status": "bad"}).status_code == 422
    assert client.get(path, headers=a).json()["customer_id"] == ca["id"]
    assert client.get("/projects").status_code == 401
