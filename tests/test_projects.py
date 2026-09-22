from test_auth import PASSWORD, headers


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


def test_project_assignment_permissions_and_pagination(client, accounts):
    owner = headers(client, accounts[0])
    salesperson = client.post(
        "/users",
        headers=owner,
        json={"email": "project-sales@example.com", "password": PASSWORD},
    ).json()
    sales_token = client.post(
        "/auth/login",
        json={
            "merchant_id": salesperson["merchant_id"],
            "email": salesperson["email"],
            "password": PASSWORD,
        },
    ).json()["access_token"]
    sales = {"Authorization": f"Bearer {sales_token}"}
    customer = client.post("/customers", headers=sales, json={"name": "销售客户"}).json()
    created = []
    for index in range(21):
        response = client.post(
            "/projects",
            headers=sales,
            json={"name": f"项目{index + 1}", "customer_id": customer["id"]},
        )
        assert response.status_code == 201
        assert response.json()["sales_user_id"] == salesperson["id"]
        created.append(response.json())

    first = client.get("/projects?limit=20&offset=0", headers=sales).json()
    second = client.get("/projects?limit=20&offset=20", headers=sales).json()
    assert first["total"] == second["total"] == 21
    assert len(first["items"]) == 20
    assert len(second["items"]) == 1

    path = f"/projects/{created[0]['id']}"
    denied = client.patch(
        path, headers=sales, json={"sales_user_id": str(accounts[0].id)}
    )
    assert denied.status_code == 403
    assert client.get(path, headers=sales).json()["sales_user_id"] == salesperson["id"]
    transferred = client.patch(
        path, headers=owner, json={"sales_user_id": str(accounts[0].id)}
    )
    assert transferred.status_code == 200
    assert transferred.json()["sales_user_id"] == str(accounts[0].id)
