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


def test_product_search_category_pagination_and_total(client, accounts):
    auth = headers(client, accounts[0])
    products = [
        {
            **PRODUCT,
            "name": "三人沙发",
            "brand": "舒适家",
            "sku": "SOFA-001",
            "category": "sofa",
        },
        {
            **PRODUCT,
            "name": "单人沙发",
            "brand": "安心居",
            "sku": "CHAIR-001",
            "category": "sofa",
        },
        {
            **PRODUCT,
            "name": "智能冰箱",
            "brand": "舒适家",
            "sku": "FRIDGE-001",
            "category": "appliance",
        },
    ]
    for product in products:
        assert client.post("/products", headers=auth, json=product).status_code == 201

    assert (
        client.get("/products?search=三人", headers=auth).json()["items"][0]["sku"]
        == "SOFA-001"
    )
    assert client.get("/products?search=CHAIR-001", headers=auth).json()["total"] == 1
    assert client.get("/products?search=舒适家", headers=auth).json()["total"] == 2
    assert client.get("/products?category=sofa", headers=auth).json()["total"] == 2
    combined = client.get("/products?search=舒适家&category=sofa", headers=auth).json()
    assert combined["total"] == 1
    assert combined["items"][0]["name"] == "三人沙发"

    first_page = client.get(
        "/products?category=sofa&limit=1&offset=0", headers=auth
    ).json()
    second_page = client.get(
        "/products?category=sofa&limit=1&offset=1", headers=auth
    ).json()
    assert first_page["total"] == second_page["total"] == 2
    assert first_page["items"][0]["id"] != second_page["items"][0]["id"]


def test_product_search_and_category_keep_tenant_isolation(client, accounts):
    first, second = [headers(client, account) for account in accounts]
    private_product = {
        **PRODUCT,
        "name": "私有沙发",
        "sku": "PRIVATE-001",
        "category": "sofa",
    }
    assert (
        client.post("/products", headers=first, json=private_product).status_code == 201
    )
    assert client.get("/products?search=私有", headers=second).json()["total"] == 0
    assert client.get("/products?category=sofa", headers=second).json()["total"] == 0


@pytest.mark.parametrize(
    "query",
    [f"search={'x' * 101}", "search=", f"category={'x' * 101}", "category="],
)
def test_product_filters_reject_invalid_parameters(client, accounts, query):
    assert (
        client.get(
            f"/products?{query}", headers=headers(client, accounts[0])
        ).status_code
        == 422
    )


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
