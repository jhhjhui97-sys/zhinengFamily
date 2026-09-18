from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest

PASSWORD = "Test-Password-1234"


def login(client, user, password=PASSWORD):
    return client.post(
        "/auth/login",
        json={
            "merchant_id": str(user.merchant_id),
            "email": user.email,
            "password": password,
        },
    )


def headers(client, user):
    response = login(client, user)
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_login_me_and_no_password_leak(client, accounts):
    response = login(client, accounts[0])
    assert response.status_code == 200
    assert response.json()["expires_in"] == 1800
    response = client.get("/auth/me", headers=headers(client, accounts[0]))
    assert response.status_code == 200
    assert response.json()["merchant_id"] == str(accounts[0].merchant_id)
    assert "password" not in response.text
    assert PASSWORD not in response.text


def test_bad_login_indistinguishable(client, accounts):
    wrong = login(client, accounts[0], "wrong-password")
    unknown = client.post(
        "/auth/login",
        json={
            "merchant_id": str(uuid4()),
            "email": "absent@example.com",
            "password": "wrong-password",
        },
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert "wrong-password" not in wrong.text


def test_missing_token(client):
    assert client.get("/auth/me").status_code == 401


def test_disabled_user_cannot_login_or_use_existing_token(client, accounts, db_session):
    auth = headers(client, accounts[0])
    accounts[0].is_active = False
    db_session.commit()
    assert client.get("/auth/me", headers=auth).status_code == 401
    assert login(client, accounts[0]).status_code == 401


@pytest.mark.parametrize(
    "failure", ["expired", "signature", "audience", "issuer", "subject", "missing_exp"]
)
def test_invalid_token(client, accounts, failure):
    from smart_home.config import get_settings

    settings = get_settings()
    claims = dict(
        sub=str(accounts[0].id),
        exp=datetime.now(timezone.utc) + timedelta(minutes=2),
        iss=settings.token_issuer,
        aud=settings.token_audience,
    )
    key = settings.secret_key.get_secret_value()
    if failure == "expired":
        claims["exp"] = datetime.now(timezone.utc) - timedelta(minutes=2)
    if failure == "signature":
        key = "a-different-signing-key-32-chars-long"
    if failure == "audience":
        claims["aud"] = "wrong"
    if failure == "issuer":
        claims["iss"] = "wrong"
    if failure == "subject":
        claims["sub"] = "invalid-uuid"
    if failure == "missing_exp":
        del claims["exp"]
    token = jwt.encode(claims, key, algorithm="HS256")
    assert (
        client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code
        == 401
    )


def test_owner_user_creation_and_isolation(client, accounts):
    auth = headers(client, accounts[0])
    response = client.post(
        "/users",
        headers=auth,
        json={"email": "sales@example.com", "password": PASSWORD},
    )
    assert response.status_code == 201
    user = response.json()
    assert user["merchant_id"] == str(accounts[0].merchant_id)
    assert "password" not in response.text
    assert (
        client.get(
            "/users/" + user["id"], headers=headers(client, accounts[1])
        ).status_code
        == 404
    )
    salesperson = client.post(
        "/auth/login",
        json={
            "merchant_id": user["merchant_id"],
            "email": user["email"],
            "password": PASSWORD,
        },
    ).json()
    sales_auth = {"Authorization": "Bearer " + salesperson["access_token"]}
    assert (
        client.post(
            "/users",
            headers=sales_auth,
            json={"email": "another@example.com", "password": PASSWORD},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/users",
            headers=auth,
            json={"email": "sales@example.com", "password": PASSWORD},
        ).status_code
        == 409
    )


def test_user_input_rejects_injected_tenant_and_short_password(client, accounts):
    auth = headers(client, accounts[0])
    for payload in (
        {"email": "new@example.com", "password": "short"},
        {
            "email": "new@example.com",
            "password": PASSWORD,
            "merchant_id": str(accounts[1].merchant_id),
        },
    ):
        response = client.post("/users", headers=auth, json=payload)
        assert response.status_code == 422
        assert payload["password"] not in response.text
