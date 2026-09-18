import pytest
from test_auth import headers

PRODUCT = dict(
    category="appliance",
    brand="示例",
    name="冰箱",
    sku="F01",
    price="3999.90",
    width_mm=600,
    depth_mm=650,
    height_mm=1800,
    metadata={"color": "white"},
)


def test_product_crud_money_metadata_and_sku(client, accounts):
    auth = headers(client, accounts[0])
    created = client.post("/products", headers=auth, json=PRODUCT)
    assert created.status_code == 201, created.text
    product = created.json()
    assert product["price"] == "3999.90"
    assert product["metadata"] == {"color": "white"}
    path = "/products/" + product["id"]
    assert client.get(path, headers=auth).json() == product
    changed = client.patch(
        path, headers=auth, json={"price": "3500.00", "metadata": {"color": "black"}}
    )
    assert changed.status_code == 200
    assert changed.json()["metadata"] == {"color": "black"}
    assert changed.json()["price"] == "3500.00"
    assert client.get("/products?limit=1", headers=auth).json()["total"] == 1
    assert client.post("/products", headers=auth, json=PRODUCT).status_code == 409
    assert (
        client.post(
            "/products", headers=headers(client, accounts[1]), json=PRODUCT
        ).status_code
        == 201
    )


def test_product_tenant_isolation(client, accounts):
    a, b = [headers(client, u) for u in accounts]
    product = client.post("/products", headers=a, json=PRODUCT).json()
    path = "/products/" + product["id"]
    assert client.get(path, headers=b).status_code == 404
    assert client.patch(path, headers=b, json={"price": "1.00"}).status_code == 404
    assert client.get("/products", headers=b).json()["total"] == 0
    assert client.get("/products").status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        {"price": "-1"},
        {"price": "1.001"},
        {"width_mm": 0},
        {"depth_mm": -1},
        {"height_mm": None},
        {"metadata": None},
        {"name": None},
        {"sku": ""},
        {"id": "00000000-0000-4000-8000-000000000001"},
    ],
)
def test_product_invalid_input(client, accounts, change):
    auth = headers(client, accounts[0])
    product = client.post("/products", headers=auth, json=PRODUCT).json()
    assert (
        client.patch(
            "/products/" + product["id"], headers=auth, json=change
        ).status_code
        == 422
    )
