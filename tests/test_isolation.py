import pytest
from test_auth import PASSWORD, headers
from test_products import PRODUCT


@pytest.mark.parametrize("resource", ["customers", "products", "projects"])
def test_merchant_field_injection_is_rejected(client, accounts, resource):
    auth = headers(client, accounts[0])
    customer = client.post("/customers", headers=auth, json={"name": "客户"}).json()
    payload = {
        "customers": {"name": "越权"},
        "products": PRODUCT,
        "projects": {"name": "方案", "customer_id": customer["id"]},
    }[resource].copy()
    payload["merchant_id"] = str(accounts[1].merchant_id)
    assert client.post("/" + resource, headers=auth, json=payload).status_code == 422


def test_sales_cannot_transfer_customer_or_project(client, accounts):
    owner = headers(client, accounts[0])
    user = client.post(
        "/users",
        headers=owner,
        json={"email": "sales@example.com", "password": PASSWORD},
    ).json()
    token = client.post(
        "/auth/login",
        json={
            "merchant_id": user["merchant_id"],
            "email": user["email"],
            "password": PASSWORD,
        },
    ).json()
    sales = {"Authorization": "Bearer " + token["access_token"]}
    customer = client.post(
        "/customers", headers=sales, json={"name": "销售客户"}
    ).json()
    assert customer["owner_user_id"] == user["id"]
    path = "/customers/" + customer["id"]
    assert (
        client.patch(
            path, headers=sales, json={"owner_user_id": str(accounts[0].id)}
        ).status_code
        == 403
    )
    assert (
        client.patch(
            path, headers=owner, json={"owner_user_id": str(accounts[0].id)}
        ).status_code
        == 200
    )
    project = client.post(
        "/projects", headers=sales, json={"name": "方案", "customer_id": customer["id"]}
    ).json()
    assert project["sales_user_id"] == user["id"]
    assert (
        client.patch(
            "/projects/" + project["id"],
            headers=sales,
            json={"sales_user_id": str(accounts[0].id)},
        ).status_code
        == 403
    )


def test_invalid_product_metadata_never_reaches_database(client, accounts):
    import json

    auth = headers(client, accounts[0])
    payload = {**PRODUCT, "metadata": {"bad": float("nan")}}
    response = client.post(
        "/products",
        headers={**auth, "Content-Type": "application/json"},
        content=json.dumps(payload),
    )
    assert response.status_code == 422


def test_ready_reports_unavailable_without_connection_details(monkeypatch):
    from fastapi.testclient import TestClient
    from smart_home.config import get_settings
    from smart_home.db import session_factory
    from smart_home.main import create_app

    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://hidden:private@127.0.0.1:1/unavailable"
    )
    get_settings.cache_clear()
    session_factory.cache_clear()
    try:
        with TestClient(create_app()) as client:
            response = client.get("/ready")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "database_unavailable"
        assert "hidden" not in response.text and "private" not in response.text
    finally:
        session_factory().kw["bind"].dispose()
        session_factory.cache_clear()
        get_settings.cache_clear()
