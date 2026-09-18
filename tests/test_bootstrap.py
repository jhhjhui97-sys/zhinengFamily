import pytest
from sqlalchemy import func, select


def test_bootstrap_creates_merchant_hashed_owner_and_rejects_duplicate(db_session):
    from smart_home.cli import bootstrap
    from smart_home.models import Merchant, User
    from smart_home.modules.auth.security import verify_password

    merchant, user = bootstrap(
        db_session, "首店", " OWNER@EXAMPLE.COM ", "Long-Password-1234"
    )
    assert user.merchant_id == merchant.id
    assert user.email == "owner@example.com"
    assert user.password_hash != "Long-Password-1234"
    assert verify_password("Long-Password-1234", user.password_hash)
    with pytest.raises(ValueError):
        bootstrap(db_session, "首店", "owner@example.com", "Long-Password-1234")
    assert db_session.scalar(select(func.count()).select_from(Merchant)) == 1
    assert db_session.scalar(select(func.count()).select_from(User)) == 1


def test_bootstrap_invalid_password_is_atomic(db_session):
    from smart_home.cli import bootstrap
    from smart_home.models import Merchant

    with pytest.raises(ValueError):
        bootstrap(db_session, "失败店", "owner@example.com", "short")
    assert db_session.scalar(select(func.count()).select_from(Merchant)) == 0
