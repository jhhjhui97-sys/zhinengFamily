import pytest
from test_auth import headers


def test_customer_crud_fields_and_pagination(client, accounts):
    auth = headers(client, accounts[0])
    payload = {
        "name": "张先生",
        "phone": "13800000000",
        "wechat": "wechat-id",
        "source": "门店",
        "address": "上海",
        "budget": "12345.67",
        "status": "following",
        "notes": "喜欢浅色",
        "last_follow_up_at": "2026-09-17T08:00:00Z",
    }
    created = client.post("/customers", headers=auth, json=payload)
    assert created.status_code == 201, created.text
    customer = created.json()
    assert customer["budget"] == "12345.67"
    assert customer["owner_user_id"] == str(accounts[0].id)
    assert customer["notes"] == "喜欢浅色"
    path = "/customers/" + customer["id"]
    assert client.get(path, headers=auth).json() == customer
    updated = client.patch(path, headers=auth, json={"notes": None, "status": "won"})
    assert updated.status_code == 200
    assert updated.json()["notes"] is None
    assert updated.json()["name"] == "张先生"
    listing = client.get("/customers?limit=1&offset=0", headers=auth).json()
    assert listing["total"] == 1 and len(listing["items"]) == 1
    assert client.get("/customers?offset=1", headers=auth).json()["items"] == []
    assert client.get("/customers?limit=101", headers=auth).status_code == 422


def test_customer_isolation_and_references(client, accounts):
    a, b = [headers(client, u) for u in accounts]
    customer = client.post("/customers", headers=a, json={"name": "A 客户"}).json()
    path = "/customers/" + customer["id"]
    assert client.get(path, headers=b).status_code == 404
    assert client.patch(path, headers=b, json={"name": "越权"}).status_code == 404
    assert client.get("/customers", headers=b).json()["total"] == 0
    assert (
        client.post(
            "/customers",
            headers=a,
            json={"name": "bad", "owner_user_id": str(accounts[1].id)},
        ).status_code
        == 404
    )
    assert (
        client.patch(
            path, headers=a, json={"owner_user_id": str(accounts[1].id)}
        ).status_code
        == 404
    )
    assert client.get(path, headers=a).json()["name"] == "A 客户"


@pytest.mark.parametrize(
    "change",
    [
        {"name": None},
        {"name": "   "},
        {"budget": "-1"},
        {"status": "unknown"},
        {"owner_user_id": None},
        {"merchant_id": "00000000-0000-4000-8000-000000000001"},
    ],
)
def test_customer_rejects_invalid_patch(client, accounts, change):
    auth = headers(client, accounts[0])
    customer = client.post("/customers", headers=auth, json={"name": "客户"}).json()
    assert (
        client.patch(
            "/customers/" + customer["id"], headers=auth, json=change
        ).status_code
        == 422
    )


def test_customer_requires_auth(client):
    assert client.get("/customers").status_code == 401
    assert client.post("/customers", json={"name": "客户"}).status_code == 401
