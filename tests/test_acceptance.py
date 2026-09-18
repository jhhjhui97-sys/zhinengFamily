from smart_home.cli import bootstrap


def test_merchant_to_project_end_to_end(client, db_session):
    merchant, _ = bootstrap(
        db_session, "验收门店", "owner@example.com", "Acceptance-Password-123"
    )
    logged_in = client.post(
        "/auth/login",
        json={
            "merchant_id": str(merchant.id),
            "email": "owner@example.com",
            "password": "Acceptance-Password-123",
        },
    )
    assert logged_in.status_code == 200
    auth = {"Authorization": "Bearer " + logged_in.json()["access_token"]}
    user = client.post(
        "/users",
        headers=auth,
        json={"email": "sales@example.com", "password": "Sales-Password-123"},
    )
    assert user.status_code == 201
    customer = client.post(
        "/customers",
        headers=auth,
        json={"name": "验收客户", "owner_user_id": user.json()["id"]},
    )
    assert customer.status_code == 201
    product = client.post(
        "/products",
        headers=auth,
        json={
            "category": "sofa",
            "brand": "自有",
            "name": "沙发",
            "sku": "A001",
            "price": "1999.90",
            "width_mm": 1800,
            "depth_mm": 800,
            "height_mm": 900,
        },
    )
    assert product.status_code == 201
    project = client.post(
        "/projects",
        headers=auth,
        json={
            "name": "客厅方案",
            "customer_id": customer.json()["id"],
            "sales_user_id": user.json()["id"],
        },
    )
    assert project.status_code == 201
    for path, record in [
        ("customers", customer),
        ("products", product),
        ("projects", project),
    ]:
        assert (
            client.get("/" + path + "/" + record.json()["id"], headers=auth).status_code
            == 200
        )
        assert client.get("/" + path, headers=auth).json()["total"] == 1
    assert client.get("/ready").status_code == 200
    assert client.get("/docs").status_code == 200
