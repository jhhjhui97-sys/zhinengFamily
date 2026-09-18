import pytest
from sqlalchemy.exc import IntegrityError


def test_merchant_timestamps_update(db_session):
    from smart_home.modules.merchants.models import Merchant

    merchant = Merchant(name="店铺")
    db_session.add(merchant)
    db_session.flush()
    before = merchant.updated_at
    merchant.name = "新店铺"
    db_session.flush()
    assert merchant.updated_at >= before
    assert merchant.created_at.utcoffset().total_seconds() == 0


def test_normalized_email_is_unique_per_merchant(db_session, tenants):
    from smart_home.modules.users.models import User

    user = tenants[0]
    db_session.add(
        User(
            merchant_id=user.merchant_id,
            email=" OWNER@EXAMPLE.COM ",
            password_hash="hash",
            role="sales",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


@pytest.mark.parametrize(
    "model,extra",
    [
        ("User", dict(email="bad@example.com", password_hash="hash", role="admin")),
        ("Customer", dict(name="客户", status="invalid", budget=1)),
        ("Customer", dict(name="客户", budget=-1)),
    ],
)
def test_role_status_budget_checks(db_session, tenants, model, extra):
    from smart_home.modules.customers.models import Customer
    from smart_home.modules.users.models import User

    cls = {"User": User, "Customer": Customer}[model]
    if model == "Customer":
        extra["owner_user_id"] = tenants[0].id
    db_session.add(cls(merchant_id=tenants[0].merchant_id, **extra))
    with pytest.raises(IntegrityError):
        db_session.flush()
