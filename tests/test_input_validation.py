import pytest
from test_auth import headers
from test_products import PRODUCT

NUL_TEXT = "private-request-value\x00suffix"
INVALID_WRITES = [
    ("customers", {"name": NUL_TEXT}),
    ("customers", {"notes": NUL_TEXT}),
    ("products", {"name": NUL_TEXT}),
    ("products", {"sku": NUL_TEXT}),
    ("products", {"metadata": {"nested": [{"note": NUL_TEXT}]}}),
    ("products", {"metadata": {"nested": [{NUL_TEXT: "value"}]}}),
    ("projects", {"name": NUL_TEXT}),
    ("projects", {"address": NUL_TEXT}),
]


def create_payload(client, auth, resource):
    if resource == "products":
        return PRODUCT.copy()
    if resource == "projects":
        customer = client.post("/customers", headers=auth, json={"name": "Customer"})
        assert customer.status_code == 201
        return {"name": "Project", "customer_id": customer.json()["id"]}
    return {"name": "Customer", "notes": "Original notes"}


def assert_sanitized_validation(response):
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["details"]
    assert "private-request-value" not in response.text
    assert "suffix" not in response.text


@pytest.mark.parametrize("resource,change", INVALID_WRITES)
def test_post_rejects_nul_text_before_persistence(client, accounts, resource, change):
    auth = headers(client, accounts[0])
    payload = create_payload(client, auth, resource) | change
    response = client.post("/" + resource, headers=auth, json=payload)
    assert_sanitized_validation(response)
    assert client.get("/" + resource, headers=auth).json()["total"] == 0


@pytest.mark.parametrize("resource,change", INVALID_WRITES)
def test_patch_rejects_nul_text_without_changing_row(
    client, accounts, resource, change
):
    auth = headers(client, accounts[0])
    created = client.post(
        "/" + resource, headers=auth, json=create_payload(client, auth, resource)
    )
    assert created.status_code == 201
    original = created.json()
    path = "/" + resource + "/" + original["id"]
    response = client.patch(path, headers=auth, json={"name": "Changed"} | change)
    assert_sanitized_validation(response)
    assert client.get(path, headers=auth).json() == original


@pytest.mark.parametrize("path", ["/auth/login", "/users"])
def test_nul_password_is_rejected_without_plaintext_error(client, accounts, path):
    auth = headers(client, accounts[0])
    payload = {"email": accounts[0].email, "password": NUL_TEXT}
    if path == "/auth/login":
        payload["merchant_id"] = str(accounts[0].merchant_id)
    response = client.post(path, headers=auth, json=payload)
    assert_sanitized_validation(response)
