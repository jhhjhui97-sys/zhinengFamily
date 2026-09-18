import os
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError


def test_foundation_schema_exists(db_engine):
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    try:
        assert {
            "merchants",
            "users",
            "customers",
            "products",
            "design_projects",
        } <= set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_database_connection(db_session):
    assert db_session.execute(text("select 1")).scalar_one() == 1


def test_decimal_round_trip(db_session, tenants):
    from smart_home.modules.products.models import Product

    product = Product(
        merchant_id=tenants[0].merchant_id,
        category="sofa",
        brand="A",
        name="沙发",
        sku="sku",
        price=Decimal("123.45"),
        width_mm=100,
        depth_mm=200,
        height_mm=300,
    )
    db_session.add(product)
    db_session.flush()
    db_session.expire(product)
    assert product.price == Decimal("123.45")
    assert product.created_at.utcoffset().total_seconds() == 0


def test_customer_cannot_reference_other_merchant_user(db_session, tenants):
    from smart_home.modules.customers.models import Customer

    a, b = tenants
    db_session.add(Customer(merchant_id=a.merchant_id, owner_user_id=b.id, name="越界"))
    with pytest.raises(IntegrityError):
        db_session.flush()


@pytest.mark.parametrize(
    "field,value",
    [
        ("price", -1),
        ("price", Decimal("NaN")),
        ("width_mm", 0),
        ("depth_mm", float("inf")),
        ("height_mm", float("nan")),
    ],
)
def test_product_database_domain_checks(db_session, tenants, field, value):
    from smart_home.modules.products.models import Product

    fields = dict(
        merchant_id=tenants[0].merchant_id,
        category="sofa",
        brand="A",
        name="沙发",
        sku="check",
        price=1,
        width_mm=100,
        depth_mm=200,
        height_mm=300,
    )
    fields[field] = value
    db_session.add(Product(**fields))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_product_sku_unique_per_merchant(db_session, tenants):
    from smart_home.modules.products.models import Product

    for _ in range(2):
        db_session.add(
            Product(
                merchant_id=tenants[0].merchant_id,
                category="sofa",
                brand="A",
                name="沙发",
                sku="duplicate",
                price=1,
                width_mm=100,
                depth_mm=200,
                height_mm=300,
            )
        )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_project_cannot_reference_other_tenant_customer(db_session, tenants):
    from smart_home.modules.customers.models import Customer
    from smart_home.modules.projects.models import DesignProject

    a, b = tenants
    customer = Customer(merchant_id=b.merchant_id, owner_user_id=b.id, name="客户")
    db_session.add(customer)
    db_session.flush()
    db_session.add(
        DesignProject(
            merchant_id=a.merchant_id,
            customer_id=customer.id,
            sales_user_id=a.id,
            name="越界",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_migration_round_trip_and_metadata_sync(db_engine, migration_config):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from smart_home.db import Base

    command.downgrade(migration_config, "base")
    assert inspect(db_engine).get_table_names() == ["alembic_version"]
    command.upgrade(migration_config, "head")
    with db_engine.connect() as connection:
        assert (
            compare_metadata(MigrationContext.configure(connection), Base.metadata)
            == []
        )


def test_ready_uses_real_database(client):
    assert client.get("/ready").json() == {"status": "ready"}


def test_test_url_guard_rejects_development_database():
    from db_support import validate_test_database_url

    with pytest.raises(ValueError):
        validate_test_database_url(
            "postgresql+psycopg://other@localhost:55432/x_test",
            "postgresql+psycopg://dev@127.0.0.1:55432/x_test",
        )
    with pytest.raises(ValueError):
        validate_test_database_url("sqlite:///x_test", "postgresql://dev@localhost/dev")
    with pytest.raises(ValueError):
        validate_test_database_url(
            "postgresql://test@localhost/dev", "postgresql://dev@localhost/dev"
        )
